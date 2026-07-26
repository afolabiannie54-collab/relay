'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import { getHiddenConversations, unhideConversation } from '@/actions/messages'

export default function HiddenConversationsPage() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [unhidingId, setUnhidingId] = useState(null)

  useEffect(() => {
    async function load() {
      const result = await getHiddenConversations()
      if (result.data) setConversations(result.data)
      setLoading(false)
    }
    load()
  }, [])

  const handleUnhide = async (conversationId) => {
    setUnhidingId(conversationId)
    await unhideConversation(conversationId)
    setConversations(prev => prev.filter(c => c.conversation_id !== conversationId))
    setUnhidingId(null)
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
              <div
                key={conv.conversation_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 20px',
                  borderBottom: '1px solid #F5F5F5',
                  background: '#fff',
                }}
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
                <button
                  onClick={() => handleUnhide(conv.conversation_id)}
                  disabled={unhidingId === conv.conversation_id}
                  style={{
                    padding: '8px 16px',
                    background: '#0a0a0a',
                    color: '#fff',
                    border: '1.5px solid #0a0a0a',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: unhidingId === conv.conversation_id ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: unhidingId === conv.conversation_id ? 'none' : '2px 2px 0 #FFB800',
                    flexShrink: 0,
                  }}
                >
                  {unhidingId === conv.conversation_id ? 'Unhiding...' : 'Unhide'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
