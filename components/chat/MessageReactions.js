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
                background: hasReacted ? '#FFF8E1' : '#F5F5F5',
                border: `1.5px solid ${hasReacted ? '#FFB800' : '#E5E5E5'}`,
                borderRadius: '100px',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              <span>{emoji}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: hasReacted ? '#0a0a0a' : '#525252' }}>
                {count}
              </span>
            </button>
          ))}
          <button
            onClick={() => onTogglePicker?.()}
            style={{
              padding: '3px 8px',
              background: '#F5F5F5',
              border: '1.5px solid #E5E5E5',
              borderRadius: '100px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#A3A3A3',
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
          <div style={{
            position: 'fixed',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '12px',
            padding: '8px',
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            zIndex: 100,
            boxShadow: '3px 3px 0 #0a0a0a',
            width: '220px',
          }}>
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
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