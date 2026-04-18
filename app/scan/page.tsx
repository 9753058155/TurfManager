'use client'
import { useState, useEffect, useRef } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

export default function ScanPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [verifying, setVerifying] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [mode, setMode] = useState<'camera'|'manual'>('camera')
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = '/auth'
        return
      }
      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single()
      // Only admins can access scan page
      if (p?.role !== 'admin') {
        window.location.href = '/'
        return
      }
      setUser(data.user)
      setProfile(p)
      setAuthLoading(false)
    })
  }, [])

  const verifyToken = async (token: string) => {
    const t = token.trim()
    if (!t || verifying) return
    setVerifying(true)
    setResult(null)
    try {
      const res = await fetch(`/api/verify-qr?token=${encodeURIComponent(t)}`)
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ valid: false, reason: 'Network error. Try again.' })
    }
    setVerifying(false)
  }

  const stopCamera = () => {
    setScanning(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    setCameraError('')
    setResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)

      const jsQR = (await import('jsqr')).default
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      const tick = () => {
        const video = videoRef.current
        if (!video || video.readyState < video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        })
        if (code?.data) {
          stopCamera()
          verifyToken(code.data)
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (e: any) {
      const msg = e.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow camera access in your browser settings.'
        : 'Camera not available. Use manual entry below.'
      setCameraError(msg)
      setMode('manual')
    }
  }

  useEffect(() => () => stopCamera(), [])

  const reset = () => {
    setResult(null)
    setManualToken('')
    setCameraError('')
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
    </div>
  )

  return (
    <>
      <Nav user={user} profile={profile} />
      <div className="container" style={{ paddingTop: 36, paddingBottom: 60, maxWidth: 500 }}>

        <div style={{ marginBottom: 24 }}>
          <a href="/admin" style={{ fontSize: 13, color: 'var(--text-muted)' }}>← Admin Dashboard</a>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 48, marginTop: 8 }}>
            QR <span style={{ color: 'var(--grass-bright)' }}>SCANNER</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Scan or paste customer QR code to verify entry
          </p>
        </div>

        {/* Mode tabs */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={`tab-btn ${mode === 'camera' ? 'active' : ''}`}
            onClick={() => { setMode('camera'); stopCamera(); reset() }}>
            📷 Camera
          </button>
          <button className={`tab-btn ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => { setMode('manual'); stopCamera(); reset() }}>
            ⌨️ Manual
          </button>
        </div>

        {/* Camera */}
        {mode === 'camera' && (
          <div className="card" style={{ marginBottom: 16 }}>
            {!scanning ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📷</div>
                {cameraError && (
                  <div style={{
                    fontSize: 13, color: 'var(--accent-red)', marginBottom: 16,
                    padding: '10px 14px', background: 'rgba(230,57,70,0.08)',
                    borderRadius: 'var(--radius)', border: '1px solid rgba(230,57,70,0.2)'
                  }}>{cameraError}</div>
                )}
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
                  Point camera at the customer's QR code
                </p>
                <button className="btn btn-primary" onClick={startCamera}>
                  Start Camera
                </button>
              </div>
            ) : (
              <div>
                <video ref={videoRef} playsInline muted
                  style={{ width: '100%', borderRadius: 8, background: '#000', display: 'block' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--grass-bright)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Scanning for QR...
                  </span>
                  <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }}
                    onClick={stopCamera}>Stop</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual */}
        {mode === 'manual' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <label style={{ marginBottom: 8, display: 'block' }}>Paste QR Token</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Paste the full token string from the QR code..."
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              style={{ resize: 'none', fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}
            />
            <button className="btn btn-primary w-full"
              onClick={() => verifyToken(manualToken)}
              disabled={verifying || !manualToken.trim()}>
              {verifying ? <span className="spinner" /> : 'Verify Entry'}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
            border: `2px solid ${result.valid ? 'var(--grass-bright)' : 'var(--accent-red)'}`,
            marginBottom: 16
          }}>
            {/* Status banner */}
            <div style={{
              padding: '20px 24px',
              background: result.valid ? 'rgba(64,145,108,0.15)' : 'rgba(230,57,70,0.15)',
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <span style={{ fontSize: 36 }}>{result.valid ? '✅' : '❌'}</span>
              <div>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: 28,
                  color: result.valid ? 'var(--grass-bright)' : 'var(--accent-red)'
                }}>
                  {result.valid ? 'ENTRY ALLOWED' : 'ENTRY DENIED'}
                </div>
                {!result.valid && (
                  <div style={{ fontSize: 14, color: 'var(--accent-red)', marginTop: 2 }}>
                    {result.reason}
                  </div>
                )}
              </div>
            </div>

            {/* Booking details */}
            {result.valid && result.booking && (
              <div style={{ padding: '20px 24px', background: 'var(--card)' }}>
                {[
                  ['👤 Name',   result.booking.userName  || '—'],
                  ['📞 Phone',  result.booking.userPhone || '—'],
                  ['📅 Date',   result.booking.date],
                  ['🕐 Slot',   `${result.booking.startTime} – ${result.booking.endTime}`],
                  ['🆔 ID',     `#${result.booking.id?.slice(0,8).toUpperCase()}`],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid var(--card-border)',
                    fontSize: 14
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '14px 24px', background: 'var(--card)' }}>
              <button className="btn btn-ghost w-full"
                onClick={() => { reset(); if (mode === 'camera') startCamera() }}>
                {mode === 'camera' ? '📷 Scan Another' : '↺ Reset'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}