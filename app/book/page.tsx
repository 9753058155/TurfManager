'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

export default function MyBookingsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/auth'; return }
      setUser(data.user)
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', data.user.id).single(),
        supabase.from('bookings').select('*').eq('user_id', data.user.id).order('created_at', { ascending: false })
      ])
      setProfile(p)
      setBookings(b ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  )

  return (
    <>
      <Nav user={user} profile={profile} />
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 48 }}>MY <span style={{ color: 'var(--grass-bright)' }}>BOOKINGS</span></h1>
            <p style={{ color: 'var(--text-muted)' }}>All your turf reservations</p>
          </div>
          {profile && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wallet</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: 'var(--grass-bright)' }}>₹{profile.wallet_balance}</div>
            </div>
          )}
        </div>

        {bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🏟️</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 18 }}>No bookings yet</p>
            <a href="/" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>Book a Slot</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bookings.map(b => (
              <a key={b.id} href={`/booking/${b.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'border-color 0.2s', cursor: 'pointer',
                  flexWrap: 'wrap', gap: 16
                }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--grass-light)')}
                  onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                >
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <div style={{
                      background: 'var(--night-soft)', borderRadius: 'var(--radius)',
                      padding: '12px 16px', textAlign: 'center', minWidth: 64
                    }}>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--grass-bright)', lineHeight: 1 }}>
                        {b.date?.split('-')[2]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {new Date(b.date + 'T00:00:00').toLocaleString('en-IN', { month: 'short' })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{b.start_time} – {b.end_time}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>#{b.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--grass-bright)' }}>₹{b.amount}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(b.created_at).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <span className={`badge ${
                      b.status === 'confirmed' ? 'badge-green' :
                      b.status === 'cancelled' ? 'badge-red' : 'badge-yellow'
                    }`}>{b.status}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
