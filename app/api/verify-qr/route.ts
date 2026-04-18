export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'
import QRCode from 'qrcode'

const QR_SECRET = process.env.QR_SECRET || 'fallback-secret-change-in-prod'

function signPayload(data: object): string {
  const payload = JSON.stringify(data)
  const sig = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

function verifyPayload(token: string): { valid: boolean; data?: any; reason?: string } {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded
    const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(JSON.stringify(data)).digest('hex')
    if (sig !== expectedSig) return { valid: false, reason: 'Invalid signature' }
    if (data.exp < Date.now()) return { valid: false, reason: 'QR expired' }
    return { valid: true, data }
  } catch {
    return { valid: false, reason: 'Malformed token' }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('bookingId')
  const generate = searchParams.get('generate') === 'true'
  const token = searchParams.get('token')
  const db = supabaseAdmin()

  // --- GENERATE QR ---
  if (generate && bookingId) {
    const { data: booking } = await db.from('bookings').select('*').eq('id', bookingId).single()
    if (!booking || booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Booking not found or not confirmed' }, { status: 404 })
    }

    const payload = {
      bookingId: booking.id,
      userId: booking.user_id,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24h expiry
    }
    const token = signPayload(payload)
    const qrDataUrl = await QRCode.toDataURL(token, {
      width: 300,
      margin: 2,
      color: { dark: '#0a1628', light: '#ffffff' }
    })
    return NextResponse.json({ qrDataUrl, token })
  }

  // --- VERIFY QR (scan at entry) ---
  if (token) {
    const result = verifyPayload(token)
    if (!result.valid) return NextResponse.json({ valid: false, reason: result.reason }, { status: 400 })

    const { bookingId } = result.data
    const { data: booking } = await db.from('bookings').select('*').eq('id', bookingId).single()

    if (!booking) return NextResponse.json({ valid: false, reason: 'Booking not found' }, { status: 404 })
    if (booking.status !== 'confirmed') return NextResponse.json({ valid: false, reason: 'Booking not active' }, { status: 400 })
    if (booking.qr_used) return NextResponse.json({ valid: false, reason: 'QR already used (replay attack prevented)' }, { status: 400 })

    // Mark QR as used (anti-replay)
    await db.from('bookings').update({ qr_used: true }).eq('id', bookingId)

    return NextResponse.json({
      valid: true,
      booking: {
        id: booking.id,
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        userId: booking.user_id,
        userName: booking.user_name || null,
        userPhone: booking.user_phone || null,
      }
    })
  }

  return NextResponse.json({ error: 'Missing params' }, { status: 400 })
}