export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { bookingId, userId, isAdmin } = await req.json()
    const db = supabaseAdmin()

    const { data: booking, error: fetchErr } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 400 })
    if (!isAdmin && booking.user_id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const refundPct = isAdmin ? 1 : 0.5
    const refundAmount = Math.round(booking.amount * refundPct)

    const [cancelRes, walletRes] = await Promise.all([
      db.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId),
      db.from('profiles').select('wallet_balance').eq('id', booking.user_id).single()
    ])

    if (cancelRes.error) return NextResponse.json({ error: cancelRes.error.message }, { status: 500 })

    const currentBalance = walletRes.data?.wallet_balance ?? 0
    await db.from('profiles').update({ wallet_balance: currentBalance + refundAmount }).eq('id', booking.user_id)

    return NextResponse.json({ ok: true, refundAmount })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}