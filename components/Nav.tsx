'use client'
import { supabase } from '@/lib/supabase'

export default function Nav({ user, profile }: { user: any; profile: any }) {
  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href="/" className="nav-logo">TURF<span>ZONE</span></a>

        <div className="nav-links">
          {user ? (
            <>
              {/* Wallet balance chip */}
              {profile?.wallet_balance !== undefined && (
                <span style={{
                  fontSize: 13, color: 'var(--grass-bright)', fontWeight: 700,
                  background: 'rgba(64,145,108,0.12)', padding: '6px 12px',
                  borderRadius: 'var(--radius)', border: '1px solid rgba(64,145,108,0.25)'
                }}>
                  ₹{profile.wallet_balance}
                </span>
              )}

              {/* Tab-style nav links */}
              <div style={{ display: 'flex', gap: 4 }}>
                <a href="/" className="btn btn-ghost" style={{
                  padding: '7px 14px', fontSize: 13,
                  background: currentPath === '/' ? 'rgba(64,145,108,0.15)' : 'transparent',
                  color: currentPath === '/' ? 'var(--grass-bright)' : 'var(--text-muted)'
                }}>Book</a>

                <a href="/book" className="btn btn-ghost" style={{
                  padding: '7px 14px', fontSize: 13,
                  background: currentPath === '/book' ? 'rgba(64,145,108,0.15)' : 'transparent',
                  color: currentPath === '/book' ? 'var(--grass-bright)' : 'var(--text-muted)'
                }}>My Bookings</a>

                {profile?.role === 'admin' && (
                  <a href="/admin" className="btn btn-ghost" style={{
                    padding: '7px 14px', fontSize: 13,
                    background: currentPath === '/admin' ? 'rgba(64,145,108,0.15)' : 'transparent',
                    color: currentPath === '/admin' ? 'var(--grass-bright)' : 'var(--text-muted)'
                  }}>Admin</a>
                )}

                <button onClick={signOut} style={{
                  padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--card-border)',
                  color: 'var(--accent-red)', borderRadius: 'var(--radius)',
                  fontFamily: 'DM Sans, sans-serif'
                }}>Out</button>
              </div>
            </>
          ) : (
            <a href="/auth" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>Login</a>
          )}
        </div>
      </div>
    </nav>
  )
}