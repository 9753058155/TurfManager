export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { amount, razorpayAmount, walletAmount, slot, userId } = await req.json()
    if (!amount || !slot || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = supabaseAdmin()

    // Check slot not already taken
    const { data: existing } = await db
      .from('bookings').select('id')
      .eq('date', slot.date).eq('start_time', slot.start_time)
      .in('status', ['confirmed', 'pending']).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Slot already taken' }, { status: 409 })

    // Verify wallet balance if wallet is being used
    const walletToUse = walletAmount || 0
    if (walletToUse > 0) {
      const { data: profile } = await db.from('profiles').select('wallet_balance').eq('id', userId).single()
      if ((profile?.wallet_balance ?? 0) < walletToUse) {
        return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
      }
    }

    const rzpDue = razorpayAmount ?? amount

    // WALLET-ONLY: no Razorpay needed
    if (rzpDue === 0) {
      // Deduct wallet
      const { data: profile } = await db.from('profiles').select('wallet_balance').eq('id', userId).single()
      const newBalance = (profile?.wallet_balance ?? 0) - walletToUse
      await db.from('profiles').update({ wallet_balance: newBalance }).eq('id', userId)

      // Confirm booking immediately
      const { data: booking } = await db.from('bookings').insert({
        user_id: userId, date: slot.date, start_time: slot.start_time,
        end_time: slot.end_time, amount, status: 'confirmed',
        wallet_used: walletToUse, razorpay_order_id: null,
      }).select().single()

      // Create receipt
      const receiptNumber = `RCP-WALLET-${Date.now()}`
      await db.from('receipts').insert({
        booking_id: booking.id, user_id: userId,
        razorpay_payment_id: `wallet_${Date.now()}`,
        razorpay_order_id: null, amount, wallet_amount: walletToUse,
        date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
        receipt_number: receiptNumber, status: 'paid',
      })

      return NextResponse.json({ bookingId: booking.id, walletOnly: true })
    }

    // RAZORPAY (full or partial): create Razorpay order for the remaining amount
    let orderId = `order_${Date.now()}`
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(
            `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
          ).toString('base64')
        },
        body: JSON.stringify({
          amount: rzpDue * 100,   // only the Razorpay portion
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`
        })
      })
      const rzpData = await rzpRes.json()
      if (rzpData.id) orderId = rzpData.id
    }

    // Create pending booking — store wallet_used for later deduction on confirmation
    const { data: booking, error: bookingErr } = await db.from('bookings').insert({
      user_id: userId, date: slot.date, start_time: slot.start_time,
      end_time: slot.end_time, amount, status: 'pending',
      razorpay_order_id: orderId, wallet_used: walletToUse,
    }).select().single()

    if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 })

    return NextResponse.json({ orderId, bookingId: booking.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}