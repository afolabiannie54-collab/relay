'use client'

import { useRef } from 'react'
import { toggleReaction } from '@/actions/messages'

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🙏']

export default function MessageReactions({ messageId, reactions, currentUserId, onReactionChange, showPicker, onTogglePicker }) {
  const grouped = reactions?.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasReacted: false }
    acc[r.emoji].count++
    acc[r.emoji].users.push(r.users?.display_name || 'Someone')
    if (r.user_id === currentUserId) acc[r.emoji].hasReacted = true
    return acc
  }, {}) || {}

  const handleReact = async (emoji) => {
    if (showPicker) onTogglePicker?.()
    const result = await toggleReaction(messageId, emoji)
    if (result.success) onReactionChange?.()
  }

  const containerRef = useRef(null)

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {Object.keys(grouped).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {Object.values(grouped).map(({ emoji, count, users, hasReacted }) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              title={users.join(', ')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                background: hasReacted ? 'var(--accent-light)' : 'var(--surface)',
                border: `1.5px solid ${hasReacted ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '100px',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              <span>{emoji}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: hasReacted ? 'var(--text)' : 'var(--text-secondary)' }}>
                {count}
              </span>
            </button>
          ))}
          <button
            onClick={() => onTogglePicker?.()}
            aria-label="Add reaction"
            style={{
              padding: '3px 10px',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '100px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              fontFamily: 'inherit',
            }}
          >+</button>
        </div>
      )}

      {showPicker && (
        <>
          <div
            onClick={() => onTogglePicker?.()}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          <div className="relay-popover" style={{
            position: 'fixed',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface)',
            border: '2px solid var(--border-strong)',
            borderRadius: '12px',
            padding: '8px',
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            zIndex: 100,
            boxShadow: 'var(--shadow-hard-sm)',
            width: '220px',
          }}>
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="relay-menu-row"
                style={{
                  width: '36px',
                  height: '36px',
                  padding: 0,
                  fontSize: '20px',
                  borderRadius: '8px',
                  justifyContent: 'center',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}