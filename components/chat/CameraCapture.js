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
      setError('Could not access camera. Please grant permission.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

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
              background: '#FFB800',
              border: '1.5px solid #0a0a0a',
              borderRadius: '10px',
              color: '#0a0a0a',
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