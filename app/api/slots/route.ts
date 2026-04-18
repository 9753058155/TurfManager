export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    const db = supabaseAdmin() // bypasses RLS — sees ALL bookings

    const now = new Date().toISOString()

    const { data: bookings } = await db
      .from('bookings')
      .select('start_time, status, lock_expires_at')
      .eq('date', date)
      .or(`status.eq.confirmed,and(status.eq.pending,lock_expires_at.gt.${now})`)

    return NextResponse.json({ bookings: bookings ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}