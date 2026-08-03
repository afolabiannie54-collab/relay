'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, X, Send } from 'lucide-react'
import AudioPlayer from '@/components/chat/AudioPlayer'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export default function MediaRecorder({ onRecordingComplete, onCancel }) {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [micError, setMicError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const startRecording = async () => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new window.MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
      }

      recorder.start()
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= 599) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      setMicError('Could not access microphone. Please grant permission.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const handleSend = () => {
    if (!audioBlob) return
    const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
    onRecordingComplete(file)
  }

  const handleDiscard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setAudioBlob(null)
    setDuration(0)
    onCancel()
  }

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--surface)',
      borderTop: '2px solid var(--border-strong)',
      flexShrink: 0,
    }}>
      {micError && (
        <p style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '6px' }}>
          {micError}
        </p>
      )}
      <div style={{
        background: 'var(--surface)',
        border: '2px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        {!audioUrl ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              {recording ? (
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--error)', animation: 'relay-recorder-pulse 1s infinite', flexShrink: 0 }} />
              ) : (
                <Mic size={16} {...iconProps} color="var(--text-tertiary)" />
              )}
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                fontVariantNumeric: 'tabular-nums',
                color: recording ? 'var(--error)' : 'var(--text)',
              }}>
                {formatDuration(duration)}
              </span>
            </div>
            {!recording ? (
              <button onClick={startRecording} className="relay-btn" style={{ padding: '8px 16px', color: 'var(--error)', borderColor: 'var(--error)' }}>
                <Mic size={15} {...iconProps} /> Record
              </button>
            ) : (
              <button onClick={stopRecording} className="relay-btn relay-btn--filled" style={{ padding: '8px 16px' }}>
                <Square size={13} {...iconProps} fill="currentColor" /> Stop
              </button>
            )}
            <button onClick={handleDiscard} aria-label="Cancel" className="relay-plain-icon-btn" style={{ width: '32px', height: '32px' }}>
              <X size={18} {...iconProps} />
            </button>
          </>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AudioPlayer src={audioUrl} />
            </div>
            <button onClick={handleSend} className="relay-icon-btn relay-icon-btn--accent" style={{ width: 'auto', padding: '8px 16px' }} aria-label="Send voice message">
              <Send size={16} {...iconProps} />
            </button>
            <button onClick={handleDiscard} aria-label="Discard" className="relay-plain-icon-btn" style={{ width: '32px', height: '32px' }}>
              <X size={18} {...iconProps} />
            </button>
          </>
        )}
      </div>
      <style>{`
        @keyframes relay-recorder-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
