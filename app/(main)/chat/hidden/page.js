'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import ChatLink from '@/components/chat/ChatLink'
import ConversationActionSheet from '@/components/chat/ConversationActionSheet'
import ConversationContextMenu from '@/components/chat/ConversationContextMenu'
import { getHiddenConversations } from '@/actions/messages'

const LONG_PRESS_MS = 400
const LONG_PRESS_MOVE_TOLERANCE = 10

export default function HiddenConversationsPage() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
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

  const getLastMessagePreview = (msg) => {
    if (!msg) return 'No messages yet'
    if (msg.type === 'deleted') return 'This message was deleted'
    if (msg.type === 'system') return msg.content
    if (msg.type === 'image') return '📷 Image'
    if (msg.type === 'audio') return '🎵 Audio'
    if (msg.type === 'file') return '📎 File'
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
        <p style={{ color: '#A3A3A3', fontSize: '14px' }}>Loading...</p>
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
      <div style={{
        padding: '16px 20px',
        borderBottom: '1.5px solid #E5E5E5',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <Link href="/chat" style={{
          textDecoration: 'none',
          color: '#0a0a0a',
          fontSize: '14px',
          fontWeight: '600',
        }}>
          ← Back
        </Link>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0a0a0a' }}>Hidden chats</h1>
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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗄️</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>No hidden chats</h2>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
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
                    padding: '14px 20px',
                    borderBottom: '1px solid #F5F5F5',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9F9F9'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
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
                        color: '#0a0a0a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {displayName || 'Unknown'}
                      </p>
                      <span style={{ fontSize: '11px', color: '#A3A3A3', flexShrink: 0, marginLeft: '8px' }}>
                        {formatTime(lastMessage?.created_at)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '13px',
                      color: '#A3A3A3',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {getLastMessagePreview(lastMessage)}
                    </p>
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
