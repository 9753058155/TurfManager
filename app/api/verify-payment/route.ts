export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, walletAmount } = await req.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Step 1: Verify signature — no DB needed
    const secret = process.env.RAZORPAY_KEY_SECRET!
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // Step 2: Fetch booking
    const { data: booking, error: fetchErr } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Already confirmed — idempotent
    if (booking.status === 'confirmed') {
      return NextResponse.json({ ok: true, bookingId })
    }

    const walletUsed = walletAmount || booking.wallet_used || 0

    // Step 3: Confirm booking
    await db
      .from('bookings')
      .update({ status: 'confirmed', payment_id: razorpay_payment_id })
      .eq('id', bookingId)

    // Step 4: Deduct wallet if used
    if (walletUsed > 0) {
      const { data: p } = await db
        .from('profiles')
        .select('wallet_balance')
        .eq('id', booking.user_id)
        .single()

      await db
        .from('profiles')
        .update({ wallet_balance: Math.max(0, (p?.wallet_balance ?? 0) - walletUsed) })
        .eq('id', booking.user_id)
    }

    // Step 5: Insert receipt — fire and forget, webhook is fallback
    const receiptNumber = `RCP-${Date.now()}-${bookingId.slice(0, 6).toUpperCase()}`
    void (async () => {
      try {
        await db.from('receipts').insert({
          booking_id: bookingId,
          user_id: booking.user_id,
          razorpay_payment_id,
          razorpay_order_id,
          amount: booking.amount,
          wallet_amount: walletUsed,
          date: booking.date,
          start_time: booking.start_time,
          end_time: booking.end_time,
          receipt_number: receiptNumber,
          status: 'paid',
          user_name: booking.user_name || null,
          user_phone: booking.user_phone || null,
        })
      } catch { /* webhook handles retry */ }
    })()

    return NextResponse.json({ ok: true, bookingId, receiptNumber })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}