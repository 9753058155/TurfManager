import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''

  // Verify webhook signature
  const secret = process.env.RAZORPAY_KEY_SECRET || ''
  if (secret) {
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

    // Idempotency: check if already processed
    const { data: existing } = await db
      .from('bookings')
      .select('id, status')
      .eq('razorpay_order_id', orderId)
      .single()

    if (!existing) return NextResponse.json({ ok: true })
    if (existing.status === 'confirmed') return NextResponse.json({ ok: true }) // Already done

    // Confirm booking
    const { error } = await db.from('bookings').update({
      status: 'confirmed',
      payment_id: paymentId,
    }).eq('razorpay_order_id', orderId)

    if (error) {
      console.error('Webhook booking confirm error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity
    await db.from('bookings').update({ status: 'cancelled' }).eq('razorpay_order_id', payment.order_id)
  }

  return NextResponse.json({ ok: true })
}
