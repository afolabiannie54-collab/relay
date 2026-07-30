'use client'

import { useState } from 'react'
import BottomSheet from '@/components/shared/BottomSheet'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const MORE_EMOJIS = ['🔥', '👏', '😍', '😡', '🎉', '👀']

const EDIT_WINDOW_MS = 15 * 60 * 1000

// Long-press menu for a single message bubble. `message` is the full
// message row (id, content, type, sender_id, created_at). The actual
// mutations (edit/delete/pin/reply/react) stay owned by the
// conversation page — this just calls back into them.
export default function MessageActionSheet({
  message,
  isOpen,
  onClose,
  isOwn,
  isPinned,
  onReply,
  onEdit,
  onDelete,
  onTogglePin,
  onReact,
  onCopy,
  onSelect,
}) {
  const [showMoreEmojis, setShowMoreEmojis] = useState(false)

  if (!message) return null

  const canEdit = isOwn && message.type === 'text' && (Date.now() - new Date(message.created_at).getTime()) < EDIT_WINDOW_MS

  const rowStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '14px 20px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#0a0a0a',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px 12px', borderBottom: '1px solid #E5E5E5' }}>
          {(showMoreEmojis ? [...QUICK_EMOJIS, ...MORE_EMOJIS] : QUICK_EMOJIS).map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact?.(emoji); onClose?.() }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '24px',
                padding: '6px',
                borderRadius: '50%',
                lineHeight: 1,
              }}
            >
              {emoji}
            </button>
          ))}
          {!showMoreEmojis && (
            <button
              onClick={() => setShowMoreEmojis(true)}
              aria-label="More reactions"
              style={{
                background: '#F5F5F5',
                border: '1.5px solid #E5E5E5',
                borderRadius: '50%',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                fontSize: '16px',
                color: '#525252',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ⊕
            </button>
          )}
        </div>

        <div style={{ padding: '8px 0' }}>
          <button style={rowStyle} onClick={() => { onReply?.(); onClose?.() }}>↩️ Reply</button>
          {message.type === 'text' && (
            <button style={rowStyle} onClick={() => { onCopy?.(); onClose?.() }}>📋 Copy</button>
          )}
          <button style={rowStyle} onClick={() => { onTogglePin?.(); onClose?.() }}>
            {isPinned ? '📌 Unpin' : '📌 Pin'}
          </button>
          {canEdit && (
            <button style={rowStyle} onClick={() => { onEdit?.(); onClose?.() }}>✏️ Edit</button>
          )}
          {isOwn && (
            <button style={{ ...rowStyle, color: '#EF4444' }} onClick={() => { onDelete?.(); onClose?.() }}>🗑️ Delete</button>
          )}
          <button style={rowStyle} onClick={() => { onSelect?.(); onClose?.() }}>☑️ Select messages</button>
          <div style={{ borderTop: '1px solid #E5E5E5', margin: '4px 0' }} />
          <button style={{ ...rowStyle, color: '#A3A3A3' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </BottomSheet>
  )
}
