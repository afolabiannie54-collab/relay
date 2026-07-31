'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Base overlay used by every sheet/menu in the app: a bottom sheet on
// mobile (drag handle, swipe down to dismiss), a centered modal on
// desktop. Portalled to document.body so it always renders above the
// app shell regardless of which overflow:hidden ancestor it's opened
// from (chat shell, main layout, etc.).
export default function BottomSheet({ isOpen, onClose, children, title, maxHeight }) {
  const [mounted, setMounted] = useState(false)
  const [dragY, setDragY] = useState(0)
  const draggingRef = useRef(false)
  const dragStartRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted || !isOpen) return null

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
      onClose?.()
    } else {
      setDragY(0)
    }
  }

  return createPortal(
    <div className="relay-sheet-overlay">
      <div className="relay-sheet-backdrop" onClick={onClose} />
      <div
        className="relay-sheet-panel"
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
              <button onClick={onClose} className="relay-sheet-close" aria-label="Close">✕</button>
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
          background: rgba(0, 0, 0, 0.5);
          animation: relay-sheet-backdrop-in 0.2s ease;
        }
        .relay-sheet-panel {
          position: relative;
          width: 100%;
          max-width: 480px;
          max-height: 85vh;
          background: #fff;
          border: 1.5px solid #0a0a0a;
          border-bottom: none;
          border-radius: 20px 20px 0 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: relay-sheet-in 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .relay-sheet-grab-area {
          flex-shrink: 0;
          touch-action: none;
        }
        .relay-sheet-drag-handle {
          display: flex;
          justify-content: center;
          padding: 8px 0 4px;
        }
        .relay-sheet-drag-bar {
          width: 36px;
          height: 4px;
          border-radius: 100px;
          background: #E5E5E5;
        }
        .relay-sheet-title-row {
          padding: 4px 20px 12px;
          border-bottom: 1px solid #E5E5E5;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .relay-sheet-title {
          font-size: 16px;
          font-weight: 800;
          color: #0a0a0a;
        }
        .relay-sheet-close {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #A3A3A3;
          padding: 8px;
          min-width: 32px;
          min-height: 32px;
        }
        .relay-sheet-body {
          overflow-y: auto;
          flex: 1;
          -webkit-overflow-scrolling: touch;
        }

        @keyframes relay-sheet-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes relay-sheet-in {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes relay-sheet-in-desktop {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (min-width: 769px) {
          .relay-sheet-overlay {
            align-items: center;
          }
          .relay-sheet-panel {
            border-radius: 16px;
            border-bottom: 1.5px solid #0a0a0a;
            max-height: 80vh;
            box-shadow: 6px 6px 0 #FFB800;
            animation: relay-sheet-in-desktop 0.2s ease;
          }
          .relay-sheet-grab-area {
            touch-action: auto;
          }
          .relay-sheet-drag-handle {
            display: none;
          }
        }
      `}</style>
    </div>,
    document.body
  )
}
