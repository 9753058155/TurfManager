export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
    }

    // Verify Razorpay signature
    const secret = process.env.RAZORPAY_KEY_SECRET!
    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex')

    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // Idempotency check
    const { data: booking } = await db
      .from('bookings').select('*').eq('id', bookingId).single()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status === 'confirmed') {
      return NextResponse.json({ ok: true, alreadyConfirmed: true, bookingId })
    }

    // Confirm booking
    await db.from('bookings').update({
      status: 'confirmed',
      payment_id: razorpay_payment_id,
    }).eq('id', bookingId)

    // Create receipt (UNIQUE on razorpay_payment_id prevents duplicates)
    const receiptNumber = `RCP-${Date.now()}-${bookingId.slice(0, 6).toUpperCase()}`
    const { data: receipt } = await db.from('receipts').insert({
      booking_id: bookingId,
      user_id: booking.user_id,
      razorpay_payment_id,
      razorpay_order_id,
      amount: booking.amount,
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      receipt_number: receiptNumber,
      status: 'paid',
    }).select().single()

    return NextResponse.json({ ok: true, bookingId, receiptNumber })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}