'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import Toast from '@/components/Toast'
import BookingModal from '@/components/BookingModal'
import { format, addDays } from 'date-fns'

declare global { interface Window { Razorpay: any } }

type SlotFee = { id: string; slot_type: string; slot_time: string; price: number; duration_minutes: number }
type Slot = { id: string; date: string; start_time: string; end_time: string; status: 'available'|'locked'|'booked'; price?: number }

function toAmPm(t: string) {
  const [h, m] = t.split(':').map(Number)
  const p = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2,'0')} ${p}`
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
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
    const { data: fees } = await supabase.from('slot_fees').select('*')
    if (fees) setSlotFees(fees)

    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, end_time, status, lock_expires_at')
      .eq('date', selectedDate)
      .in('status', ['confirmed', 'pending'])

    const generated: Slot[] = []
    for (let h = 6; h < 22; h++) {
      const start = `${String(h).padStart(2,'0')}:00`
      const end = `${String(h+1).padStart(2,'0')}:00`
      const now = new Date()
      const isBooked = bookings?.some(b => {
        if (b.start_time !== start) return false
        if (b.status === 'confirmed') return true
        // pending: only block if lock not expired (lock_expires_at exists and is in future)
        if (b.status === 'pending') {
          if (!b.lock_expires_at) return true // no expiry set, treat as blocked
          return new Date(b.lock_expires_at) > now
        }
        return false
      }) || false
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

  useEffect(() => {
    // Realtime: any change to bookings triggers a slot refresh
    // No filter — filters in realtime require special Supabase config, just refresh always
    const channel = supabase
      .channel('bookings-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings'
      }, () => fetchSlots())
      .subscribe()

    // Polling fallback every 20s in case realtime misses events
    const poll = setInterval(fetchSlots, 20000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [selectedDate, fetchSlots])

  const handleSlotClick = (slot: Slot) => {
    if (slot.status === 'booked' || slot.status === 'locked') return
    if (!user) { window.location.href = '/auth'; return }
    setSelectedSlot(slot)
    setBookingModal(true)
  }

  // walletAmount: deducted from wallet, razorpayAmount: charged via Razorpay
  const handlePayment = async (slot: Slot, walletAmount: number, razorpayAmount: number) => {
    if (!user || !profile) return
    setBookingModal(false)

    try {
      // Create order on backend
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: slot.price, razorpayAmount, walletAmount, slot, userId: user.id })
      })
      const { orderId, bookingId, error, walletOnly } = await res.json()
      if (error) { toast(error, 'error'); return }

      // Wallet-only payment (no Razorpay needed)
      if (walletOnly) {
        toast('Booking confirmed using wallet!', 'success')
        fetchSlots()
        fetchProfile(user.id)
        setTimeout(() => window.location.href = `/booking/${bookingId}`, 1000)
        return
      }

      // Razorpay payment
      const rzpKey = (window as any).__NEXT_PUBLIC_RAZORPAY_KEY_ID
        || document.querySelector('meta[name="rzp-key"]')?.getAttribute('content')
        || ''

      if (!rzpKey) { toast('Payment config missing. Contact support.', 'error'); return }

      // iOS Safari: Razorpay hosted checkout page avoids popup blocker
      if (isIOS()) {
        // Store bookingId so we can verify after redirect returns
        sessionStorage.setItem('pending_booking_id', bookingId)
        sessionStorage.setItem('pending_wallet_amount', String(walletAmount))
        window.location.href =
          `https://api.razorpay.com/v1/checkout/embedded?` +
          `key_id=${rzpKey}` +
          `&order_id=${orderId}` +
          `&name=TurfZone` +
          `&description=${encodeURIComponent(toAmPm(slot.start_time) + ' - ' + toAmPm(slot.end_time))}` +
          `&prefill[name]=${encodeURIComponent(profile.full_name || '')}` +
          `&prefill[email]=${encodeURIComponent(user.email || '')}` +
          `&callback_url=${encodeURIComponent(window.location.origin + '/api/razorpay-callback')}` +
          `&cancel_url=${encodeURIComponent(window.location.origin + '/')}`
        return
      }

      // Desktop/Android: standard popup
      const options = {
        key: rzpKey,
        amount: razorpayAmount * 100,
        currency: 'INR',
        name: 'TurfZone',
        description: `${toAmPm(slot.start_time)} – ${toAmPm(slot.end_time)}`,
        order_id: orderId,
        prefill: { name: profile.full_name, email: user.email },
        theme: { color: '#40916c' },
        handler: async (response: any) => {
          toast('Verifying payment...', 'info')
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId, walletAmount
            })
          })
          const result = await verifyRes.json()
          if (result.error) { toast('Verification failed: ' + result.error, 'error'); return }
          toast('Booking confirmed!', 'success')
          fetchSlots()
          fetchProfile(user.id)
          setTimeout(() => window.location.href = `/booking/${bookingId}`, 1000)
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

      <div className="hero">
        <div className="hero-title">BOOK YOUR<br /><em>TURF</em> NOW</div>
        <p className="hero-sub">Premium grass. Prime slots. Pay & play.</p>
      </div>

      <div className="container">
        {/* Wallet strip — only shown when logged in */}
        {profile && (
          <div style={{ marginBottom: 24 }}>
            <div className="stat-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
              <span style={{ fontSize: 22 }}>💰</span>
              <div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: 'var(--grass-bright)', lineHeight: 1 }}>
                  ₹{profile.wallet_balance ?? 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Wallet Balance
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date selector */}
        <div className="section">
          <h2 className="section-title">SELECT DATE</h2>
          <p className="section-sub">7-day advance booking</p>
          <div className="date-strip">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              return (
                <div key={dateStr} className={`date-chip ${selectedDate === dateStr ? 'active' : ''}`}
                  onClick={() => setSelectedDate(dateStr)}>
                  <div className="date-chip-day">{format(day, 'EEE')}</div>
                  <div className="date-chip-num">{format(day, 'd')}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Slot grid */}
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <h2 className="section-title">AVAILABLE SLOTS</h2>
              <p className="section-sub" style={{ marginBottom:0 }}>
                {format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d')}
              </p>
            </div>
            <div style={{ display:'flex', gap:12, fontSize:13, color:'var(--text-muted)' }}>
              <span>🟢 Free</span>
              <span>🔴 Booked</span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <div className="spinner" style={{ width:36, height:36, borderWidth:3 }} />
              <p style={{ marginTop:16, color:'var(--text-muted)' }}>Loading slots...</p>
            </div>
          ) : (
            <div className="slot-grid" style={{ marginBottom: 60 }}>
              {slots.map(slot => (
                <div key={slot.id}
                  className={`slot-card ${statusColor(slot)}`}
                  onClick={() => slot.status === 'available' && handleSlotClick(slot)}
                  style={{ cursor: slot.status === 'booked' ? 'not-allowed' : 'pointer' }}
                >
                  <div className="slot-time">{toAmPm(slot.start_time)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0' }}>
                    to {toAmPm(slot.end_time)}
                  </div>
                  {slot.status === 'available' && (
                    <div className="slot-price">₹{slot.price}</div>
                  )}
                  <div className="slot-status">
                    {slot.status === 'booked' ? '● Booked' : '○ Free'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {bookingModal && selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          profile={profile}
          onConfirm={(walletAmt, rzpAmt) => handlePayment(selectedSlot, walletAmt, rzpAmt)}
          onClose={() => setBookingModal(false)}
        />
      )}

      <Toast toasts={toasts} />
    </>
  )
}