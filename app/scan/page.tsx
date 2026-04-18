'use client'
import { useState, useRef } from 'react'
import Nav from '@/components/Nav'

export default function ScanPage() {
  const [token, setToken] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const verify = async () => {
    if (!token.trim()) return
    setLoading(true)
    const res = await fetch(`/api/verify-qr?token=${encodeURIComponent(token.trim())}`)
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <>
      <Nav user={null} profile={null} />
      <div className="container" style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 500 }}>
        <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 52, marginBottom: 8 }}>
          QR <span style={{ color: 'var(--grass-bright)' }}>VERIFY</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          Paste QR token from scan to verify entry
        </p>

        <div className="card" style={{ marginBottom: 24 }}>
          <label>QR Token</label>
          <textarea
            className="input"
            rows={4}
            placeholder="Paste scanned QR code token here..."
            value={token}
            onChange={e => setToken(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          <button
            className="btn btn-primary w-full"
            style={{ marginTop: 16 }}
            onClick={verify}
            disabled={loading || !token.trim()}
          >
            {loading ? <span className="spinner" /> : 'Verify Entry'}
          </button>
        </div>

        {result && (
          <div style={{
            padding: 24,
            borderRadius: 'var(--radius-lg)',
            border: `2px solid ${result.valid ? 'var(--grass-bright)' : 'var(--accent-red)'}`,
            background: result.valid ? 'rgba(64,145,108,0.1)' : 'rgba(230,57,70,0.1)'
          }}>
            <div style={{
              fontFamily: 'Bebas Neue',
              fontSize: 36,
              color: result.valid ? 'var(--grass-bright)' : 'var(--accent-red)',
              marginBottom: 12
            }}>
              {result.valid ? '✅ ENTRY ALLOWED' : '❌ ENTRY DENIED'}
            </div>
            {result.valid ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Date', result.booking.date],
                  ['Slot', `${result.booking.startTime} – ${result.booking.endTime}`],
                  ['Booking ID', `#${result.booking.id?.slice(0,8).toUpperCase()}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--accent-red)', fontSize: 14 }}>{result.reason}</p>
            )}
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
          In production: integrate a camera-based QR scanner library like <code>html5-qrcode</code>
        </p>
      </div>
    </>
  )
}
