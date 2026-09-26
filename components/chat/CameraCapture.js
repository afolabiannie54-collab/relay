'use client'

import { useState, useRef, useEffect } from 'react'

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [captured, setCaptured] = useState(null)
  const [error, setError] = useState(null)
  const [facingMode, setFacingMode] = useState('user')

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [facingMode])

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      // Every getUserMedia failure used to show the same "grant
      // permission" copy — actively wrong advice for a camera that's
      // simply missing or already in use by another app, where no
      // permission prompt would ever appear no matter how many times the
      // user re-grants it.
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another app.')
      } else if (err.name === 'OverconstrainedError') {
        setError('This camera isn\'t available. Try the other camera.')
      } else {
        setError('Could not access camera. Please grant permission.')
      }
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
  }

  // A modern rear camera's native sensor resolution (often 4K+) was being
  // sent as-is with zero downscaling — inconsistent with this app's own
  // established pattern for the profile-photo crop (capped at 512x512
  // before upload) and a real cost on a mobile data connection for what's
  // just going to render at chat-bubble size anyway. 1920px on the long
  // edge is still comfortably more detail than a phone screen shows.
  const MAX_DIMENSION = 1920

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      setCaptured({ blob, url })
      stopCamera()
    }, 'image/jpeg', 0.9)
  }

  const handleSend = () => {
    if (!captured) return
    const file = new File([captured.blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
    onCapture(file)
    URL.revokeObjectURL(captured.url)
  }

  const handleRetake = () => {
    if (captured) URL.revokeObjectURL(captured.url)
    setCaptured(null)
    startCamera()
  }

  const handleCancel = () => {
    stopCamera()
    if (captured) URL.revokeObjectURL(captured.url)
    onCancel()
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        padding: '40px',
        textAlign: 'center',
      }}>
        <p style={{ color: '#fff', fontSize: '16px' }}>{error}</p>
        <button onClick={handleCancel} style={{
          padding: '10px 20px',
          background: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>Close</button>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top controls */}
      <div style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
        background: 'rgba(0,0,0,0.6)',
      }}>
        <button onClick={handleCancel} style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 14px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>Cancel</button>
        {!captured && (
          <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}>🔄 Flip</button>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {captured ? (
          <img src={captured.url} alt="Captured" style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }} />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }} />
        )}
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: '32px 24px',
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
      }}>
        {captured ? (
          <>
            <button onClick={handleRetake} style={{
              flex: 1,
              maxWidth: '140px',
              padding: '14px',
              background: 'rgba(255,255,255,0.15)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>Retake</button>
            <button onClick={handleSend} style={{
              flex: 1,
              maxWidth: '140px',
              padding: '14px',
              background: 'var(--accent)',
              border: '1.5px solid var(--border-strong)',
              borderRadius: '10px',
              color: 'var(--on-accent)',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>Send</button>
          </>
        ) : (
          <button onClick={handleCapture} style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#fff',
            border: '4px solid rgba(255,255,255,0.3)',
            cursor: 'pointer',
            outline: '3px solid #fff',
            outlineOffset: '4px',
          }} />
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}