'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { sendMessageRequest, getExistingConversation } from '@/actions/messages'
import { cache } from '@/lib/cache'

const MESSAGE_MAX = 2000

// Primary profile-page action: contextual "Send message" (first contact,
// goes through the message-request flow) vs "Open chat" (a DM already
// exists). Blocking now lives in ProfileMenu's three-dot menu, not here.
export default function MessageButton({ receiverId, displayName }) {
  const [showCompose, setShowCompose] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [existingConvId, setExistingConvId] = useState(null)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Cached as the resolved conversationId, or `false` for "checked, no
    // DM exists" — distinct from `null` (never checked) — so a repeat
    // visit to this profile resolves instantly instead of visibly
    // flashing "Send message" before switching to "Open chat".
    const cacheKey = `existing-dm:${receiverId}`
    const cached = cache.get(cacheKey)
    if (cached !== null) {
      setExistingConvId(cached || null)
      setChecking(false)
      return
    }

    setChecking(true)
    async function check() {
      const result = await getExistingConversation(receiverId)
      cache.set(cacheKey, result.conversationId || false, 30000)
      if (result.conversationId) {
        setExistingConvId(result.conversationId)
      }
      setChecking(false)
    }
    check()
  }, [receiverId])

  const handleSend = async () => {
    const text = message.trim()
    if (!text) return
    setSending(true)
    setError(null)

    const result = await sendMessageRequest(receiverId, text)

    if (result.error) {
      if (result.conversationId) {
        router.push(`/chat/${result.conversationId}`)
        return
      }
      setError(result.error)
      setSending(false)
      return
    }

    router.push(`/chat/${result.conversationId}`)
  }

  if (checking) {
    return (
      <button
        disabled
        style={{
          padding: '10px 20px',
          background: '#525252',
          color: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'not-allowed',
          fontFamily: 'inherit',
          opacity: 0.6,
        }}
      >
        ···
      </button>
    )
  }

  if (existingConvId) {
    return (
      <button
        onClick={() => router.push(`/chat/${existingConvId}`)}
        style={{
          padding: '10px 20px',
          background: '#0a0a0a',
          color: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: '3px 3px 0 #FFB800',
        }}
      >
        Open chat
      </button>
    )
  }

  if (showCompose) {
    return (
      <div style={{ width: '100%' }}>
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1.5px solid #EF4444',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#EF4444',
          }}>
            {error}
          </div>
        )}
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          placeholder={`Say something to ${displayName}...`}
          rows={3}
          maxLength={MESSAGE_MAX}
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            border: '1.5px solid #0a0a0a',
            borderRadius: '8px',
            fontSize: '16px',
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'none',
            lineHeight: '1.5',
            marginBottom: '4px',
            boxSizing: 'border-box',
          }}
        />
        {message.length >= MESSAGE_MAX * 0.8 && (
          <p style={{
            fontSize: '11px',
            color: message.length >= MESSAGE_MAX ? '#EF4444' : '#A3A3A3',
            textAlign: 'right',
            marginBottom: '6px',
          }}>
            {message.length}/{MESSAGE_MAX}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            style={{
              flex: 1,
              padding: '10px',
              background: message.trim() ? '#0a0a0a' : '#525252',
              color: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: message.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              boxShadow: message.trim() ? '2px 2px 0 #FFB800' : 'none',
            }}
          >
            {sending ? 'Sending...' : 'Send request'}
          </button>
          <button
            onClick={() => { setShowCompose(false); setMessage(''); setError(null) }}
            style={{
              padding: '10px 16px',
              background: '#fff',
              color: '#525252',
              border: '1.5px solid #E5E5E5',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowCompose(true)}
      style={{
        padding: '10px 20px',
        background: '#0a0a0a',
        color: '#fff',
        border: '1.5px solid #0a0a0a',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: '3px 3px 0 #FFB800',
      }}
    >
      Send message
    </button>
  )
}
