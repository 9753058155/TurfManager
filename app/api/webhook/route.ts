export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  const secret = process.env.RAZORPAY_KEY_SECRET || ''

  if (secret && signature) {
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex')
    if (expectedSig !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  const event = JSON.parse(body)
  const db = supabaseAdmin()

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity
    const orderId = payment.order_id
    const paymentId = payment.id

    const { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('razorpay_order_id', orderId)
      .single()

    if (!booking) return NextResponse.json({ ok: true })
    if (booking.status === 'confirmed') return NextResponse.json({ ok: true }) // already handled

    // Confirm booking
    await db.from('bookings').update({
      status: 'confirmed',
      payment_id: paymentId,
    }).eq('razorpay_order_id', orderId)

    // Create receipt if not already created
    const { data: existing } = await db
      .from('receipts')
      .select('id')
      .eq('razorpay_payment_id', paymentId)
      .maybeSingle()

    if (!existing) {
      const receiptNumber = `RCP-${Date.now()}-${booking.id.slice(0, 6).toUpperCase()}`
      await db.from('receipts').insert({
        booking_id: booking.id,
        user_id: booking.user_id,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        amount: booking.amount,
        date: booking.date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        receipt_number: receiptNumber,
        status: 'paid',
      })
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity
    await db.from('bookings')
      .update({ status: 'cancelled' })
      .eq('razorpay_order_id', payment.order_id)
  }

  return NextResponse.json({ ok: true })
}