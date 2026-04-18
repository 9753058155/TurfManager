type Slot = { id: string; date: string; start_time: string; end_time: string; price?: number }

export default function BookingModal({
  slot, profile, onConfirm, onClose
}: { slot: Slot; profile: any; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily:'Bebas Neue', fontSize:32, marginBottom:4 }}>CONFIRM BOOKING</h2>
        <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:24 }}>Review your slot before payment</p>

        <div style={{ background:'var(--night-soft)', borderRadius:'var(--radius)', padding:'16px 20px', marginBottom:24 }}>
          {[
            ['Date', slot.date],
            ['Time', `${slot.start_time} – ${slot.end_time}`],
            ['Duration', '60 minutes'],
            ['Amount', `₹${slot.price ?? 500}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--card-border)' }}>
              <span style={{ color:'var(--text-muted)', fontSize:14 }}>{k}</span>
              <span style={{ fontWeight:600, fontSize:14 }}>{v}</span>
            </div>
          ))}
        </div>

        {profile?.wallet_balance > 0 && (
          <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16, padding:'10px 14px', background:'rgba(64,145,108,0.08)', borderRadius:8 }}>
            💰 Wallet: ₹{profile.wallet_balance} (not used for payment, only for refunds)
          </div>
        )}

        <div style={{ display:'flex', gap:12 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-accent" style={{ flex:2 }} onClick={onConfirm}>
            Pay ₹{slot.price ?? 500} →
          </button>
        </div>

        <p style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', marginTop:14 }}>
          Secured by Razorpay. 50% refund on cancellation.
        </p>
      </div>
    </div>
  )
}
