export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Called when user dismisses Razorpay modal without paying
// Cancels the pending booking so slot becomes available again
export async function POST(req: NextRequest) {
  try {
    const { bookingId, userId } = await req.json()
    if (!bookingId || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const { data: booking } = await db
      .from('bookings')
      .select('id, user_id, status')
      .eq('id', bookingId)
      .single()

    if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (booking.user_id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    if (booking.status !== 'pending') return NextResponse.json({ ok: true }) // already handled

    await db.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
