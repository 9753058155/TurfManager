'use client'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'

export default function Nav({ user, profile }: { user: any; profile: any }) {
  const [open, setOpen] = useState(false)

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href="/" className="nav-logo">TURF<span>ZONE</span></a>
        <div className="nav-links">
          {user ? (
            <>
              {profile?.wallet_balance !== undefined && (
                <span style={{ fontSize:14, color:'var(--grass-bright)', fontWeight:600, marginRight:8 }}>
                  ₹{profile.wallet_balance}
                </span>
              )}
              {profile?.role === 'admin' && (
                <a href="/admin" className="btn btn-ghost" style={{ padding:'8px 16px', fontSize:14 }}>Admin</a>
              )}
              <div style={{ position:'relative' }}>
                <button
                  className="btn btn-ghost"
                  style={{ padding:'8px 16px', fontSize:14 }}
                  onClick={() => setOpen(o => !o)}
                >
                  {profile?.full_name?.split(' ')[0] || 'Account'} ▾
                </button>
                {open && (
                  <div style={{
                    position:'absolute', right:0, top:'110%',
                    background:'var(--card)', border:'1px solid var(--card-border)',
                    borderRadius:'var(--radius)', padding:'8px', minWidth:160, zIndex:200
                  }}>
                    <a href="/" style={{ display:'block', padding:'10px 12px', fontSize:14, borderRadius:8 }}
                      onMouseOver={e=>(e.currentTarget.style.background='rgba(64,145,108,0.1)')}
                      onMouseOut={e=>(e.currentTarget.style.background='transparent')}
                    >Book Slots</a>
                    <a href="/book" style={{ display:'block', padding:'10px 12px', fontSize:14, borderRadius:8 }}
                      onMouseOver={e=>(e.currentTarget.style.background='rgba(64,145,108,0.1)')}
                      onMouseOut={e=>(e.currentTarget.style.background='transparent')}
                    >My Bookings</a>
                    <button
                      onClick={signOut}
                      style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 12px', fontSize:14,
                        background:'none', color:'var(--accent-red)', borderRadius:8, cursor:'pointer',
                        fontFamily:'DM Sans, sans-serif', border:'none'
                      }}
                    >Sign Out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <a href="/auth" className="btn btn-primary" style={{ padding:'8px 20px', fontSize:14 }}>Login</a>
          )}
        </div>
      </div>
    </nav>
  )
}
