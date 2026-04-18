export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

// Razorpay calls this URL after iOS hosted checkout completes
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)

    const razorpay_payment_id = params.get('razorpay_payment_id') || ''
    const razorpay_order_id   = params.get('razorpay_order_id') || ''
    const razorpay_signature  = params.get('razorpay_signature') || ''

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.redirect(new URL('/?payment=failed', req.url))
    }

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET!
    const expected = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex')

    if (expected !== razorpay_signature) {
      return NextResponse.redirect(new URL('/?payment=invalid', req.url))
    }

    const db = supabaseAdmin()

    // Find booking by order id
    const { data: booking } = await db
      .from('bookings').select('*')
      .eq('razorpay_order_id', razorpay_order_id).single()

    if (!booking) return NextResponse.redirect(new URL('/?payment=notfound', req.url))
    if (booking.status === 'confirmed') {
      return NextResponse.redirect(new URL(`/booking/${booking.id}`, req.url))
    }

    // Deduct wallet if used
    const walletUsed = booking.wallet_used || 0
    if (walletUsed > 0) {
      const { data: profile } = await db.from('profiles').select('wallet_balance').eq('id', booking.user_id).single()
      const newBal = Math.max(0, (profile?.wallet_balance ?? 0) - walletUsed)
      await db.from('profiles').update({ wallet_balance: newBal }).eq('id', booking.user_id)
    }

    // Confirm booking
    await db.from('bookings').update({
      status: 'confirmed', payment_id: razorpay_payment_id
    }).eq('id', booking.id)

    // Create receipt
    const receiptNumber = `RCP-${Date.now()}-${booking.id.slice(0,6).toUpperCase()}`
    await db.from('receipts').insert({
      booking_id: booking.id, user_id: booking.user_id,
      razorpay_payment_id, razorpay_order_id,
      amount: booking.amount, wallet_amount: walletUsed,
      date: booking.date, start_time: booking.start_time, end_time: booking.end_time,
      receipt_number: receiptNumber, status: 'paid',
    }).select().single()

    return NextResponse.redirect(new URL(`/booking/${booking.id}`, req.url))
  } catch (e: any) {
    return NextResponse.redirect(new URL('/?payment=error', req.url))
  }
}