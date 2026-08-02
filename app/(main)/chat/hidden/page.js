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

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button
          onClick={() => router.push('/chat')}
          aria-label="Back"
          className="relay-plain-icon-btn"
          style={{ marginLeft: '-10px', marginBottom: '10px' }}
        >
          <ChevronLeft size={22} {...iconProps} />
        </button>
        <h1 className="relay-page-title">Hidden chats</h1>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
          }}>
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
                          color: 'var(--foreground)',
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
