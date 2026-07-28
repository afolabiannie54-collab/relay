'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sendMessageRequest } from '@/actions/messages'
import { getExistingConversation } from '@/actions/messages'
import { blockUser } from '@/actions/blocks'

export default function MessageButton({ receiverId, displayName }) {
  const [showCompose, setShowCompose] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [existingConvId, setExistingConvId] = useState(null)
  const [checking, setChecking] = useState(true)
  const [blocking, setBlocking] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const result = await getExistingConversation(receiverId)
      if (result.conversationId) {
        setExistingConvId(result.conversationId)
      }
      setChecking(false)
    }
    check()
  }, [receiverId])

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    setError(null)

    const result = await sendMessageRequest(receiverId, message)

    if (result.error) {
      if (result.conversationId) {
        router.replace(`/chat/${result.conversationId}`)
        return
      }
      setError(result.error)
      setSending(false)
      return
    }

    router.replace(`/chat/${result.conversationId}`)
  }

  const handleBlock = async () => {
    if (!confirm(`Block ${displayName}? They won't be able to message you, and this conversation will be hidden.`)) return
    setBlocking(true)
    const result = await blockUser(receiverId)
    setBlocking(false)
    if (!result.error) {
      setBlocked(true)
    }
  }

  const blockButtonStyle = {
    padding: '10px 20px',
    background: '#fff',
    color: '#EF4444',
    border: '1.5px solid #EF4444',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: blocking ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }

  if (blocked) {
    return (
      <div>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '8px' }}>
          User blocked
        </p>
        <Link href="/chat" style={{ fontSize: '13px', color: '#525252', textDecoration: 'underline' }}>
          Back to chat
        </Link>
      </div>
    )
  }

  if (checking) return null

  if (existingConvId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
        <button
          onClick={() => router.replace(`/chat/${existingConvId}`)}
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
        <button onClick={handleBlock} disabled={blocking} style={blockButtonStyle}>
          {blocking ? 'Blocking...' : 'Block'}
        </button>
      </div>
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
          onChange={e => setMessage(e.target.value)}
          placeholder={`Say something to ${displayName}...`}
          rows={3}
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
            marginBottom: '10px',
            boxSizing: 'border-box',
          }}
        />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
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
        Message
      </button>
      <button onClick={handleBlock} disabled={blocking} style={blockButtonStyle}>
        {blocking ? 'Blocking...' : 'Block'}
      </button>
    </div>
  )
}
