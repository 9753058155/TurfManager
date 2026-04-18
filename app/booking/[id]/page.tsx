'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

function toAmPm(t: string) {
  if (!t) return t
  const [h, m] = t.split(':').map(Number)
  const p = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2,'0')} ${p}`
}

export default function BookingPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [booking, setBooking] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [msg, setMsg] = useState<{text:string;type:string}|null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadQR = async () => {
    try {
      const res = await fetch(`/api/verify-qr?bookingId=${id}&generate=true`)
      const { qrDataUrl } = await res.json()
      if (qrDataUrl) setQrUrl(qrDataUrl)
    } catch {}
  }

  const loadBooking = async (uid: string) => {
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', id).single(),
      supabase.from('profiles').select('*').eq('id', uid).single()
    ])
    setBooking(b)
    setProfile(p)
    setLoading(false)
    return b
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/auth'; return }
      setUser(data.user)

      const b = await loadBooking(data.user.id)

      if (b?.status === 'confirmed') {
        loadQR()
      } else if (b?.status === 'pending') {
        // Poll every 2s for up to 30s waiting for webhook/verify to confirm
        let attempts = 0
        pollRef.current = setInterval(async () => {
          attempts++
          const { data: fresh } = await supabase
            .from('bookings').select('*').eq('id', id).single()
          if (fresh?.status === 'confirmed') {
            setBooking(fresh)
            clearInterval(pollRef.current!)
            loadQR()
          } else if (fresh?.status === 'cancelled' || attempts >= 15) {
            setBooking(fresh)
            clearInterval(pollRef.current!)
          }
        }, 2000)
      }
    })
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [id])

  const handleCancel = async () => {
    if (!confirm('Cancel this booking? You will receive 50% refund to your wallet.')) return
    setCancelling(true)
    try {
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id, userId: user.id })
      })
      const { error, refundAmount } = await res.json()
      if (error) throw new Error(error)
      setMsg({ text: `Cancelled. ₹${refundAmount} added to your wallet.`, type: 'success' })
      const { data } = await supabase.from('bookings').select('*').eq('id', id).single()
      setBooking(data)
      setQrUrl(null)
    } catch(e: any) {
      setMsg({ text: e.message, type: 'error' })
    }
    setCancelling(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="spinner" style={{ width:40, height:40, borderWidth:3 }} />
    </div>
  )

  if (!booking) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <p style={{ color:'var(--text-muted)' }}>Booking not found.</p>
      <a href="/" className="btn btn-ghost">← Home</a>
    </div>
  )

  const statusBadge = booking.status === 'confirmed' ? 'badge-green' :
                      booking.status === 'cancelled' ? 'badge-red' : 'badge-yellow'

  return (
    <>
      <Nav user={user} profile={profile} />
      <div className="container" style={{ paddingTop:40, paddingBottom:60 }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:32 }}>
            <div>
              <a href="/" style={{ fontSize:13, color:'var(--text-muted)', display:'block', marginBottom:8 }}>← Back</a>
              <h1 style={{ fontFamily:'Bebas Neue', fontSize:40 }}>BOOKING DETAILS</h1>
            </div>
            <span className={`badge ${statusBadge}`}>{booking.status}</span>
          </div>

          {msg && (
            <div style={{
              padding:'14px 18px', borderRadius:'var(--radius)', marginBottom:20, fontSize:14,
              background: msg.type==='error' ? 'rgba(230,57,70,0.12)' : 'rgba(64,145,108,0.12)',
              color: msg.type==='error' ? 'var(--accent-red)' : 'var(--grass-bright)',
              border: `1px solid ${msg.type==='error' ? 'rgba(230,57,70,0.3)' : 'rgba(64,145,108,0.3)'}`
            }}>
              {msg.text}
            </div>
          )}

          {/* QR Code — confirmed */}
          {booking.status === 'confirmed' && (
            <div className="card" style={{ textAlign:'center', marginBottom:24 }}>
              <h3 style={{ fontFamily:'Bebas Neue', fontSize:24, marginBottom:16, color:'var(--grass-bright)' }}>
                YOUR ENTRY QR CODE
              </h3>
              {qrUrl ? (
                <>
                  <div className="qr-container">
                    <img src={qrUrl} alt="Entry QR Code" style={{ width:220, height:220 }} />
                  </div>
                  <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:12 }}>
                    Show at entrance. Valid for your slot only.
                  </p>
                </>
              ) : (
                <div style={{ padding:'30px 0', color:'var(--text-muted)' }}>
                  <div className="spinner" style={{ width:28, height:28, borderWidth:2, margin:'0 auto' }} />
                  <p style={{ marginTop:12, fontSize:14 }}>Generating QR code...</p>
                </div>
              )}
            </div>
          )}

          {/* Pending — polling */}
          {booking.status === 'pending' && (
            <div style={{
              padding:'20px', borderRadius:'var(--radius)', marginBottom:24,
              background:'rgba(255,214,10,0.08)', border:'1px solid rgba(255,214,10,0.2)',
              color:'var(--accent-gold)', textAlign:'center'
            }}>
              <div className="spinner" style={{ width:24, height:24, borderWidth:2, margin:'0 auto 12px', borderTopColor:'var(--accent-gold)', borderColor:'rgba(255,214,10,0.2)' }} />
              <div style={{ fontWeight:600, marginBottom:4 }}>Confirming your payment...</div>
              <div style={{ fontSize:13 }}>This takes a few seconds. Do not close this page.</div>
            </div>
          )}

          {/* Booking info */}
          <div className="card" style={{ marginBottom:24 }}>
            <h3 style={{ fontFamily:'Bebas Neue', fontSize:22, marginBottom:20 }}>SLOT INFORMATION</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {[
                { label:'Date', value: booking.date },
                { label:'Time', value: `${toAmPm(booking.start_time)} – ${toAmPm(booking.end_time)}` },
                { label:'Amount', value: `₹${booking.amount}` },
                { label:'Name', value: booking.user_name || '—' },
                { label:'Phone', value: booking.user_phone || '—' },
                { label:'Booking ID', value: `#${id.slice(0,8).toUpperCase()}` },
                booking.payment_id ? { label:'Payment ID', value: booking.payment_id.slice(0, 20) + '...' } : null,
                { label:'Booked On', value: new Date(booking.created_at).toLocaleDateString('en-IN') },
              ].filter(Boolean).map((item: any, i) => (
                <div key={i}>
                  <div style={{ fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize:14, fontWeight:500, wordBreak:'break-all' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Wallet */}
          {profile && (
            <div className="card" style={{ marginBottom:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Wallet Balance</div>
                  <div style={{ fontFamily:'Bebas Neue', fontSize:36, color:'var(--grass-bright)' }}>₹{profile.wallet_balance}</div>
                </div>
                <span style={{ fontSize:36 }}>💰</span>
              </div>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <button className="btn btn-danger w-full" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <span className="spinner" /> : 'Cancel Booking (50% Refund)'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}