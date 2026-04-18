import { createClient } from '@supabase/supabase-js'

export type Slot = {
  id: string
  date: string
  start_time: string
  end_time: string
  status: 'available' | 'locked' | 'booked'
  lock_expires_at?: string
}

export type SlotFee = {
  id: string
  slot_type: string
  price: number
  duration_minutes: number
}

export type Booking = {
  id: string
  user_id: string
  slot_id?: string
  date: string
  start_time: string
  end_time: string
  amount: number
  status: 'pending' | 'confirmed' | 'cancelled'
  payment_id?: string
  razorpay_order_id?: string
  qr_used?: boolean
  created_at: string
}

export type Profile = {
  id: string
  full_name: string
  phone?: string
  wallet_balance: number
  role: 'user' | 'admin'
}

// Called in client components — reads NEXT_PUBLIC_ vars (always available)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
)

// Called only inside API route handlers at request time — never at build time
export const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}