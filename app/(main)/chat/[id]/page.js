'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import { getMessages, sendMessage, getConversation, markConversationRead, editMessage, deleteMessage } from '@/actions/messages'
import { getOwnProfile } from '@/actions/users'
import { createClient } from '@/lib/supabase/client'

export default function ConversationPage() {
  const { id } = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [profile, setProfile] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimeout = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    async function load() {
      const [msgsResult, convResult, profileResult] = await Promise.all([
        getMessages(id),
        getConversation(id),
        getOwnProfile(),
      ])
      if (msgsResult.data) setMessages(msgsResult.data)
      if (convResult.data) setConversation(convResult.data)
      if (profileResult.data) setProfile(profileResult.data)
      setLoading(false)
      await markConversationRead(id)
    }
    load()
  }, [id])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`conversation:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, async (payload) => {
        const newMsg = { ...payload.new, reply: null }
        if (payload.new.reply_to_id) {
          const supabase = createClient()
          const { data: reply } = await supabase
            .from('messages')
            .select('id, content, sender_name_snapshot, type')
            .eq('id', payload.new.reply_to_id)
            .single()
          newMsg.reply = reply || null
        }
        setMessages(prev => {
          const exists = prev.find(m => m.id === newMsg.id)
          if (exists) return prev
          return [...prev, newMsg]
        })
        markConversationRead(id)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev => prev.map(m =>
          m.id === payload.new.id ? { ...m, ...payload.new } : m
        ))
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId === profile?.id) return
        setTypingUsers(prev => {
          if (payload.payload.isTyping) {
            if (prev.find(u => u.userId === payload.payload.userId)) return prev
            return [...prev, payload.payload]
          } else {
            return prev.filter(u => u.userId !== payload.payload.userId)
          }
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, profile?.id])

  const handleTyping = async () => {
    if (!channelRef.current || !profile) return

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: profile.id, displayName: profile.display_name, isTyping: true },
    })

    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id, displayName: profile.display_name, isTyping: false },
      })
    }, 2000)
  }

  const handleSend = async () => {
    if (!content.trim() || sending) return

    setSending(true)
    const text = content.trim()
    setContent('')
    setReplyTo(null)

    // Stop typing indicator
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: profile?.id, displayName: profile?.display_name, isTyping: false },
    })

    const result = await sendMessage(id, text, replyTo?.id || null)
    if (result.error) {
      setContent(text)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleEdit = async (messageId) => {
    if (!editContent.trim()) return
    const result = await editMessage(messageId, editContent)
    if (!result.error) {
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleDelete = async (messageId) => {
    if (!confirm('Delete this message for everyone?')) return
    await deleteMessage(messageId)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherParticipant = conversation?.participants?.[0]

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return date.toLocaleDateString([], { month: 'long', day: 'numeric' })
  }

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

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
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1.5px solid #E5E5E5',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#fff',
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push('/chat')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ←
        </button>
        {otherParticipant && (
          <Link href={`/u/${otherParticipant.username}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <Avatar src={otherParticipant.avatar_url} name={otherParticipant.display_name} size={38} />
            <div>
              <p style={{ fontSize: '15px', fontWeight: '700', color: '#0a0a0a' }}>
                {otherParticipant.display_name}
              </p>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{otherParticipant.username}</p>
            </div>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            {/* Date divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '16px 0 8px',
            }}>
              <div style={{ flex: 1, height: '1px', background: '#E5E5E5' }} />
              <span style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '600' }}>
                {formatDate(msgs[0].created_at)}
              </span>
              <div style={{ flex: 1, height: '1px', background: '#E5E5E5' }} />
            </div>

            {msgs.map((msg, i) => {
              const isOwn = msg.sender_id === profile?.id
              const isSystem = msg.type === 'system'
              const isDeleted = msg.type === 'deleted'
              const showAvatar = !isOwn && (i === 0 || msgs[i - 1]?.sender_id !== msg.sender_id)

              if (isSystem) {
                return (
                  <div key={msg.id} style={{
                    textAlign: 'center',
                    padding: '8px 0',
                    fontSize: '12px',
                    color: '#A3A3A3',
                  }}>
                    {msg.content}
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: isOwn ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    gap: '8px',
                    marginBottom: '2px',
                    marginTop: showAvatar ? '8px' : '0',
                  }}
                >
                  {/* Avatar for other user */}
                  {!isOwn && (
                    <div style={{ width: '28px', flexShrink: 0 }}>
                      {showAvatar && (
                        <Avatar
                          src={otherParticipant?.avatar_url}
                          name={msg.sender_name_snapshot}
                          size={28}
                        />
                      )}
                    </div>
                  )}

                  <div style={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isOwn ? 'flex-end' : 'flex-start',
                  }}>
                    {/* Reply preview */}
                    {msg.reply && (
                      <div style={{
                        padding: '6px 10px',
                        background: '#F5F5F5',
                        borderRadius: '8px',
                        marginBottom: '4px',
                        borderLeft: '3px solid #FFB800',
                        fontSize: '12px',
                        color: '#525252',
                        maxWidth: '100%',
                      }}>
                        <p style={{ fontWeight: '700', marginBottom: '2px', fontSize: '11px' }}>
                          {msg.reply.sender_name_snapshot}
                        </p>
                        <p style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {msg.reply.type === 'deleted' ? 'Original message was deleted' : msg.reply.content}
                        </p>
                      </div>
                    )}

                    {/* Message bubble */}
                    {editingId === msg.id ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleEdit(msg.id)
                            if (e.key === 'Escape') { setEditingId(null); setEditContent('') }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1.5px solid #0a0a0a',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => handleEdit(msg.id)}
                          style={{
                            padding: '8px 12px',
                            background: '#0a0a0a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditContent('') }}
                          style={{
                            padding: '8px 12px',
                            background: '#F5F5F5',
                            color: '#0a0a0a',
                            border: '1.5px solid #E5E5E5',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: isDeleted ? '8px 12px' : '10px 14px',
                          background: isDeleted ? '#F5F5F5' : isOwn ? '#0a0a0a' : '#F5F5F5',
                          color: isDeleted ? '#A3A3A3' : isOwn ? '#fff' : '#0a0a0a',
                          borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                          border: '1.5px solid #0a0a0a',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          fontStyle: isDeleted ? 'italic' : 'normal',
                          position: 'relative',
                          cursor: isOwn && !isDeleted ? 'pointer' : 'default',
                          wordBreak: 'break-word',
                        }}
                        onContextMenu={e => {
                          if (!isOwn || isDeleted) return
                          e.preventDefault()
                          setEditingId(msg.id)
                          setEditContent(msg.content)
                        }}
                      >
                        {isDeleted ? 'This message was deleted' : msg.content}
                      </div>
                    )}

                    {/* Time and edited label */}
                    <div style={{
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'center',
                      marginTop: '2px',
                    }}>
                      {msg.is_edited && (
                        <span style={{ fontSize: '10px', color: '#A3A3A3' }}>edited</span>
                      )}
                      <span style={{ fontSize: '10px', color: '#A3A3A3' }}>
                        {formatTime(msg.created_at)}
                      </span>
                      {isOwn && !isDeleted && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '10px',
                            color: '#A3A3A3',
                            padding: '0',
                            fontFamily: 'inherit',
                          }}
                        >
                          Delete
                        </button>
                      )}
                      {isOwn && !isDeleted && (
                        <button
                          onClick={() => { setEditingId(msg.id); setEditContent(msg.content) }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '10px',
                            color: '#A3A3A3',
                            padding: '0',
                            fontFamily: 'inherit',
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {!isOwn && !isDeleted && (
                        <button
                          onClick={() => setReplyTo(msg)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '10px',
                            color: '#A3A3A3',
                            padding: '0',
                            fontFamily: 'inherit',
                          }}
                        >
                          Reply
                        </button>
                      )}
                      {isOwn && !isDeleted && (
                        <button
                          onClick={() => setReplyTo(msg)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '10px',
                            color: '#A3A3A3',
                            padding: '0',
                            fontFamily: 'inherit',
                          }}
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 0',
          }}>
            <div style={{
              padding: '8px 14px',
              background: '#F5F5F5',
              borderRadius: '4px 16px 16px 16px',
              border: '1.5px solid #E5E5E5',
              fontSize: '13px',
              color: '#A3A3A3',
              fontStyle: 'italic',
            }}>
              {typingUsers.length === 1
                ? `${typingUsers[0].displayName} is typing...`
                : 'Several people are typing...'}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div style={{
          padding: '8px 16px',
          background: '#F5F5F5',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1,
            borderLeft: '3px solid #FFB800',
            paddingLeft: '10px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#0a0a0a', marginBottom: '2px' }}>
              Replying to {replyTo.sender_name_snapshot}
            </p>
            <p style={{
              fontSize: '12px',
              color: '#525252',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {replyTo.content}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#A3A3A3',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1.5px solid #E5E5E5',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        background: '#fff',
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={content}
          onChange={e => { setContent(e.target.value); handleTyping() }}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1.5px solid #E5E5E5',
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'none',
            lineHeight: '1.5',
            maxHeight: '120px',
            overflowY: 'auto',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = '#0a0a0a'}
          onBlur={e => e.target.style.borderColor = '#E5E5E5'}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          style={{
            width: '40px',
            height: '40px',
            background: content.trim() ? '#0a0a0a' : '#E5E5E5',
            border: '1.5px solid #0a0a0a',
            borderRadius: '10px',
            cursor: content.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
            transition: 'background 0.15s',
            boxShadow: content.trim() ? '2px 2px 0 #FFB800' : 'none',
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}