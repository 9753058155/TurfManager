'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import Toast from '@/components/Toast'
import BookingModal from '@/components/BookingModal'
import { format, addDays } from 'date-fns'

declare global { interface Window { Razorpay: any } }

type SlotFee = { id: string; slot_type: string; slot_time: string; price: number; duration_minutes: number }
type Slot = {
  id: string; date: string; start_time: string; end_time: string
  status: 'available' | 'locked' | 'booked'; price?: number
}

function getNextDays(n: number) {
  return Array.from({ length: n }, (_, i) => addDays(new Date(), i))
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotFees, setSlotFees] = useState<SlotFee[]>([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [bookingModal, setBookingModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<{id:number;msg:string;type:string}[]>([])
  const days = getNextDays(7)

  const toast = (msg: string, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchProfile(data.user.id)
    })
    supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })
  }, [])

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    setProfile(data)
  }

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    // fetch slot fees
    const { data: fees } = await supabase.from('slot_fees').select('*')
    if (fees) setSlotFees(fees)

    // fetch bookings for date to know which slots are taken
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, end_time, status')
      .eq('date', selectedDate)
      .in('status', ['confirmed', 'pending'])

    // Generate 6am-10pm time slots (1 hour each)
    const generated: Slot[] = []
    for (let h = 6; h < 22; h++) {
      const start = `${String(h).padStart(2,'0')}:00`
      const end = `${String(h+1).padStart(2,'0')}:00`
      const isBooked = bookings?.some(b => b.start_time === start) || false
      const fee = fees?.find(f => f.slot_time === start)
      generated.push({
        id: `${selectedDate}-${start}`,
        date: selectedDate,
        start_time: start,
        end_time: end,
        status: isBooked ? 'booked' : 'available',
        price: fee?.price ?? 500
      })
    }
    setSlots(generated)
    setLoading(false)
  }, [selectedDate])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  // Realtime: listen to booking changes for this date
  useEffect(() => {
    const channel = supabase
      .channel(`slots-${selectedDate}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'booking',
        filter: `date=eq.${selectedDate}`
      }, () => fetchSlots())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedDate, fetchSlots])

  const handleSlotClick = (slot: Slot) => {
    if (slot.status === 'booked' || slot.status === 'locked') return
    if (!user) { window.location.href = '/auth'; return }
    setSelectedSlot(slot)
    setBookingModal(true)
  }

  const handlePayment = async (slot: Slot) => {
    if (!user || !profile) return
    setBookingModal(false)
    
    try {
      // Create Razorpay order via API
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: slot.price,
          slot: slot,
          userId: user.id
        })
      })
      const { orderId, bookingId, error } = await res.json()
      if (error) { toast(error, 'error'); return }

      // Read key from meta tag injected by layout, or window global
      const rzpKey = (window as any).__NEXT_PUBLIC_RAZORPAY_KEY_ID
        || document.querySelector('meta[name="rzp-key"]')?.getAttribute('content')
        || ''

      if (!rzpKey) {
        toast('Razorpay key not configured. Check NEXT_PUBLIC_RAZORPAY_KEY_ID env var.', 'error')
        return
      }

      const options = {
        key: rzpKey,
        amount: (slot.price || 500) * 100,
        currency: 'INR',
        name: 'TurfZone',
        description: `Slot: ${slot.start_time} - ${slot.end_time}`,
        order_id: orderId,
        prefill: { name: profile.full_name, email: user.email },
        theme: { color: '#40916c' },
        config: {
          display: {
            blocks: {
              banks: { name: 'Pay via Netbanking', instruments: [{ method: 'netbanking' }] },
              upi:   { name: 'Pay via UPI',        instruments: [{ method: 'upi' }] },
              card:  { name: 'Pay via Card',        instruments: [{ method: 'card' }] },
            },
            sequence: ['block.upi', 'block.banks', 'block.card'],
            preferences: { show_default_blocks: true }
          }
        },
        handler: async (response: any) => {
          // Verify payment signature on backend — source of truth
          toast('Verifying payment...', 'info')
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId,
              })
            })
            const result = await verifyRes.json()
            if (result.error) {
              toast('Payment verification failed: ' + result.error, 'error')
              return
            }
            toast('Payment confirmed! Booking created.', 'success')
            fetchSlots()
            setTimeout(() => window.location.href = `/booking/${bookingId}`, 1200)
          } catch {
            // Webhook will still confirm as fallback
            toast('Payment done! Booking confirming...', 'info')
            setTimeout(() => window.location.href = `/booking/${bookingId}`, 1500)
          }
        },
        modal: {
          ondismiss: async () => {
            await fetch('/api/release-booking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId, userId: user.id })
            })
            toast('Payment cancelled. Slot is free again.', 'info')
            fetchSlots()
          }
        }
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (e: any) {
      toast(e.message || 'Payment failed', 'error')
    }
  }

  const statusColor = (s: Slot) => {
    if (s.status === 'booked') return 'slot-booked'
    if (s.status === 'locked') return 'slot-locked'
    if (selectedSlot?.id === s.id) return 'slot-selected'
    return ''
  }

  return (
    <>
      <Nav user={user} profile={profile} />

      {/* Hero */}
      <div className="hero">
        <div className="hero-title">BOOK YOUR<br /><em>TURF</em> NOW</div>
        <p className="hero-sub">Premium grass. Prime slots. Pay & play.</p>
      </div>

      {/* Main Content */}
      <div className="container">
        {/* Stats strip */}
        {profile && (
          <div style={{ display:'flex', gap:12, marginBottom:32, flexWrap:'wrap' }}>
            <div className="stat-card" style={{ flex:1, minWidth:160 }}>
              <div className="stat-value">₹{profile.wallet_balance ?? 0}</div>
              <div className="stat-label">Wallet Balance</div>
            </div>
            <div className="stat-card" style={{ flex:1, minWidth:160 }}>
              <div className="stat-value" style={{ color:'var(--accent)' }}>IST</div>
              <div className="stat-label">All times in IST</div>
            </div>
          </div>
        )}

        {/* Date selector */}
        <div className="section">
          <h2 className="section-title">SELECT DATE</h2>
          <p className="section-sub">7-day advance booking available</p>
          <div className="date-strip">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              return (
                <div
                  key={dateStr}
                  className={`date-chip ${selectedDate === dateStr ? 'active' : ''}`}
                  onClick={() => setSelectedDate(dateStr)}
                >
                  <div className="date-chip-day">{format(day, 'EEE')}</div>
                  <div className="date-chip-num">{format(day, 'd')}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Slot grid */}
        <div className="section" style={{ paddingTop:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 className="section-title">AVAILABLE SLOTS</h2>
              <p className="section-sub" style={{ marginBottom:0 }}>{format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')}</p>
            </div>
            <div style={{ display:'flex', gap:16, fontSize:13, color:'var(--text-muted)' }}>
              <span>🟢 Available</span>
              <span>🟡 Locked</span>
              <span>🔴 Booked</span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}>
              <div className="spinner" style={{ width:36, height:36, borderWidth:3 }} />
              <p style={{ marginTop:16 }}>Loading slots...</p>
            </div>
          ) : (
            <div className="slot-grid">
              {slots.map(slot => (
                <div
                  key={slot.id}
                  className={`slot-card ${statusColor(slot)}`}
                  onClick={() => handleSlotClick(slot)}
                >
                  <div className="slot-time">{slot.start_time}–{slot.end_time}</div>
                  <div className="slot-price">₹{slot.price}</div>
                  <div className="slot-status">
                    {slot.status === 'booked' ? '● Booked' :
                     slot.status === 'locked' ? '◌ Locked' : '○ Free'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pricing info */}
        <div className="card" style={{ marginBottom:60 }}>
          <h3 style={{ fontFamily:'Bebas Neue', fontSize:24, marginBottom:16 }}>PRICING</h3>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {slotFees.map(f => (
              <div key={f.id} style={{ flex:1, minWidth:140 }}>
                <div style={{ fontSize:13, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  {f.slot_time} ({f.slot_type}) slot
                </div>
                <div style={{ fontFamily:'Bebas Neue', fontSize:36, color:'var(--grass-bright)' }}>₹{f.price}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>{f.duration_minutes} minutes</div>
              </div>
            ))}
            {slotFees.length === 0 && (
              <>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'var(--text-muted)', textTransform:'uppercase' }}>Day (6am–6pm)</div>
                  <div style={{ fontFamily:'Bebas Neue', fontSize:36, color:'var(--grass-bright)' }}>₹500</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'var(--text-muted)', textTransform:'uppercase' }}>Night (6pm–10pm)</div>
                  <div style={{ fontFamily:'Bebas Neue', fontSize:36, color:'var(--grass-bright)' }}>₹700</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Booking confirmation modal */}
      {bookingModal && selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          profile={profile}
          onConfirm={() => handlePayment(selectedSlot)}
          onClose={() => setBookingModal(false)}
        />
      )}

      {/* Toasts */}
      <Toast toasts={toasts} />
    </>
  )
}