'use client'

import { useState, useEffect } from 'react'
import { Download, X, Mic, FileText } from 'lucide-react'
import AudioPlayer from '@/components/chat/AudioPlayer'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// media.url is a Supabase Storage public URL — a different origin from
// this app — and browsers silently ignore the `download` attribute on a
// cross-origin <a href>, so tapping "Download" just opened/navigated to
// the file instead of actually saving it. Fetching it as a blob first
// gives a same-origin (blob:) URL that the browser will actually save.
// Falls back to opening it directly only if the fetch itself fails (e.g.
// a network blip, or a storage CORS policy stricter than the standard
// public-bucket default).
async function downloadFile(url, filename) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// Collapsed by default: a voice note is still primarily something you
// play, and expanding every transcript inline would turn a compact bubble
// into a wall of text. 'skipped' (sender turned transcription off) renders
// nothing at all rather than advertising a setting that isn't the
// recipient's to change.
function AudioTranscript({ status, transcript, isOwn }) {
  const [open, setOpen] = useState(false)

  if (status === 'none' || status === 'skipped') return null

  const subtle = isOwn ? 'var(--text-tertiary)' : 'var(--text-secondary)'

  if (status === 'pending') {
    return (
      <p style={{ marginTop: '8px', fontSize: '11px', color: subtle, fontStyle: 'italic' }}>
        Transcribing…
      </p>
    )
  }

  if (status === 'failed' || !transcript) {
    return (
      <p style={{ marginTop: '8px', fontSize: '11px', color: subtle }}>
        Transcript unavailable
      </p>
    )
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '11px',
          fontWeight: '700',
          color: subtle,
        }}
      >
        <FileText size={11} {...iconProps} />
        {open ? 'Hide transcript' : 'Show transcript'}
      </button>
      {open && (
        <p style={{
          marginTop: '6px',
          fontSize: '13px',
          lineHeight: 1.5,
          color: isOwn ? 'var(--background)' : 'var(--text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {transcript}
        </p>
      )}
    </div>
  )
}

// Fit-to-screen was the only option — no way to actually inspect detail
// in a dense photo or a tall screenshot beyond what already fits on
// screen shrunk down. Pinch (two pointers) and double-tap/double-click
// both zoom; a single pointer pans once zoomed in. Pointer Events (not
// separate touch/mouse handlers) so the same code handles mouse and
// touch, same approach as AudioPlayer's drag-to-scrub.
const MAX_ZOOM = 4
const DOUBLE_TAP_ZOOM = 2.5

