'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Check, Forward } from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import Avatar from '@/components/shared/Avatar'
import RowSkeleton from '@/components/shared/RowSkeleton'
import { getConversations, forwardMessages } from '@/actions/messages'
import { getBlockedUserIds } from '@/actions/blocks'
import { cache } from '@/lib/cache'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Multi-select conversation picker for forwarding. Deliberately excludes
// the conversation being forwarded FROM — forwarding a message back into
// the chat it already lives in is never the intent, and leaving it in the
// list is an easy misfire.
export default function ForwardSheet({ isOpen, onClose, messageIds, fromConversationId, onForwarded }) {
  const [conversations, setConversations] = useState([])
  // Covers both directions (people you blocked and people who blocked
  // you) — getBlockedUserIds already returns the union, and forwarding is
  // refused either way, so both must be hidden.
  const [blockedIds, setBlockedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    // Reset per open — this component stays mounted with isOpen toggled,
    // so without this the previous forward's selection would still be
    // ticked the next time it opens.
    setSelected(new Set())
    setQuery('')
    setError(null)
    setSending(false)

    const cached = cache.peek('conversations')
    if (cached) {
      setConversations(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }

    Promise.all([getConversations(), getBlockedUserIds()]).then(([result, blocked]) => {
      if (result.data) {
        setConversations(result.data)
        cache.set('conversations', result.data, 10000)
      }
      setBlockedIds(new Set(blocked?.data || []))
      setLoading(false)
    })
  }, [isOpen])

  const targets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations
      .filter(c => c.conversation_id !== fromConversationId)
      // Blocked DMs are removed from the list entirely rather than left
      // in to fail on send. Offering a target that can only ever be
      // rejected is a trap; a block should simply mean that person isn't
      // somewhere you can send to. Groups are unaffected — a block
      // between two members doesn't stop group messaging.
      .filter(c => {
        if (c.type === 'group') return true
        const otherId = c.other_participants?.[0]?.user_id
        return !otherId || !blockedIds.has(otherId)
      })
      .filter(c => {
        if (!q) return true
        const name = (c.type === 'group' ? c.group_info?.name : c.other_participants?.[0]?.display_name) || ''
        return name.toLowerCase().includes(q)
      })
  }, [conversations, query, fromConversationId, blockedIds])

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleForward = async () => {
    if (selected.size === 0 || sending) return
    setSending(true)
    setError(null)

    const result = await forwardMessages(messageIds, [...selected])

    if (result?.error) {
      setError(result.error)
      setSending(false)
      return
    }

    try { window.navigator.vibrate?.(10) } catch {}
    setSending(false)
    onForwarded?.(result)
    onClose?.()
  }

  const count = messageIds?.length || 0

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Forward ${count} message${count === 1 ? '' : 's'}`}>
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", display: 'flex', flexDirection: 'column', maxHeight: '70dvh' }}>
        {error && (
          <div style={{
            margin: '0 20px 10px',
            padding: '10px 14px',
            background: 'var(--error-light)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: 'var(--error)',
          }}>
            {error}
          </div>
        )}

        <div style={{ padding: '4px 20px 12px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              {...iconProps}
              style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="relay-input"
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-pill)', fontSize: '16px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton isLast />
            </>
          ) : targets.length === 0 ? (
            <p style={{ padding: '32px 20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)' }}>
              {query.trim() ? `No conversations match "${query}"` : 'No other conversations to forward to.'}
            </p>
          ) : (
            targets.map(conv => {
              const isGroup = conv.type === 'group'
              const other = conv.other_participants?.[0]
              const name = isGroup ? conv.group_info?.name : other?.display_name
              const avatarUrl = isGroup ? conv.group_info?.avatar_url : other?.avatar_url
              const isSelected = selected.has(conv.conversation_id)

              return (
                <button
                  key={conv.conversation_id}
                  onClick={() => toggle(conv.conversation_id)}
                  className="relay-menu-row"
                  style={{ width: '100%', padding: '10px 20px', borderRadius: 0, borderBottom: '1px solid var(--border-light)' }}
                >
                  <Avatar src={avatarUrl} name={name} size={40} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name || 'Unknown'}
                    </p>
                    {!isGroup && other?.username && (
                      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{other.username}</p>
                    )}
                  </div>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: 'var(--radius-pill)',
                    border: `2px solid ${isSelected ? 'var(--border-strong)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent)' : 'var(--surface)',
                    color: 'var(--on-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isSelected && <Check size={13} strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
          <button
            onClick={handleForward}
            disabled={selected.size === 0 || sending}
            className="relay-btn relay-btn--filled"
            style={{ width: '100%', padding: '12px', fontSize: '14px', gap: '8px', boxShadow: selected.size > 0 ? 'var(--shadow-hard-accent)' : 'none' }}
          >
            <Forward size={16} {...iconProps} />
            {sending
              ? 'Forwarding…'
              : selected.size === 0
                ? 'Select conversations'
                : `Forward to ${selected.size}`}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
