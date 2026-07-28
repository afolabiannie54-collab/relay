'use client'

import { useRef, useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ChatList from '@/components/chat/ChatList'
import ChatEmptyState from '@/components/chat/ChatEmptyState'

// Routes under /chat/* that are their own standalone view rather than
// "the conversation list plus a conversation" — these bypass the two-panel
// shell entirely and just render full width.
const FULL_WIDTH_ROUTES = ['/chat/hidden']

// Two-panel shell for everything else under /chat/*, WhatsApp-Web style on
// desktop. This layout persists across navigation between /chat,
// /chat/[id] and /chat/[id]/settings — Next.js only remounts a layout when
// its own segment unmounts, so the left panel's <ChatList /> instance here
// never unmounts while switching conversations.
//
// On desktop (>768px) both panels sit side by side. On mobile only one
// is visible at a time; both stay mounted (absolutely positioned,
// slid off-screen via transform) so switching between them can animate
// instead of hard-cutting between mount/unmount.
export default function ChatLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const isListRoute = pathname === '/chat'
  const isFullWidthRoute = FULL_WIDTH_ROUTES.includes(pathname)
  const touchStartRef = useRef(null)

  // Identifies which conversation is currently loaded, independent of the
  // /settings sub-route — used only to key the inner content wrapper below
  // (not the panel itself) so a stale conversation's messages never flash
  // when switching directly from one conversation to another.
  const convId = pathname.split('/')[2] || 'empty'

  // Going back to the list slides the detail panel off-screen via CSS
  // transform rather than unmounting it. The wrapper below used to be keyed
  // by convId directly, which meant the key collapsed to 'empty' the
  // instant isListRoute flipped true — forcing a remount of live children
  // to <ChatEmptyState /> WHILE the panel was mid-slide-out, which is what
  // produced the torn/corrupted frame (sliver of old content + gray void).
  //
  // Fix: keep the key stable (only ever a real conversation id, never
  // 'empty') so no remount happens during the slide, and delay swapping
  // in <ChatEmptyState /> until after the 300ms slide-out transition (see
  // the `transition` rule below) has had time to finish — at which point
  // the panel is fully off-screen and the swap is invisible anyway.
  const stableKeyRef = useRef('empty')
  if (!isListRoute && convId !== 'empty') stableKeyRef.current = convId

  const [showEmpty, setShowEmpty] = useState(false)
  useEffect(() => {
    if (isListRoute) {
      const t = setTimeout(() => setShowEmpty(true), 320)
      return () => clearTimeout(t)
    }
    setShowEmpty(false)
  }, [isListRoute])

  // iOS-style swipe-from-anywhere-to-go-back on the detail panel. Only
  // active on mobile and only while actually viewing a conversation (not
  // the list itself). A mostly-vertical drag (normal message-list
  // scrolling) is rejected by the deltaX-vs-deltaY comparison, so this
  // doesn't fight with scrolling. Ignores touches starting very close to
  // the left edge — that strip is where iOS's own native edge-swipe-back
  // gesture activates, and having both respond to the same touch can
  // trigger overlapping navigations.
  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    if (!touch) return
    if (touch.clientX < 24) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (e) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    if (isListRoute) return
    if (window.innerWidth > 768) return

    const touch = e.changedTouches[0]
    if (!touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (deltaX > 60 && deltaX > Math.abs(deltaY) * 1.5) {
      router.push('/chat')
    }
  }

  if (isFullWidthRoute) {
    return (
      <div style={{ height: '100dvh', overflow: 'hidden' }}>
        {children}
      </div>
    )
  }

  return (
    <div className="chat-shell" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', position: 'relative' }}>
      <div
        className={`chat-list-panel ${isListRoute ? 'chat-panel-visible' : 'chat-panel-hidden-left'}`}
        style={{
          width: '360px',
          flexShrink: 0,
          borderRight: '1.5px solid #0a0a0a',
          background: '#fff',
          height: '100dvh',
          overflow: 'hidden',
        }}
      >
        <ChatList />
      </div>

      <div
        className={`chat-detail-panel ${isListRoute ? 'chat-panel-hidden-right' : 'chat-panel-visible'}`}
        style={{
          flex: 1,
          minWidth: 0,
          height: '100dvh',
          overflow: 'hidden',
          background: '#fff',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Keyed by the last real conversation id so switching directly
            between two conversations remounts the content instead of
            briefly showing the previous conversation's stale messages.
            This key lives on an inner wrapper, not the .chat-detail-panel
            node itself — keying the outer node would also remount it on
            every list-to-conversation transition, which would skip the
            CSS transform transition below entirely (a freshly-mounted
            node has no prior style to animate from). The key never
            collapses to 'empty' while sliding out to the list, so this
            wrapper doesn't remount mid-transform (see stableKeyRef
            above); it renders null in the meantime instead of swapping
            to the empty state, which only appears once the slide has
            finished. */}
        <div key={stableKeyRef.current} style={{ height: '100%' }}>
          {isListRoute ? (showEmpty ? <ChatEmptyState /> : null) : children}
        </div>
      </div>

      <style>{`
        .chat-list-panel, .chat-detail-panel {
          transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          will-change: transform;
          overscroll-behavior-x: none;
        }

        /* Desktop: both panels always visible side by side, no sliding */
        @media (min-width: 769px) {
          .chat-list-panel, .chat-detail-panel {
            transform: none !important;
            position: relative;
          }
        }

        /* Mobile: one panel full-screen at a time, sliding via transform */
        @media (max-width: 768px) {
          .chat-list-panel, .chat-detail-panel {
            width: 100% !important;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            border-right: none !important;
          }
          .chat-panel-visible {
            transform: translateX(0);
          }
          .chat-panel-hidden-left {
            transform: translateX(-110%);
          }
          .chat-panel-hidden-right {
            transform: translateX(110%);
          }
        }
      `}</style>
    </div>
  )
}
