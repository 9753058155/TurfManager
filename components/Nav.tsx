'use client'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'

export default function Nav({ user, profile }: { user: any; profile: any }) {
  const [currentPath, setCurrentPath] = useState('/')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setCurrentPath(window.location.pathname)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const isActive = (path: string) => currentPath === path

  return (
    <nav className="nav">
      <div className="nav-inner">
        {/* Logo */}
        <a href="/" className="nav-logo">TURF<span>ZONE</span></a>

        {user ? (
          <>
            {/* Desktop nav */}
            <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* Nav links */}
              <div style={{ display: 'flex', gap: 2, background: 'var(--night-soft)', padding: 4, borderRadius: 10 }}>
                {[
                  { href: '/', label: 'Book' },
                  { href: '/book', label: 'My Bookings' },
                  ...(profile?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : [])
                ].map(({ href, label }) => (
                  <a key={href} href={href} style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    textDecoration: 'none', transition: 'all 0.15s',
                    background: isActive(href) ? 'var(--grass)' : 'transparent',
                    color: isActive(href) ? 'white' : 'var(--text-muted)',
                  }}>{label}</a>
                ))}
              </div>

              {/* Wallet */}
              {profile?.wallet_balance !== undefined && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10,
                  background: 'rgba(64,145,108,0.1)', border: '1px solid rgba(64,145,108,0.2)'
                }}>
                  <span style={{ fontSize: 15 }}>💰</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--grass-bright)' }}>
                    ₹{profile.wallet_balance}
                  </span>
                </div>
              )}

              {/* Sign out */}
              <button onClick={signOut} style={{
                padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.2)',
                color: 'var(--accent-red)', borderRadius: 8, fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.15s'
              }}>Sign Out</button>
            </div>

            {/* Mobile: hamburger */}
            <div className="show-mobile" style={{ display: 'none', alignItems: 'center', gap: 10 }}>
              {profile?.wallet_balance !== undefined && (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--grass-bright)' }}>
                  ₹{profile.wallet_balance}
                </span>
              )}
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  background: 'var(--night-soft)', border: '1px solid var(--card-border)',
                  borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text)',
                  fontSize: 18, fontFamily: 'DM Sans, sans-serif'
                }}
              >{menuOpen ? '✕' : '☰'}</button>
            </div>
          </>
        ) : (
          <a href="/auth" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>Login</a>
        )}
      </div>

      {/* Mobile dropdown */}
      {user && menuOpen && (
        <div style={{
          background: 'var(--card)', borderTop: '1px solid var(--card-border)',
          padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4
        }}>
          {[
            { href: '/', label: '🏟 Book Slots' },
            { href: '/book', label: '📋 My Bookings' },
            ...(profile?.role === 'admin' ? [{ href: '/admin', label: '⚙️ Admin' }] : [])
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{
              padding: '11px 14px', borderRadius: 8, fontSize: 14,
              background: isActive(href) ? 'rgba(64,145,108,0.12)' : 'transparent',
              color: isActive(href) ? 'var(--grass-bright)' : 'var(--text)',
              textDecoration: 'none', fontWeight: isActive(href) ? 600 : 400
            }}>{label}</a>
          ))}
          <div style={{ height: 1, background: 'var(--card-border)', margin: '4px 0' }} />
          <button onClick={signOut} style={{
            padding: '11px 14px', borderRadius: 8, fontSize: 14, textAlign: 'left',
            background: 'rgba(230,57,70,0.08)', color: 'var(--accent-red)',
            border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
          }}>Sign Out</button>
        </div>
      )}
    </nav>
  )
}