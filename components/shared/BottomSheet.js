'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Base overlay used by every sheet/menu in the app: a bottom sheet on
// mobile (drag handle, swipe down to dismiss), a centered modal on
// desktop. Portalled to document.body so it always renders above the
// app shell regardless of which overflow:hidden ancestor it's opened
// from (chat shell, main layout, etc.).
const CLOSE_ANIM_MS = 220

export default function BottomSheet({ isOpen, onClose, children, title, maxHeight }) {
  const [mounted, setMounted] = useState(false)
  const [dragY, setDragY] = useState(0)
  const draggingRef = useRef(false)
  const dragStartRef = useRef(0)
  // The open animation is a deliberate 0.2-0.3s slide/fade-in — closing
  // just unmounted instantly with no reverse animation at all, a real
  // inconsistency users would notice as an abrupt vanish right after a
  // smooth entrance. This keeps the panel mounted for one more tick after
  // isOpen flips false so a reverse keyframe (below) can play first.
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [closing, setClosing] = useState(false)
  const dismissedByDragRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setClosing(false)
      return
    }
    if (!shouldRender) return
    // A drag-dismiss is already visually animating the panel off-screen
    // via its own inline transform (see handleTouchEnd) — layering the
    // reverse CSS keyframe on top of that would fight it and jump.
    if (dismissedByDragRef.current) {
      dismissedByDragRef.current = false
      setShouldRender(false)
      return
    }
    setClosing(true)
    const timer = setTimeout(() => {
      setShouldRender(false)
      setClosing(false)
    }, CLOSE_ANIM_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) setDragY(0)
  }, [isOpen])

  if (!mounted || !shouldRender) return null

  const handleTouchStart = (e) => {
    draggingRef.current = true
    dragStartRef.current = e.touches[0].clientY
  }

  const handleTouchMove = (e) => {
    if (!draggingRef.current) return
    const delta = e.touches[0].clientY - dragStartRef.current
    if (delta > 0) setDragY(delta)
  }

  const handleTouchEnd = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (dragY > 100) {
      dismissedByDragRef.current = true
      onClose?.()
    } else {
      setDragY(0)
    }
  }

  return createPortal(
    <div className="relay-sheet-overlay">
      <div className="relay-sheet-backdrop" data-closing={closing || undefined} onClick={onClose} />
      <div
        className="relay-sheet-panel"
        data-closing={closing || undefined}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? 'none' : undefined,
          // Overrides the class's default max-height (85vh mobile / 80vh
          // desktop) when a taller sheet is needed — inline style beats
          // the un-!important'd class rule at any breakpoint. Omitted by
          // default so every other caller keeps the original size.
          ...(maxHeight ? { maxHeight } : {}),
        }}
      >
        <div
          className="relay-sheet-grab-area"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relay-sheet-drag-handle">
            <div className="relay-sheet-drag-bar" />
          </div>
          {title && (
            <div className="relay-sheet-title-row">
              <h2 className="relay-sheet-title">{title}</h2>
              <button onClick={onClose} className="relay-sheet-close" aria-label="Close">
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>
          )}
        </div>
        <div className="relay-sheet-body">
          {children}
        </div>
      </div>

      <style>{`
        .relay-sheet-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .relay-sheet-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(10, 10, 10, 0.4);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          animation: relay-sheet-backdrop-in 0.2s ease;
        }
        .relay-sheet-panel {
          position: relative;
          width: 100%;
          max-width: 480px;
          max-height: 85vh;
          background: var(--surface);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: 22px 22px 0 0;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: relay-sheet-in 0.3s var(--ease-out);
        }
        .relay-sheet-grab-area {
          flex-shrink: 0;
          touch-action: none;
        }
        .relay-sheet-drag-handle {
          display: flex;
          justify-content: center;
          padding: 10px 0 4px;
        }
        .relay-sheet-drag-bar {
          width: 36px;
          height: 4px;
          border-radius: 100px;
          background: var(--border);
        }
        .relay-sheet-title-row {
          padding: 6px 16px 14px 20px;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .relay-sheet-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.01em;
        }
        .relay-sheet-close {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-tertiary);
          padding: 8px;
          min-width: 32px;
          min-height: 32px;
          border-radius: var(--radius-pill);
          transition: background 0.12s ease, color 0.12s ease;
        }
        .relay-sheet-close:hover {
          background: var(--surface-hover);
          color: var(--text);
        }
        .relay-sheet-body {
          overflow-y: auto;
          flex: 1;
          -webkit-overflow-scrolling: touch;
          /* Mobile only — the panel's bottom edge sits flush against the
             screen edge here (home indicator / gesture bar), unlike the
             centered desktop modal below which isn't anchored to it. */
          padding-bottom: var(--safe-bottom);
        }

        .relay-sheet-backdrop[data-closing] {
          animation: relay-sheet-backdrop-out ${CLOSE_ANIM_MS}ms ease forwards;
        }
        .relay-sheet-panel[data-closing] {
          animation: relay-sheet-out ${CLOSE_ANIM_MS}ms var(--ease-out) forwards;
        }

        @keyframes relay-sheet-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes relay-sheet-backdrop-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes relay-sheet-in {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes relay-sheet-out {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
        @keyframes relay-sheet-in-desktop {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes relay-sheet-out-desktop {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(12px) scale(0.97); }
        }

        @media (min-width: 769px) {
          .relay-sheet-overlay {
            align-items: center;
          }
          .relay-sheet-panel {
            border-radius: 18px;
            border-bottom: 1px solid var(--border);
            max-height: 80vh;
            animation: relay-sheet-in-desktop 0.22s var(--ease-out);
          }
          .relay-sheet-panel[data-closing] {
            animation: relay-sheet-out-desktop ${CLOSE_ANIM_MS}ms var(--ease-out) forwards;
          }
          .relay-sheet-grab-area {
            touch-action: auto;
          }
          .relay-sheet-drag-handle {
            display: none;
          }
          .relay-sheet-body {
            padding-bottom: 0;
          }
        }
      `}</style>
    </div>,
    document.body
  )
}
