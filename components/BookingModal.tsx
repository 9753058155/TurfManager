'use client'
import { useState } from 'react'

type Slot = { id: string; date: string; start_time: string; end_time: string; price?: number }

function toAmPm(t: string) {
  const [h, m] = t.split(':').map(Number)
  const p = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2,'0')} ${p}`
}

export default function BookingModal({
  slot, profile, onConfirm, onClose
}: {
  slot: Slot
  profile: any
  onConfirm: (walletAmount: number, razorpayAmount: number) => void
  onClose: () => void
}) {
  const slotPrice = slot.price ?? 500
  const walletBal = profile?.wallet_balance ?? 0

  // Wallet split calculation
  const walletUsed = Math.min(walletBal, slotPrice)
  const razorpayDue = slotPrice - walletUsed
  const [useWallet, setUseWallet] = useState(walletBal > 0)

  const effectiveWallet = useWallet ? walletUsed : 0
  const effectiveRazorpay = useWallet ? razorpayDue : slotPrice

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily:'Bebas Neue', fontSize:32, marginBottom:4 }}>CONFIRM BOOKING</h2>
        <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:20 }}>
          {toAmPm(slot.start_time)} – {toAmPm(slot.end_time)} · {slot.date}
        </p>

        {/* Summary rows */}
        <div style={{ background:'var(--night-soft)', borderRadius:'var(--radius)', padding:'14px 18px', marginBottom:16 }}>
          {[
            ['Slot Price', `₹${slotPrice}`],
            useWallet && walletUsed > 0 ? ['Wallet Used', `−₹${walletUsed}`] : null,
            ['Pay via Razorpay', `₹${effectiveRazorpay}`],
          ].filter(Boolean).map(([k, v]: any) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--card-border)' }}>
              <span style={{ color:'var(--text-muted)', fontSize:14 }}>{k}</span>
              <span style={{ fontWeight:600, fontSize:14, color: k === 'Wallet Used' ? 'var(--grass-bright)' : 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Wallet toggle */}
        {walletBal > 0 && (
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 14px', background:'rgba(64,145,108,0.08)',
            border:'1px solid rgba(64,145,108,0.2)', borderRadius:'var(--radius)', marginBottom:20
          }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--grass-bright)' }}>
                💰 Use Wallet Balance
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Available: ₹{walletBal}</div>
            </div>
            <button
              onClick={() => setUseWallet(u => !u)}
              style={{
                width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                background: useWallet ? 'var(--grass-light)' : 'var(--card-border)',
                position:'relative', transition:'background 0.2s'
              }}
            >
              <span style={{
                position:'absolute', top:3, left: useWallet ? 22 : 3,
                width:18, height:18, borderRadius:'50%', background:'white',
                transition:'left 0.2s', display:'block'
              }} />
            </button>
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" style={{ flex:2 }}
            onClick={() => onConfirm(effectiveWallet, effectiveRazorpay)}>
            {effectiveRazorpay === 0 ? `Pay ₹${effectiveWallet} from Wallet` : `Pay ₹${effectiveRazorpay} →`}
          </button>
        </div>

        <p style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', marginTop:12 }}>
          50% refund on cancellation · Secured by Razorpay
        </p>
      </div>
    </div>
  )
}