'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, X, ChevronLeft, ChevronRight } from 'lucide-react'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }
const MAX_ZOOM = 4
const DOUBLE_TAP_ZOOM = 2.5
const SWIPE_THRESHOLD = 60

// Same cross-origin issue MediaMessage's own download button has: the
// Supabase Storage URL is a different origin, so a plain <a download>
// is silently ignored. Fetching as a blob first gives a same-origin
// blob: URL the browser will actually save.
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

// One lightbox shared across an entire conversation's images, rather than
// one instance owned by each message bubble — a gallery has to navigate
// between messages, which a lightbox living inside a single MediaMessage
// could never do. `items` is the conversation's image messages in
// timeline order; `activeId` is the message id currently open (or null).
export default function MediaLightbox({ items, activeId, onClose, onNavigate }) {
  const index = items.findIndex(m => m.id === activeId)
  const current = index === -1 ? null : items[index]
  const hasPrev = index > 0
  const hasNext = index !== -1 && index < items.length - 1

  const [imageError, setImageError] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  // Mirrors "a pinch/pan/swipe is in progress" as real state rather than
  // reading the refs below directly during render — see MediaMessage's
  // own note on this same pattern.
  const [isInteracting, setIsInteracting] = useState(false)
  const pointersRef = useRef(new Map())
  const pinchStartRef = useRef(null)
  const panStartRef = useRef(null)
  const swipeStartRef = useRef(null)

  const resetZoom = () => {
    setZoomScale(1)
    setPanOffset({ x: 0, y: 0 })
  }

  // Navigating to a different image without this would carry over the
  // last image's zoom/pan/broken-image state onto one that was never
  // actually zoomed or broken.
  useEffect(() => {
    setImageError(false)
    resetZoom()
  }, [activeId])

  // Matches BottomSheet.js's own conventions for a full-screen overlay
  // (Escape to dismiss, background scroll locked while open), plus
  // arrow-key navigation since this is now a gallery, not a single image.
  useEffect(() => {
    if (!current) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onNavigate(items[index - 1].id)
      else if (e.key === 'ArrowRight' && hasNext) onNavigate(items[index + 1].id)
    }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [current, hasPrev, hasNext, index, items, onClose, onNavigate])

  if (!current) return null

  const getDistance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y)

  const handlePointerDown = (e) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setIsInteracting(true)
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()]
      pinchStartRef.current = { distance: getDistance(p1, p2), scale: zoomScale }
      panStartRef.current = null
      swipeStartRef.current = null
    } else if (pointersRef.current.size === 1) {
      if (zoomScale > 1) {
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y }
      } else {
        // Not zoomed: a single-pointer drag is a swipe-to-navigate
        // gesture instead of a pan, same as a native gallery.
        swipeStartRef.current = { x: e.clientX, y: e.clientY }
      }
    }
  }

  const handlePointerMove = (e) => {
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

  const handlePointerUp = (e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchStartRef.current = null

    if (swipeStartRef.current) {
      const dx = e.clientX - swipeStartRef.current.x
      const dy = e.clientY - swipeStartRef.current.y
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0 && hasPrev) onNavigate(items[index - 1].id)
        else if (dx < 0 && hasNext) onNavigate(items[index + 1].id)
      }
      swipeStartRef.current = null
    }

    if (pointersRef.current.size === 0) {
      panStartRef.current = null
      setIsInteracting(false)
      if (zoomScale <= 1) resetZoom()
    }
  }

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    if (zoomScale > 1) resetZoom()
    else setZoomScale(DOUBLE_TAP_ZOOM)
  }

  return (
    <div
      // Not portalled, so this is still a DOM descendant of whichever
      // message bubble's click opened it, even though position:fixed
      // puts it elsewhere on screen — this exclusion keeps a touch here
      // from arming that bubble's swipe-to-reply/long-press handlers.
      data-no-message-swipe
      onClick={onClose}
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
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '12px' }}>
        <button
          onClick={e => { e.stopPropagation(); downloadFile(current.media_url, current.media_filename) }}
          style={iconButtonStyle}
          aria-label="Download"
          title="Download"
        >
          <Download size={18} {...iconProps} />
        </button>
        <button onClick={onClose} aria-label="Close" style={iconButtonStyle}>
          <X size={20} {...iconProps} />
        </button>
      </div>

      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onNavigate(items[index - 1].id) }}
          aria-label="Previous image"
          style={{ ...navButtonStyle, left: '16px' }}
        >
          <ChevronLeft size={24} {...iconProps} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNavigate(items[index + 1].id) }}
          aria-label="Next image"
          style={{ ...navButtonStyle, right: '16px' }}
        >
          <ChevronRight size={24} {...iconProps} />
        </button>
      )}

      {/* The thumbnail has its own onError fallback — the full-resolution
          request here had none, so a thumbnail that loaded fine (often
          smaller/cached) but a since-expired URL or network blip on the
          full image left the user staring at a bare broken-image icon. */}
      {!imageError ? (
        <img
          src={current.media_url}
          alt={current.media_filename}
          loading="lazy"
          onClick={e => e.stopPropagation()}
          onDoubleClick={handleDoubleClick}
          onError={() => setImageError(true)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
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
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginTop: '12px' }}>
        {current.media_filename}{items.length > 1 ? ` · ${index + 1} of ${items.length}` : ''}
      </p>
    </div>
  )
}

const iconButtonStyle = {
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
}

const navButtonStyle = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '44px',
  height: '44px',
  background: 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#fff',
  zIndex: 1,
}