export default function MediaMessage({ message, isOwn }) {
  const [imageError, setImageError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImageError, setLightboxImageError] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  // Mirrors "a pinch or pan is in progress" as real state rather than
  // reading pinchStartRef/panStartRef directly during render — refs are
  // meant for values event handlers/effects read, not something the
  // render function itself depends on (React can't tell it needs to
  // re-render when a ref changes, so reading one there risks the style
  // silently not updating in sync with the actual gesture).
  const [isInteracting, setIsInteracting] = useState(false)
  const pointersRef = useRef(new Map())
  const pinchStartRef = useRef(null)
  const panStartRef = useRef(null)

  const resetZoom = () => {
    setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
    resetZoom()
  }

  // Matches BottomSheet.js's own conventions for a full-screen overlay
  // (Escape to dismiss, background scroll locked while open) — this
  // lightbox previously had neither, unlike every other overlay in the
  // app.
  useEffect(() => {
    if (!lightboxOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') closeLightbox() }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen])

  const getDistance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y)

  const handleImagePointerDown = (e) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setIsInteracting(true)
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()]
      pinchStartRef.current = { distance: getDistance(p1, p2), scale: zoomScale }
      panStartRef.current = null
    } else if (pointersRef.current.size === 1 && zoomScale > 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y }
    }
  }

  const handleImagePointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const [p1, p2] = [...pointersRef.current.values()]
      const distance = getDistance(p1, p2)
      const next = Math.min(MAX_ZOOM, Math.max(1, pinchStartRef.current.scale * (distance / pinchStartRef.current.distance)))
      setZoomScale(next)
    } else if (pointersRef.current.size === 1 && panStartRef.current) {
      setPanOffset({
        x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
      })
    }
  }

  const handleImagePointerUp = (e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchStartRef.current = null
    if (pointersRef.current.size === 0) {
      panStartRef.current = null
      setIsInteracting(false)
      if (zoomScale <= 1) resetZoom()
    }
  }

  const handleImageDoubleClick = (e) => {
    e.stopPropagation()
    if (zoomScale > 1) resetZoom()
    else setZoomScale(DOUBLE_TAP_ZOOM)
  }

  const media = message.media_url
    ? {
        url: message.media_url,
        filename: message.media_filename,
        size: message.media_size,
        mimeType: message.media_mime_type,
      }
    : null

  if (!media) {
    return (
      <div style={{
        padding: '12px 14px',
        background: isOwn ? 'var(--text)' : 'var(--gray-100)',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
        color: isOwn ? 'var(--background)' : 'var(--text-secondary)',
        fontSize: '13px',
      }}>
        {message.content || 'File'}
      </div>
    )
  }

  if (message.type === 'image') {
    return (
      <>
        <div style={{
          borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
          overflow: 'hidden',
          maxWidth: '280px',
          cursor: 'pointer',
        }}
          onClick={() => { setLightboxImageError(false); setLightboxOpen(true) }}
        >
          {!imageError ? (
            <img
              src={media.url}
              alt={media.filename}
              loading="lazy"
              onError={() => setImageError(true)}
              style={{
                width: '100%',
                display: 'block',
                maxHeight: '300px',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              padding: '16px',
              background: 'var(--gray-100)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              Could not load image
            </div>
          )}
        </div>

        {lightboxOpen && (
          <div
            // Not portalled, so this is still a DOM descendant of the
            // .message-bubble div it's rendered inside of even though
            // position:fixed puts it elsewhere on screen — a touch here
            // still bubbles up through that real DOM ancestry regardless
            // of visual stacking, which would otherwise arm/trigger the
            // bubble's swipe-to-reply gesture (or its long-press menu)
            // while the user thinks they're only interacting with a
            // separate full-screen viewer. Same exclusion mechanism
            // AudioPlayer's own scrub-drag needed for the same reason.
            data-no-message-swipe
            onClick={closeLightbox}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.92)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              gap: '12px',
            }}>
              <button
                onClick={e => { e.stopPropagation(); downloadFile(media.url, media.filename) }}
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                }}
                aria-label="Download"
                title="Download"
              >
                <Download size={18} {...iconProps} />
              </button>
              <button
                onClick={closeLightbox}
                aria-label="Close"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} {...iconProps} />
              </button>
            </div>
            {/* The thumbnail has its own onError fallback (imageError,
                above) — the full-resolution request here had none, so a
                thumbnail that loaded fine (often smaller/cached) but a
                since-expired signed URL or network blip on the full
                image left the user staring at a bare broken-image icon
                with no explanation. */}
            {!lightboxImageError ? (
              <img
                src={media.url}
                alt={media.filename}
                loading="lazy"
                onClick={e => e.stopPropagation()}
                onDoubleClick={handleImageDoubleClick}
                onError={() => setLightboxImageError(true)}
                onPointerDown={handleImagePointerDown}
                onPointerMove={handleImagePointerMove}
                onPointerUp={handleImagePointerUp}
                onPointerCancel={handleImagePointerUp}
                style={{
                  maxWidth: '100%',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  touchAction: 'none',
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  transition: isInteracting ? 'none' : 'transform 0.2s ease',
                  cursor: zoomScale > 1 ? 'grab' : 'zoom-in',
                }}
              />
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }} onClick={e => e.stopPropagation()}>
                Could not load image
              </p>
            )}
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              marginTop: '12px',
            }}>
              {media.filename}
            </p>
          </div>
        )}
      </>
    )
  }

  if (message.type === 'audio') {
    return (
      <div style={{
        padding: '12px 14px',
        background: isOwn ? 'var(--text)' : 'var(--gray-100)',
        borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
        minWidth: '200px',
      }}>
        <p style={{
          fontSize: '11px',
          color: isOwn ? 'var(--text-tertiary)' : 'var(--text-secondary)',
          marginBottom: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <Mic size={12} {...iconProps} /> {media.filename.startsWith('voice-') ? 'Voice message' : media.filename}
        </p>
        <AudioPlayer src={media.url} light={isOwn} />
        <AudioTranscript
          status={message.media_transcript_status}
          transcript={message.media_transcript}
          isOwn={isOwn}
        />
      </div>
    )
  }

  // File/document
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div style={{
      padding: '12px 14px',
      background: isOwn ? 'var(--text)' : 'var(--gray-100)',
      borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
      border: isOwn ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: '180px',
      maxWidth: '260px',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        background: isOwn ? 'rgba(255,255,255,0.12)' : 'var(--gray-200)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isOwn ? 'var(--background)' : 'var(--text-secondary)',
        flexShrink: 0,
      }}>
        <FileText size={18} {...iconProps} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px',
          fontWeight: '600',
          color: isOwn ? 'var(--background)' : 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '2px',
        }}>
          {media.filename}
        </p>
        <p style={{ fontSize: '11px', color: isOwn ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
          {formatSize(media.size)}
        </p>
      </div>
      <button
        onClick={() => downloadFile(media.url, media.filename)}
        aria-label="Download"
        style={{
          width: '30px',
          height: '30px',
          background: isOwn ? 'rgba(255,255,255,0.12)' : 'var(--gray-200)',
          border: 'none',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isOwn ? 'var(--background)' : 'var(--text-secondary)',
          flexShrink: 0,
        }}
        title="Download"
      >
        <Download size={14} {...iconProps} />
      </button>
    </div>
  )
}
