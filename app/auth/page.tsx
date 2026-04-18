'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{text:string;type:'error'|'success'}|null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg({ text: error.message, type: 'error' })
    else window.location.href = '/'
    setLoading(false)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setMsg(null)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setMsg({ text: error.message, type: 'error' }); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: name,
        phone,
        wallet_balance: 0,
        role: 'user'
      })
      setMsg({ text: 'Account created! Please verify your email.', type: 'success' })
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">TURF<span>ZONE</span></div>
        <p className="auth-subtitle">Book your perfect slot</p>

        <div className="tabs">
          <button className={`tab-btn ${tab==='login'?'active':''}`} onClick={()=>setTab('login')}>Login</button>
          <button className={`tab-btn ${tab==='signup'?'active':''}`} onClick={()=>setTab('signup')}>Sign Up</button>
        </div>

        {msg && (
          <div style={{
            padding:'12px 16px', borderRadius:'var(--radius)', marginBottom:20, fontSize:14,
            background: msg.type==='error' ? 'rgba(230,57,70,0.12)' : 'rgba(64,145,108,0.12)',
            color: msg.type==='error' ? 'var(--accent-red)' : 'var(--grass-bright)',
            border: `1px solid ${msg.type==='error' ? 'rgba(230,57,70,0.3)' : 'rgba(64,145,108,0.3)'}`
          }}>
            {msg.text}
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label>Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom:24 }}>
              <label>Password</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom:16 }}>
              <label>Full Name</label>
              <input className="input" type="text" placeholder="Rahul Kumar" value={name} onChange={e=>setName(e.target.value)} required />
            </div>
            <div style={{ marginBottom:16 }}>
              <label>Phone</label>
              <input className="input" type="tel" placeholder="+91 98765 43210" value={phone} onChange={e=>setPhone(e.target.value)} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label>Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom:24 }}>
              <label>Password</label>
              <input className="input" type="password" placeholder="Min 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        )}

        <div style={{ textAlign:'center', marginTop:20, fontSize:14, color:'var(--text-muted)' }}>
          <a href="/" style={{ color:'var(--grass-bright)' }}>← Back to home</a>
        </div>
      </div>
    </div>
  )
}
