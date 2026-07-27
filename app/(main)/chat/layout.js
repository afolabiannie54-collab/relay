'use client'

import { usePathname } from 'next/navigation'
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
  const isListRoute = pathname === '/chat'
  const isFullWidthRoute = FULL_WIDTH_ROUTES.includes(pathname)

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
      >
        {isListRoute ? <ChatEmptyState /> : children}
      </div>

      <style>{`
        .chat-list-panel, .chat-detail-panel {
          transition: transform 0.25s ease;
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
            position: absolute;
            top: 0;
            left: 0;
            border-right: none !important;
          }
          .chat-panel-visible {
            transform: translateX(0);
          }
          .chat-panel-hidden-left {
            transform: translateX(-100%);
          }
          .chat-panel-hidden-right {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}
