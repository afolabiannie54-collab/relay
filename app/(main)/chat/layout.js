'use client'

import { useRef } from 'react'
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
// panel is rendered at a time via a plain conditional — no transform
// slide, no keyed-remount tricks. A CSS transform slide was tried here
// and repeatedly caused intermittent corruption (a torn frame briefly
// visible) and stale-content flashes because it raced with React's own
// mount/unmount of the conversation page mid-transition. An instant
// switch has none of those failure modes; a proper animation can come
// back later as part of a deliberate UI pass, built to not race React.
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

  // iOS-style swipe-from-anywhere-to-go-back on the detail panel. Only
  // active on mobile and only while actually viewing a conversation (not
  // the list itself). A mostly-vertical drag (normal message-list
  // scrolling) is rejected by the deltaX-vs-deltaY comparison, so this
  // doesn't fight with scrolling.
  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    if (!touch) return
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
      <div style={{ height: 'var(--app-height, 100dvh)', overflow: 'hidden' }}>
        {children}
      </div>
    )
  }

  return (
    <div className="chat-shell" style={{ display: 'flex', height: 'var(--app-height, 100dvh)', overflow: 'hidden', position: 'relative' }}>
      <div
        className={`chat-list-panel ${isListRoute ? '' : 'chat-panel-hidden'}`}
        style={{
          width: '360px',
          flexShrink: 0,
          borderRight: '1.5px solid #0a0a0a',
          background: '#fff',
          height: 'var(--app-height, 100dvh)',
          overflow: 'hidden',
        }}
      >
        <ChatList />
      </div>

      <div
        className={`chat-detail-panel ${isListRoute ? 'chat-panel-hidden' : ''}`}
        style={{
          flex: 1,
          minWidth: 0,
          height: 'var(--app-height, 100dvh)',
          overflow: 'hidden',
          background: '#fff',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Keyed by conversation id so switching directly between two
            conversations remounts the content instead of briefly showing
            the previous conversation's stale messages. */}
        <div key={convId} style={{ height: '100%' }}>
          {isListRoute ? <ChatEmptyState /> : children}
        </div>
      </div>

      <style>{`
        .chat-list-panel, .chat-detail-panel {
          overscroll-behavior-x: none;
        }

        /* Desktop: both panels always visible side by side */
        @media (min-width: 769px) {
          .chat-list-panel, .chat-detail-panel {
            position: relative;
          }
        }

        /* Mobile: only the active panel is shown, full screen, switched
           instantly via display — no animation, no transform. */
        @media (max-width: 768px) {
          .chat-list-panel, .chat-detail-panel {
            width: 100% !important;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            border-right: none !important;
          }
          .chat-panel-hidden {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
