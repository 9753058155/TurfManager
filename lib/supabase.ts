import { createClient } from '@supabase/supabase-js'

// ✅ CLIENT (frontend-safe)
export const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Missing Supabase public env vars')
  }

  return createClient(url, anon)
}

// ✅ ADMIN (server only)
export const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !service) {
    throw new Error('Missing Supabase admin env vars')
  }

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}