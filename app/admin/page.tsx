'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

// Convert "14:00" → "2:00 PM"
function toAmPm(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

const DEFAULT_PRICE_KEY = 'turf_default_price'

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [slotFees, setSlotFees] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [tab, setTab] = useState<'bookings'|'pricing'|'receipts'>('bookings')
  const [loading, setLoading] = useState(true)
  const [localPrices, setLocalPrices] = useState<Record<string, string>>({})
  const [editingSlot, setEditingSlot] = useState<string | null>(null)
  const [savingFee, setSavingFee] = useState(false)
  const [msg, setMsg] = useState<{text:string;type:string}|null>(null)

  // Default price state
  const [defaultPrice, setDefaultPrice] = useState<number>(500)
  const [editingDefault, setEditingDefault] = useState(false)
  const [tempDefault, setTempDefault] = useState<number>(500)
  const [applyingDefault, setApplyingDefault] = useState(false)

  const showMsg = (text: string, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const fetchReceipts = async () => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error) setReceipts(data ?? [])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/auth'; return }
      const { data: p, error } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single()
      if (error || p?.role !== 'admin') { window.location.href = '/'; return }
      setUser(data.user)
      setProfile(p)
      // Load saved default price from localStorage
      const saved = localStorage.getItem(DEFAULT_PRICE_KEY)
      if (saved) { setDefaultPrice(Number(saved)); setTempDefault(Number(saved)) }
      await Promise.all([fetchBookings(), fetchFees(), fetchReceipts()])
      setLoading(false)
    })
  }, [])

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('bookings').select('*')
      .order('created_at', { ascending: false }).limit(100)
    if (!error) setBookings(data ?? [])
  }

  const fetchFees = async () => {
    const { data, error } = await supabase
      .from('slot_fees').select('*')
      .order('slot_time', { ascending: true })
    if (!error) setSlotFees(data ?? [])
  }

  const cancelBookingAdmin = async (b: any) => {
    if (!confirm(`Cancel booking #${b.id.slice(0,8)}?\n100% refund (Rs.${b.amount}) will go to user wallet.`)) return
    const res = await fetch('/api/cancel-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: b.id, userId: b.user_id, isAdmin: true })
    })
    const json = await res.json()
    if (json.error) { showMsg(json.error, 'error'); return }
    showMsg('Booking cancelled. Full refund issued to wallet.')
    fetchBookings()
  }

  const releasePending = async (b: any) => {
    if (!confirm(`Release pending booking #${b.id.slice(0,8)}?\nNo refund — payment was never captured.`)) return
    const res = await fetch('/api/release-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: b.id, userId: b.user_id })
    })
    const json = await res.json()
    if (json.error) { showMsg(json.error, 'error'); return }
    showMsg('Slot released successfully.')
    fetchBookings()
  }

  // Save price for ONE specific slot using slot_time as the key
  const saveFee = async (slotTime: string) => {
    if (!user) return
    const price = Number(localPrices[slotTime])
    if (isNaN(price) || price < 0) { showMsg('Invalid price', 'error'); return }
    setSavingFee(true)
    const res = await fetch('/api/update-fee', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotTime, price, userId: user.id })
    })
    const json = await res.json()
    setSavingFee(false)
    if (json.error) { showMsg(json.error, 'error'); return }
    showMsg(`${toAmPm(slotTime)} updated to Rs.${price}`)
    setEditingSlot(null)
    setLocalPrices(prev => { const n = {...prev}; delete n[slotTime]; return n })
    fetchFees()
  }

  // Apply default price to ALL slots that haven't been individually overridden
  const applyDefaultToAll = async () => {
    if (!user) return
    if (!confirm(`Set ALL slot prices to Rs.${defaultPrice}? Individual overrides will be reset.`)) return
    setApplyingDefault(true)
    const res = await fetch('/api/update-fee', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applyToAll: true, price: defaultPrice, userId: user.id })
    })
    const json = await res.json()
    setApplyingDefault(false)
    if (json.error) { showMsg(json.error, 'error'); return }
    showMsg(`Default price Rs.${defaultPrice} applied to all slots.`)
    fetchFees()
  }

  const saveDefaultPrice = () => {
    setDefaultPrice(tempDefault)
    localStorage.setItem(DEFAULT_PRICE_KEY, String(tempDefault))
    setEditingDefault(false)
    showMsg(`Default price set to Rs.${tempDefault}. Click "Apply to All" to update all slots.`)
  }

  const stats = {
    total:     bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    pending:   bookings.filter(b => b.status === 'pending').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    revenue:   bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.amount || 0), 0),
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  )

  return (
    <>
      <Nav user={user} profile={profile} />
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 52, lineHeight: 0.9 }}>
            ADMIN<br /><span style={{ color: 'var(--grass-bright)' }}>DASHBOARD</span>
          </h1>
          <span className="badge badge-green">Admin</span>
        </div>

        {msg && (
          <div style={{
            padding: '13px 18px', borderRadius: 'var(--radius)', marginBottom: 24, fontSize: 14,
            background: msg.type === 'error' ? 'rgba(230,57,70,0.12)' : 'rgba(64,145,108,0.12)',
            color: msg.type === 'error' ? 'var(--accent-red)' : 'var(--grass-bright)',
            border: `1px solid ${msg.type === 'error' ? 'rgba(230,57,70,0.3)' : 'rgba(64,145,108,0.3)'}`
          }}>
            {msg.text}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14, marginBottom: 32 }}>
          {[
            { label: 'Total',     value: stats.total,           color: 'var(--text)' },
            { label: 'Confirmed', value: stats.confirmed,       color: 'var(--grass-bright)' },
            { label: 'Pending',   value: stats.pending,         color: 'var(--accent-gold)' },
            { label: 'Cancelled', value: stats.cancelled,       color: 'var(--accent-red)' },
            { label: 'Revenue',   value: `Rs.${stats.revenue}`, color: 'var(--accent-gold)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value" style={{ color: s.color, fontSize: 32 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ maxWidth: 360, marginBottom: 24 }}>
          {(['bookings', 'receipts', 'pricing'] as const).map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); setEditingSlot(null); setLocalPrices({}) }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* BOOKINGS TAB */}
        {tab === 'bookings' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 26 }}>ALL BOOKINGS</h3>
              <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }} onClick={fetchBookings}>
                Refresh
              </button>
            </div>
            {stats.pending > 0 && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13,
                background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)', color: 'var(--accent-gold)'
              }}>
                {stats.pending} pending booking{stats.pending > 1 ? 's' : ''} with uncaptured payment.
                Use Release Slot to free them.
              </div>
            )}
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Date</th><th>Time</th><th>Amount</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                      #{b.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td>{b.date}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {toAmPm(b.start_time)} - {toAmPm(b.end_time)}
                    </td>
                    <td style={{ color: 'var(--grass-bright)', fontWeight: 600 }}>Rs.{b.amount}</td>
                    <td>
                      <span className={`badge ${
                        b.status === 'confirmed' ? 'badge-green' :
                        b.status === 'cancelled' ? 'badge-red' : 'badge-yellow'
                      }`}>{b.status}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {b.status === 'confirmed' && (
                        <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 12 }}
                          onClick={() => cancelBookingAdmin(b)}>Cancel + Refund</button>
                      )}
                      {b.status === 'pending' && (
                        <button className="btn btn-ghost"
                          style={{ padding: '6px 14px', fontSize: 12, borderColor: 'rgba(255,214,10,0.4)', color: 'var(--accent-gold)' }}
                          onClick={() => releasePending(b)}>Release Slot</button>
                      )}
                      {b.status === 'cancelled' && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}>No bookings yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* RECEIPTS TAB */}
        {tab === 'receipts' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 26 }}>PAYMENT RECEIPTS</h3>
              <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }} onClick={fetchReceipts}>
                Refresh
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Slot</th>
                  <th>Amount</th>
                  <th>Payment ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--grass-bright)' }}>
                      {r.receipt_number}
                    </td>
                    <td>{r.date}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.start_time ? toAmPm(r.start_time) : '-'} - {r.end_time ? toAmPm(r.end_time) : '-'}
                    </td>
                    <td style={{ color: 'var(--grass-bright)', fontWeight: 600 }}>Rs.{r.amount}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.razorpay_payment_id}
                    </td>
                    <td><span className="badge badge-green">{r.status}</span></td>
                  </tr>
                ))}
                {receipts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}>
                      No receipts yet. Complete a payment to see receipts here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PRICING TAB */}
        {tab === 'pricing' && (
          <div>
            {/* Default Price Card */}
            <div className="card" style={{ marginBottom: 20, background: 'rgba(64,145,108,0.08)', borderColor: 'rgba(64,145,108,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--grass-bright)', fontWeight: 700, marginBottom: 4 }}>
                    Default Price (applied to all slots)
                  </div>
                  {editingDefault ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 18, fontFamily: 'Bebas Neue' }}>Rs.</span>
                      <input
                        className="input"
                        type="number" min={0}
                        value={tempDefault}
                        onChange={e => setTempDefault(Number(e.target.value))}
                        style={{ width: 110, padding: '8px 12px' }}
                        onKeyDown={e => e.key === 'Enter' && saveDefaultPrice()}
                        autoFocus
                      />
                      <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={saveDefaultPrice}>Save</button>
                      <button className="btn btn-ghost" style={{ padding: '8px 12px' }} onClick={() => { setEditingDefault(false); setTempDefault(defaultPrice) }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 42, color: 'var(--grass-bright)', lineHeight: 1 }}>
                      Rs.{defaultPrice}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Individual slots below can override this price
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {!editingDefault && (
                    <button className="btn btn-ghost" style={{ padding: '10px 18px' }}
                      onClick={() => { setEditingDefault(true); setTempDefault(defaultPrice) }}>
                      Change Default
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{ padding: '10px 18px' }}
                    onClick={applyDefaultToAll}
                    disabled={applyingDefault}
                  >
                    {applyingDefault ? <span className="spinner" /> : 'Apply to All Slots'}
                  </button>
                </div>
              </div>
            </div>

            {/* Per-slot pricing */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'Bebas Neue', fontSize: 26 }}>PER-SLOT PRICING</h3>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Override individual slots</span>
              </div>

              {slotFees.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No slot fees found. Run the SQL setup first.
                </div>
              ) : (
                <>
                  {(['day', 'night'] as const).map(group => {
                    const grouped = slotFees.filter(f =>
                      group === 'day'
                        ? (f.slot_type === 'day'  || (!f.slot_type && f.slot_time < '18:00'))
                        : (f.slot_type === 'night' || (!f.slot_type && f.slot_time >= '18:00'))
                    )
                    if (grouped.length === 0) return null
                    return (
                      <div key={group} style={{ marginBottom: 28 }}>
                        <div style={{
                          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
                          color: group === 'day' ? 'var(--accent-gold)' : '#7eb8f7', marginBottom: 10
                        }}>
                          {group === 'day' ? 'Day Slots (6 AM - 6 PM)' : 'Night Slots (6 PM - 10 PM)'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                          {grouped.map(f => {
                            const isEditing = editingSlot === f.slot_time
                            const [h, mins] = f.slot_time.split(':').map(Number)
                            const endTime = `${String(h+1).padStart(2,'0')}:${String(mins).padStart(2,'0')}`
                            const isDefault = f.price === defaultPrice
                            const inputVal = localPrices[f.slot_time] ?? String(f.price)

                            return (
                              <div key={f.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 14px', background: 'var(--night-soft)',
                                borderRadius: 'var(--radius)', gap: 10,
                                border: isEditing ? '1px solid var(--grass-light)' : '1px solid transparent'
                              }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, lineHeight: 1.1 }}>
                                    {toAmPm(f.slot_time)} - {toAmPm(endTime)}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: 'var(--grass-bright)' }}>
                                      Rs.{isEditing ? (localPrices[f.slot_time] ?? f.price) : f.price}
                                    </span>
                                    {isDefault && !isEditing && (
                                      <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(122,158,142,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                                        default
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                    <input
                                      className="input"
                                      type="number" min={0}
                                      value={inputVal}
                                      onChange={e => setLocalPrices(prev => ({ ...prev, [f.slot_time]: e.target.value }))}
                                      style={{ width: 80, padding: '7px 8px', fontSize: 14 }}
                                      onKeyDown={e => e.key === 'Enter' && saveFee(f.slot_time)}
                                      autoFocus
                                    />
                                    <button className="btn btn-primary" style={{ padding: '7px 12px', fontSize: 13 }}
                                      onClick={() => saveFee(f.slot_time)} disabled={savingFee}>
                                      {savingFee ? <span className="spinner" /> : 'Save'}
                                    </button>
                                    <button className="btn btn-ghost" style={{ padding: '7px 10px', fontSize: 13 }}
                                      onClick={() => { setEditingSlot(null); setLocalPrices(prev => { const n={...prev}; delete n[f.slot_time]; return n }) }}>X</button>
                                  </div>
                                ) : (
                                  <button className="btn btn-ghost"
                                    style={{ padding: '7px 14px', fontSize: 12, flexShrink: 0 }}
                                    onClick={() => { setEditingSlot(f.slot_time); setLocalPrices(prev => ({ ...prev, [f.slot_time]: String(f.price) })) }}>
                                    Edit
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}