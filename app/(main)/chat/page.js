'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import { getConversations } from '@/actions/messages'
import { getOwnProfile } from '@/actions/users'
import { createClient } from '@/lib/supabase/client'

export default function ChatPage() {
  const [conversations, setConversations] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [convsResult, profileResult] = await Promise.all([
        getConversations(),
        getOwnProfile(),
      ])
      if (convsResult.data) setConversations(convsResult.data)
      if (profileResult.data) setProfile(profileResult.data)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('chat-list-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async () => {
        const result = await getConversations()
        if (result.data) setConversations(result.data)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

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

  const getUnreadCount = (conv) => {
    if (!conv.last_read_at || !conv.last_message) return 0
    if (new Date(conv.last_message.created_at) > new Date(conv.last_read_at)) {
      return 1
    }
    return 0
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
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0a0a0a' }}>Messages</h1>
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
            const isGroup = conv.conversation?.type === 'group'
            const otherUser = conv.other_participants?.[0]
            const displayName = isGroup ? conv.group?.name : otherUser?.display_name
            const avatarUrl = isGroup ? conv.group?.avatar_url : otherUser?.avatar_url

            return (
              <Link
                key={conv.conversation_id}
                href={`/chat/${conv.conversation_id}`}
                style={{ textDecoration: 'none' }}
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
                  onMouseEnter={e => e.currentTarget.style.background = '#F9F9F9'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
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
                      }}>
                        {displayName || 'Unknown'}
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
                        {lastMessage?.sender_id === profile?.id ? 'You: ' : ''}{getLastMessagePreview(lastMessage)}
                      </p>
                      {getUnreadCount(conv) > 0 && conv.last_message?.sender_id !== profile?.id && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          background: '#FFB800',
                          borderRadius: '50%',
                          border: '1.5px solid #0a0a0a',
                          flexShrink: 0,
                          marginLeft: '8px',
                        }} />
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}