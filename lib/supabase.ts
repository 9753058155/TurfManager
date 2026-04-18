import { createClient } from '@supabase/supabase-js'

export type Slot = {
  id: string; date: string; start_time: string; end_time: string
  status: 'available' | 'locked' | 'booked'; lock_expires_at?: string
}
export type SlotFee = { id: string; slot_type: string; price: number; duration_minutes: number }
export type Booking = {
  id: string; user_id: string; date: string; start_time: string; end_time: string
  amount: number; status: 'pending' | 'confirmed' | 'cancelled'
  payment_id?: string; razorpay_order_id?: string; qr_used?: boolean; created_at: string
}
export type Profile = { id: string; full_name: string; phone?: string; wallet_balance: number; role: 'user' | 'admin' }

// Browser-only client — only imported by 'use client' components
export const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Singleton for client components
let _supabase: ReturnType<typeof getSupabase> | null = null
export const supabase = typeof window !== 'undefined'
  ? (_supabase ??= getSupabase())
  : ({} as ReturnType<typeof getSupabase>)

// Server admin — called only inside request handlers
export const supabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)