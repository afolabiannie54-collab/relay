'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import ChatLink from '@/components/chat/ChatLink'
import { getConversations, getMessages } from '@/actions/messages'
import { getMutedConversationIds } from '@/actions/conversations'
import { createClient } from '@/lib/supabase/client'
import { cache } from '@/lib/cache'

export default function ChatList({ onSelectConversation }) {
  const [conversations, setConversations] = useState([])
  const [userId, setUserId] = useState(null)
  const [mutedIds, setMutedIds] = useState([])
  const [loading, setLoading] = useState(true)

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

      const [userResult, convsResult, mutedResult] = await Promise.all([
        supabase.auth.getUser(),
        getConversations(),
        cachedMuted ? Promise.resolve({ data: cachedMuted }) : getMutedConversationIds(),
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
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function refresh() {
      const result = await getConversations()
      if (result.data) {
        setConversations(result.data)
        cache.set('conversations', result.data, 10000)
      }
    }

    // Same-tab signal fired the instant a conversation is marked read —
    // guarantees this list reflects it immediately regardless of whether
    // the browser actually remounts this component on back-navigation.
    window.addEventListener('relay:conversation-read', refresh)

    const supabase = createClient()
    const channel = supabase
      .channel('chat-list-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => {
        cache.invalidate('conversations')
        refresh()
      })
      .subscribe()

    return () => {
      window.removeEventListener('relay:conversation-read', refresh)
      supabase.removeChannel(channel)
    }
  }, [])

  async function prefetchConversation(convId) {
    if (cache.get(`messages:${convId}`)) return
    const result = await getMessages(convId)
    if (result.data) cache.set(`messages:${convId}`, result.data, 20000)
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
          <Link href="/chat/hidden" style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#A3A3A3',
            textDecoration: 'none',
            marginRight: '4px',
          }}>
            Hidden
          </Link>
          <Link href="/groups/create" style={{
            width: '36px',
            height: '36px',
            border: '1.5px solid #0a0a0a',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: '16px',
            background: '#fff',
          }}>
            👥
          </Link>
          <Link href="/search" style={{
            width: '36px',
            height: '36px',
            border: '1.5px solid #0a0a0a',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            fontSize: '16px',
            background: '#fff',
          }}>
            ✏️
          </Link>
        </div>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorX: 'none' }}>
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
            <Link href="/search" style={{
              padding: '10px 20px',
              background: '#0a0a0a',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '3px 3px 0 #FFB800',
            }}>
              Find people
            </Link>
          </div>
        ) : (
          conversations.map(conv => {
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
                onClick={() => onSelectConversation?.(conv.conversation_id)}
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
                  onTouchStart={() => prefetchConversation(conv.conversation_id)}
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
    </div>
  )
}
