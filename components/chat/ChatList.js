'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import ChatLink from '@/components/chat/ChatLink'
import NewConversationSheet from '@/components/chat/NewConversationSheet'
import ConversationActionSheet from '@/components/chat/ConversationActionSheet'
import ConversationContextMenu from '@/components/chat/ConversationContextMenu'
import { getConversations, getMessages } from '@/actions/messages'
import { getMutedConversationIds } from '@/actions/conversations'
import { getUnreadCount as getUnreadNotificationCount, getRequestsCount } from '@/actions/notifications'
import { createClient } from '@/lib/supabase/client'
import { cache } from '@/lib/cache'

const LONG_PRESS_MS = 400
const LONG_PRESS_MOVE_TOLERANCE = 10

export default function ChatList({ onSelectConversation }) {
  const router = useRouter()
  const [conversations, setConversations] = useState([])
  const [userId, setUserId] = useState(null)
  const [mutedIds, setMutedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterQuery, setFilterQuery] = useState('')
  const [actionSheetConv, setActionSheetConv] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const longPressTimerRef = useRef(null)
  const longPressStartRef = useRef(null)
  const longPressFiredRef = useRef(false)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [showNewConversation, setShowNewConversation] = useState(false)

  useEffect(() => {
    async function load() {
      // Paint cached data immediately — no spinner for a list we've
      // already fetched this session. Fresh data still loads underneath
      // and replaces it silently. Uses peek() rather than get() since we
      // always re-fetch fresh below regardless of TTL — the TTL shouldn't
      // also gate whether we get to show something instantly.
      const cachedConvs = cache.peek('conversations')
      const cachedMuted = cache.get('muted-ids')

      if (cachedConvs) {
        setConversations(cachedConvs)
        setLoading(false)
      }
      if (cachedMuted) setMutedIds(cachedMuted)

      const supabase = createClient()

      const [userResult, convsResult, mutedResult, notifResult, requestsResult] = await Promise.all([
        supabase.auth.getUser(),
        getConversations(),
        cachedMuted ? Promise.resolve({ data: cachedMuted }) : getMutedConversationIds(),
        getUnreadNotificationCount(),
        getRequestsCount(),
      ])

      if (userResult.data.user) setUserId(userResult.data.user.id)

      if (convsResult.data) {
        setConversations(convsResult.data)
        cache.set('conversations', convsResult.data, 10000)
      }
      if (mutedResult.data) {
        setMutedIds(mutedResult.data)
        cache.set('muted-ids', mutedResult.data, 30000)
      }
      setUnreadNotifCount(notifResult.count || 0)
      setRequestsCount(requestsResult.count || 0)
      setLoading(false)
    }
    load()
  }, [])

  async function refreshConversations() {
    const result = await getConversations()
    if (result.data) {
      setConversations(result.data)
      cache.set('conversations', result.data, 10000)
    }
  }

  useEffect(() => {
    // Same-tab signal fired the instant a conversation is marked read —
    // guarantees this list reflects it immediately regardless of whether
    // the browser actually remounts this component on back-navigation.
    window.addEventListener('relay:conversation-read', refreshConversations)

    const supabase = createClient()
    const channel = supabase
      .channel('chat-list-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => {
        cache.invalidate('conversations')
        refreshConversations()
      })
      .subscribe()

    return () => {
      window.removeEventListener('relay:conversation-read', refreshConversations)
      supabase.removeChannel(channel)
    }
  }, [])

  // Realtime: bell badge (new notification rows for me) and the message
  // requests row (pending message requests / group invites addressed to
  // me) — both moved here from the app shell now that Requests is no
  // longer a bottom-nav tab.
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const channel = supabase
      .channel('chat-list-badges')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        setUnreadNotifCount(c => c + 1)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_requests',
        filter: `receiver_id=eq.${userId}`,
      }, async () => {
        const result = await getRequestsCount()
        setRequestsCount(result.count || 0)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_invites',
        filter: `invitee_id=eq.${userId}`,
      }, async () => {
        const result = await getRequestsCount()
        setRequestsCount(result.count || 0)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function prefetchConversation(convId) {
    if (cache.get(`messages:${convId}`)) return
    const result = await getMessages(convId)
    if (result.data) cache.set(`messages:${convId}`, result.data, 20000)
  }

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

  // Suppresses the tile's own navigation when the touch that just ended
  // was a long press (which already opened the action sheet) rather than
  // a tap.
  const handleRowClick = (conv) => (e) => {
    if (longPressFiredRef.current) {
      e.preventDefault()
      longPressFiredRef.current = false
      return
    }
    onSelectConversation?.(conv.conversation_id)
  }

  const handleRowContextMenu = (conv) => (e) => {
    e.preventDefault()
    setContextMenu({ conversation: conv, position: { x: e.clientX, y: e.clientY } })
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

  const getUnreadCount = (conv) => conv.unread_count || 0

  const filteredConversations = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(conv => {
      const isGroup = conv.type === 'group'
      const otherUser = conv.other_participants?.[0]
      const name = (isGroup ? conv.group_info?.name : otherUser?.display_name) || ''
      const lastMessageContent = conv.last_message?.content || ''
      return (
        name.toLowerCase().includes(q) ||
        lastMessageContent.toLowerCase().includes(q)
      )
    })
  }, [conversations, filterQuery])

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
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0a0a0a' }}>Messages</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => router.push('/notifications')}
            aria-label="Notifications"
            style={{
              position: 'relative',
              width: '44px',
              height: '44px',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            🔔
            {unreadNotifCount > 0 && (
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '16px',
                height: '16px',
                padding: '0 3px',
                background: '#FFB800',
                border: '1.5px solid #0a0a0a',
                borderRadius: '100px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: '800',
              }}>
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </div>
            )}
          </button>
          <button
            onClick={() => setShowNewConversation(true)}
            aria-label="New conversation"
            style={{
              width: '44px',
              height: '44px',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '700',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #F5F5F5', background: '#fff' }}>
        <input
          type="text"
          value={filterQuery}
          onChange={e => setFilterQuery(e.target.value)}
          placeholder="Search conversations..."
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #E5E5E5',
            borderRadius: '100px',
            fontSize: '13px',
            fontFamily: 'inherit',
            outline: 'none',
            background: '#F5F5F5',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Conversation list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehaviorX: 'none',
        overscrollBehaviorY: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}>
        {requestsCount > 0 && (
          <div
            onClick={() => router.push('/requests')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 20px',
              borderBottom: '1.5px solid #0a0a0a',
              cursor: 'pointer',
              background: '#FFF8E1',
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#FFB800',
              border: '1.5px solid #0a0a0a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}>
              📨
            </div>
            <p style={{ flex: 1, fontSize: '14px', fontWeight: '700', color: '#0a0a0a' }}>
              Message Requests
            </p>
            <div style={{
              minWidth: '22px',
              height: '22px',
              padding: '0 6px',
              background: '#0a0a0a',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '800',
              color: '#fff',
            }}>
              {requestsCount > 99 ? '99+' : requestsCount}
            </div>
          </div>
        )}

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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>No conversations yet</h2>
            <p style={{ fontSize: '14px', color: '#A3A3A3', marginBottom: '24px' }}>
              Search for people and start a conversation.
            </p>
            <button
              onClick={() => setShowNewConversation(true)}
              style={{
                padding: '10px 20px',
                background: '#0a0a0a',
                color: '#fff',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '3px 3px 0 #FFB800',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Find people
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>No conversations match "{filterQuery}"</p>
          </div>
        ) : (
          filteredConversations.map(conv => {
            const lastMessage = conv.last_message
            const isGroup = conv.type === 'group'
            const otherUser = conv.other_participants?.[0]
            const displayName = isGroup ? conv.group_info?.name : otherUser?.display_name
            const avatarUrl = isGroup ? conv.group_info?.avatar_url : otherUser?.avatar_url
            const isMuted = mutedIds.includes(conv.conversation_id)

            return (
              <ChatLink
                key={conv.conversation_id}
                href={`/chat/${conv.conversation_id}`}
                style={{ textDecoration: 'none' }}
                onClick={handleRowClick(conv)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 20px',
                  borderBottom: '1px solid #F5F5F5',
                  cursor: 'pointer',
                  background: '#fff',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#F9F9F9'
                    prefetchConversation(conv.conversation_id)
                  }}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  onTouchStart={(e) => { prefetchConversation(conv.conversation_id); handleRowTouchStart(conv)(e) }}
                  onTouchMove={handleRowTouchMove}
                  onTouchEnd={handleRowTouchEnd}
                  onContextMenu={handleRowContextMenu(conv)}
                >
                  <Avatar
                    src={avatarUrl}
                    name={displayName}
                    size={48}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <p style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#0a0a0a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {displayName || 'Unknown'}
                        </span>
                        {isMuted && <span style={{ fontSize: '12px', flexShrink: 0 }}>🔕</span>}
                      </p>
                      <span style={{ fontSize: '11px', color: '#A3A3A3', flexShrink: 0, marginLeft: '8px' }}>
                        {formatTime(lastMessage?.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{
                        fontSize: '13px',
                        color: getUnreadCount(conv) > 0 ? '#0a0a0a' : '#A3A3A3',
                        fontWeight: getUnreadCount(conv) > 0 ? '600' : '400',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}>
                        {lastMessage?.sender_id === userId ? 'You: ' : ''}{getLastMessagePreview(lastMessage)}
                      </p>
                      {getUnreadCount(conv) > 0 && (
                        <div style={{
                          minWidth: '20px',
                          height: '20px',
                          padding: '0 6px',
                          background: '#FFB800',
                          borderRadius: '100px',
                          border: '1.5px solid #0a0a0a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '800',
                          color: '#0a0a0a',
                          flexShrink: 0,
                          marginLeft: '8px',
                        }}>
                          {getUnreadCount(conv) > 99 ? '99+' : getUnreadCount(conv)}
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

      <NewConversationSheet isOpen={showNewConversation} onClose={() => setShowNewConversation(false)} />

      <ConversationActionSheet
        conversation={actionSheetConv}
        isMuted={actionSheetConv ? mutedIds.includes(actionSheetConv.conversation_id) : false}
        isOpen={!!actionSheetConv}
        onClose={() => setActionSheetConv(null)}
        onChanged={refreshConversations}
      />

      <ConversationContextMenu
        conversation={contextMenu?.conversation || null}
        isMuted={contextMenu ? mutedIds.includes(contextMenu.conversation.conversation_id) : false}
        position={contextMenu?.position || null}
        onClose={() => setContextMenu(null)}
        onChanged={refreshConversations}
      />
    </div>
  )
}
