'use client'

import { useState, useRef, useEffect } from 'react'

export default function MediaRecorder({ onRecordingComplete, onCancel }) {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
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
      alert('Could not access microphone. Please grant permission.')
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
      background: '#F5F5F5',
      borderTop: '1px solid #E5E5E5',
      flexShrink: 0,
    }}>
      <div style={{
        background: '#fff',
        border: '1.5px solid #0a0a0a',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        {!audioUrl ? (
          <>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: recording ? '#EF4444' : '#A3A3A3',
              animation: recording ? 'pulse 1s infinite' : 'none',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '16px',
              fontWeight: '700',
              fontVariantNumeric: 'tabular-nums',
              color: recording ? '#EF4444' : '#0a0a0a',
              flex: 1,
            }}>
              {formatDuration(duration)}
            </span>
            {!recording ? (
              <button
                onClick={startRecording}
                style={{
                  padding: '8px 16px',
                  background: '#EF4444',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Record
              </button>
            ) : (
              <button
                onClick={stopRecording}
                style={{
                  padding: '8px 16px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Stop
              </button>
            )}
            <button
              onClick={handleDiscard}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#A3A3A3',
                padding: '4px',
              }}
            >
              ×
            </button>
          </>
        ) : (
          <>
            <audio controls src={audioUrl} style={{ flex: 1, height: '32px' }} />
            <button
              onClick={handleSend}
              style={{
                padding: '8px 16px',
                background: '#0a0a0a',
                color: '#fff',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '2px 2px 0 #FFB800',
                flexShrink: 0,
              }}
            >
              Send
            </button>
            <button
              onClick={handleDiscard}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#A3A3A3',
                padding: '4px',
              }}
            >
              ×
            </button>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}