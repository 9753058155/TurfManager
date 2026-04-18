export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { amount, slot, userId } = await req.json()
    if (!amount || !slot || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = supabaseAdmin()

    // Check if slot already booked
    const { data: existing } = await db
      .from('bookings')
      .select('id')
      .eq('date', slot.date)
      .eq('start_time', slot.start_time)
      .in('status', ['confirmed', 'pending'])
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Slot already taken' }, { status: 409 })

    // Create Razorpay order
    let orderId = `order_${Date.now()}`
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
        },
        body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt: `receipt_${Date.now()}` })
      })
      const rzpData = await rzpRes.json()
      if (rzpData.id) orderId = rzpData.id
    }

    // Create booking in pending state
    const { data: booking, error: bookingErr } = await db.from('bookings').insert({
      user_id: userId,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      amount: amount,
      status: 'pending',
      razorpay_order_id: orderId,
    }).select().single()

    if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 })

    return NextResponse.json({ orderId, bookingId: booking.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
