import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { slotTime, price, userId, applyToAll } = await req.json()
    if (price == null || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = supabaseAdmin()

    // Verify admin
    const { data: profile } = await db.from('profiles').select('role').eq('id', userId).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (applyToAll) {
      // Update ALL slot_fees rows
      const { error } = await db.from('slot_fees').update({ price: Number(price) }).gte('price', 0)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      if (!slotTime) return NextResponse.json({ error: 'Missing slotTime' }, { status: 400 })
      // Update ONLY the row matching this slot_time
      const { error } = await db
        .from('slot_fees')
        .update({ price: Number(price) })
        .eq('slot_time', slotTime)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}