'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { sendMessageRequest, getExistingConversation } from '@/actions/messages'
import { cache } from '@/lib/cache'
import { useProfileSheet } from '@/lib/profile-sheet-context'

const MESSAGE_MAX = 2000

// Primary profile-page action: contextual "Send message" (first contact,
// goes through the message-request flow) vs "Open chat" (a DM already
// exists). Blocking now lives in ProfileSheet's three-dot menu, not here.
export default function MessageButton({ receiverId, displayName }) {
  const [showCompose, setShowCompose] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [existingConvId, setExistingConvId] = useState(null)
  const [checking, setChecking] = useState(true)
  const [whoCanMessage, setWhoCanMessage] = useState('everyone')
  const router = useRouter()
  const { closeProfile } = useProfileSheet()

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
      // Not cached alongside conversationId above — that cache key/shape
      // is shared with ChatList.js and the search page's own row menus,
      // which only ever store/expect the scalar conversationId. Missing
      // this on a cache-hit repeat visit just means the button doesn't
      // know up front; sendMessageRequest's own server-side check is
      // still what actually blocks it either way.
      setWhoCanMessage(result.whoCanMessage || 'everyone')
      setChecking(false)
    }
    check()
  }, [receiverId])

  const goToChat = (conversationId) => {
    closeProfile()
    router.push(`/chat/${conversationId}`)
  }

  const handleSend = async () => {
    const text = message.trim()
    if (!text) return
    setSending(true)
    setError(null)

    const result = await sendMessageRequest(receiverId, text)

    if (result.error) {
      if (result.conversationId) {
        goToChat(result.conversationId)
        return
      }
      setError(result.error)
      setSending(false)
      return
    }

    goToChat(result.conversationId)
  }

  if (checking) {
    return (
      <button disabled className="relay-btn" style={{ padding: '10px 20px', opacity: 0.6 }}>
        ···
      </button>
    )
  }

  if (existingConvId) {
    return (
      <button onClick={() => goToChat(existingConvId)} className="relay-btn relay-btn--filled" style={{ padding: '11px 22px', boxShadow: 'var(--shadow-hard-accent)' }}>
        Open chat
      </button>
    )
  }

  if (showCompose) {
    return (
      <div style={{ width: '100%' }}>
        {error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: '12px',
            fontSize: '13px',
            color: 'var(--error)',
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
          className="relay-input"
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: '16px',
            resize: 'none',
            lineHeight: '1.5',
            marginBottom: '4px',
            boxSizing: 'border-box',
          }}
        />
        {message.length >= MESSAGE_MAX * 0.8 && (
          <p style={{
            fontSize: '11px',
            color: message.length >= MESSAGE_MAX ? 'var(--error)' : 'var(--text-tertiary)',
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
            className="relay-btn relay-btn--filled"
            style={{ flex: 1, padding: '10px', boxShadow: 'var(--shadow-hard-accent)' }}
          >
            {sending ? 'Sending...' : 'Send request'}
          </button>
          <button
            onClick={() => { setShowCompose(false); setMessage(''); setError(null) }}
            className="relay-btn"
            style={{ padding: '10px 16px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // "Who can message me" was being saved in Settings > Privacy but never
  // actually enforced anywhere — this button showed "Send message" for
  // every profile regardless. sendMessageRequest() still rejects this
  // server-side either way; this just avoids showing an affordance that
  // was always going to fail.
  if (whoCanMessage === 'nobody') {
    return (
      <button disabled className="relay-btn" style={{ padding: '11px 22px', opacity: 0.6, cursor: 'default' }}>
        Not accepting messages
      </button>
    )
  }

  return (
    <button onClick={() => setShowCompose(true)} className="relay-btn relay-btn--filled" style={{ padding: '11px 22px', boxShadow: 'var(--shadow-hard-accent)' }}>
      Send message
    </button>
  )
}
