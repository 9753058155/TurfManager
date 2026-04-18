'use client'
import { useState, useEffect, useRef } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

export default function ScanPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [mode, setMode] = useState<'camera'|'manual'>('camera')
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerRef = useRef<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/auth'; return }
      setUser(data.user)
      supabase.from('profiles').select('*').eq('id', data.user.id).single()
        .then(({ data: p }) => setProfile(p))
    })
  }, [])

  const verifyToken = async (token: string) => {
    if (!token.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/verify-qr?token=${encodeURIComponent(token.trim())}`)
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ valid: false, reason: 'Network error' })
    }
    setLoading(false)
  }

  const startCamera = async () => {
    setCameraError('')
    setResult(null)
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      // Dynamically load jsQR for QR detection
      const jsQR = (await import('jsqr')).default
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      const tick = () => {
        if (!videoRef.current || !scanning) return
        const video = videoRef.current
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code?.data) {
            stopCamera()
            verifyToken(code.data)
            return
          }
        }
        scannerRef.current = requestAnimationFrame(tick)
      }
      scannerRef.current = requestAnimationFrame(tick)
    } catch (e: any) {
      setCameraError('Camera access denied. Use manual entry below.')
      setScanning(false)
      setMode('manual')
    }
  }

  const stopCamera = () => {
    setScanning(false)
    if (scannerRef.current) cancelAnimationFrame(scannerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  useEffect(() => { return () => stopCamera() }, [])

  const reset = () => { setResult(null); setManualToken('') }

  return (
    <>
      <Nav user={user} profile={profile} />
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 520 }}>
        
        <div style={{ marginBottom: 28 }}>
          <a href="/admin" style={{ fontSize: 13, color: 'var(--text-muted)' }}>← Admin</a>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 52, marginTop: 8 }}>
            QR <span style={{ color: 'var(--grass-bright)' }}>SCANNER</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Scan customer QR code to verify and allow entry
          </p>
        </div>

        {/* Mode toggle */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${mode === 'camera' ? 'active' : ''}`}
            onClick={() => { setMode('camera'); stopCamera(); reset() }}>
            📷 Camera Scan
          </button>
          <button className={`tab-btn ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => { setMode('manual'); stopCamera(); reset() }}>
            ⌨️ Manual Entry
          </button>
        </div>

        {/* Camera mode */}
        {mode === 'camera' && (
          <div className="card" style={{ marginBottom: 20 }}>
            {!scanning ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📷</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
                  Point camera at customer QR code
                </p>
                {cameraError && (
                  <div style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 16 }}>
                    {cameraError}
                  </div>
                )}
                <button className="btn btn-primary" onClick={startCamera}>
                  Start Camera
                </button>
              </div>
            ) : (
              <div>
                <video
                  ref={videoRef}
                  style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', display: 'block' }}
                  playsInline
                  muted
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--grass-bright)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Scanning...
                  </span>
                  <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }} onClick={stopCamera}>
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual mode */}
        {mode === 'manual' && (
          <div className="card" style={{ marginBottom: 20 }}>
            <label>Paste QR Token</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Paste token from QR code here..."
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              style={{ resize: 'none', fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}
            />
            <button className="btn btn-primary w-full"
              onClick={() => verifyToken(manualToken)}
              disabled={loading || !manualToken.trim()}>
              {loading ? <span className="spinner" /> : 'Verify Entry'}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            padding: 24, borderRadius: 'var(--radius-lg)',
            border: `2px solid ${result.valid ? 'var(--grass-bright)' : 'var(--accent-red)'}`,
            background: result.valid ? 'rgba(64,145,108,0.08)' : 'rgba(230,57,70,0.08)',
            marginBottom: 16
          }}>
            <div style={{
              fontFamily: 'Bebas Neue', fontSize: 40,
              color: result.valid ? 'var(--grass-bright)' : 'var(--accent-red)',
              marginBottom: 16
            }}>
              {result.valid ? '✅ ENTRY ALLOWED' : '❌ ENTRY DENIED'}
            </div>

            {result.valid ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Date', result.booking.date],
                  ['Slot', `${result.booking.startTime} – ${result.booking.endTime}`],
                  ['Name', result.booking.userName || '—'],
                  ['Phone', result.booking.userPhone || '—'],
                  ['Booking ID', `#${result.booking.id?.slice(0,8).toUpperCase()}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--card-border)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--accent-red)', fontSize: 15 }}>{result.reason}</p>
            )}

            <button className="btn btn-ghost w-full" style={{ marginTop: 16 }} onClick={() => { reset(); if (mode === 'camera') startCamera() }}>
              Scan Another
            </button>
          </div>
        )}
      </div>
    </>
  )
}