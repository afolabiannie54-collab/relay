'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Image as ImageIcon, Music, Paperclip } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import ChatLink from '@/components/chat/ChatLink'
import ConversationActionSheet from '@/components/chat/ConversationActionSheet'
import ConversationContextMenu from '@/components/chat/ConversationContextMenu'
import { getHiddenConversations } from '@/actions/messages'
import { createClient } from '@/lib/supabase/client'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'
import ChatListSkeleton from '@/components/chat/ChatListSkeleton'
import { canHover } from '@/lib/hover'

const COMMENT_SLASH_PATH = "M11.5 2H19C21.2091 2 23 3.68965 23 5.77394V14.2653C23 16.3496 21.2091 18.0392 19 18.0392H18.0392M8 2H9.5M6 2H5C4.14017 2 3.3437 2.25596 2.69153 2.69153M2.69153 2.69153L1 1M2.69153 2.69153L18.0392 18.0392M18.0392 18.0392L23 23M15.5 18.0392H12.7814C11.6475 18.0392 10.5668 18.4933 9.80827 19.2885L7.37165 21.8429C7.0651 22.1642 6.5 21.9597 6.5 21.5273V18.9827C6.5 18.4616 6.05228 18.0392 5.5 18.0392H5C2.79086 18.0392 1 16.3496 1 14.2653V5.77394C1 5.19125 1.13996 4.6394 1.3899 4.1467"

const LONG_PRESS_MS = 400
const LONG_PRESS_MOVE_TOLERANCE = 10
const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export default function HiddenConversationsPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [actionSheetConv, setActionSheetConv] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null)
  const longPressFiredRef = useRef(false)

  async function refreshHidden() {
    const result = await getHiddenConversations()
    if (result.data) setConversations(result.data)
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
      await refreshHidden()
      setLoading(false)
    }
    load()
  }, [])

  const handleRowTouchStart = (conv) => (e) => {
    const touch = e.touches[0]
    if (!touch) return
    longPressFiredRef.current = false
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY }
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      try { window.navigator.vibrate?.(10) } catch {}
      setActionSheetConv(conv)
    }, LONG_PRESS_MS)
  }

  const handleRowTouchMove = (e) => {
    if (!longPressStartRef.current || !longPressTimerRef.current) return
    const touch = e.touches[0]
    if (!touch) return
    const dx = Math.abs(touch.clientX - longPressStartRef.current.x)
    const dy = Math.abs(touch.clientY - longPressStartRef.current.y)
    if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleRowTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleRowContextMenu = (conv) => (e) => {
    e.preventDefault()
    setContextMenu({ conversation: conv, position: { x: e.clientX, y: e.clientY } })
  }

  // Suppresses the tile's own navigation when the touch that just ended
  // was a long press (which already opened the action sheet) rather
  // than a tap — same pattern as the main chat list.
  const handleRowClick = () => (e) => {
    if (longPressFiredRef.current) {
      e.preventDefault()
      longPressFiredRef.current = false
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / 86400000)
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Yesterday'
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Same shape as ChatList's own getLastMessagePreview — kept in sync
  // deliberately since this list is meant to read as the same visual
  // language, just filtered to hidden conversations.
  const getLastMessagePreview = (msg) => {
    if (!msg) return 'No messages yet'
    if (msg.type === 'deleted') return 'This message was deleted'
    if (msg.type === 'system') return msg.content
    if (msg.type === 'image') return { icon: ImageIcon, text: 'Photo' }
    if (msg.type === 'audio') return { icon: Music, text: 'Voice message' }
    if (msg.type === 'file') return { icon: Paperclip, text: 'File' }
    return msg.content || ''
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
        <div className="relay-page-header-row" style={{ gap: '6px' }}>
          <button
            onClick={() => router.push('/chat')}
            aria-label="Back"
            className="relay-plain-icon-btn"
            style={{ width: '34px', height: '34px', marginLeft: '-8px', flexShrink: 0 }}
          >
            <ChevronLeft size={22} {...iconProps} />
          </button>
          <h1 className="relay-page-title">Hidden chats</h1>
        </div>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <ChatListSkeleton />
        ) : conversations.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <NotionDoodle d={COMMENT_SLASH_PATH} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.01em' }}>No hidden chats</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              Conversations you hide will show up here.
            </p>
          </div>
        ) : (
          conversations.map(conv => {
            const lastMessage = conv.last_message
            const isGroup = conv.type === 'group'
            const otherUser = conv.other_participants?.[0]
            const displayName = isGroup ? conv.group_info?.name : otherUser?.display_name
            const avatarUrl = isGroup ? conv.group_info?.avatar_url : otherUser?.avatar_url
            const preview = getLastMessagePreview(lastMessage)
            const PreviewIcon = preview?.icon

            return (
              <ChatLink
                key={conv.conversation_id}
                href={`/chat/${conv.conversation_id}`}
                style={{ textDecoration: 'none' }}
                onClick={handleRowClick()}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '13px 20px 13px 17px',
                    borderLeft: '3px solid transparent',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={e => {
                    if (!canHover()) return
                    e.currentTarget.style.background = 'var(--surface-hover)'
                    e.currentTarget.style.borderLeftColor = 'var(--accent)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--surface)'
                    e.currentTarget.style.borderLeftColor = 'transparent'
                  }}
                  onTouchStart={handleRowTouchStart(conv)}
                  onTouchMove={handleRowTouchMove}
                  onTouchEnd={handleRowTouchEnd}
                  onContextMenu={handleRowContextMenu(conv)}
                >
                  <Avatar src={avatarUrl} name={displayName} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <p style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {displayName || 'Unknown'}
                      </p>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '8px' }}>
                        {formatTime(lastMessage?.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{
                        fontSize: '13px',
                        color: conv.unread_count > 0 ? 'var(--text)' : 'var(--text-tertiary)',
                        fontWeight: conv.unread_count > 0 ? '600' : '400',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        {lastMessage?.sender_id === userId ? 'You: ' : ''}
                        {PreviewIcon && <PreviewIcon size={13} {...iconProps} style={{ flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {PreviewIcon ? preview.text : preview}
                        </span>
                      </p>
                      {conv.unread_count > 0 && (
                        <div style={{
                          minWidth: '19px',
                          height: '19px',
                          padding: '0 6px',
                          background: 'var(--accent)',
                          border: '1.5px solid var(--border-strong)',
                          borderRadius: '100px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '800',
                          color: 'var(--on-accent)',
                          flexShrink: 0,
                          marginLeft: '8px',
                        }}>
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ChatLink>
            )
          })
        )}
      </div>

      <ConversationActionSheet
        conversation={actionSheetConv}
        isMuted={false}
        isHidden
        isOpen={!!actionSheetConv}
        onClose={() => setActionSheetConv(null)}
        onChanged={refreshHidden}
      />

      <ConversationContextMenu
        conversation={contextMenu?.conversation || null}
        isMuted={false}
        isHidden
        position={contextMenu?.position || null}
        onClose={() => setContextMenu(null)}
        onChanged={refreshHidden}
      />
    </div>
  )
}
