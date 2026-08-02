'use client'

import { useState } from 'react'
import { Plus, Reply, Copy, Pin, PinOff, Pencil, Trash2, CheckSquare } from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const MORE_EMOJIS = ['🔥', '👏', '😍', '😡', '🎉', '👀']

const EDIT_WINDOW_MS = 15 * 60 * 1000
const iconProps = { strokeWidth: 2.5, strokeLinecap: 'square', strokeLinejoin: 'miter' }

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

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px 12px', borderBottom: '1px solid var(--border-light)' }}>
          {(showMoreEmojis ? [...QUICK_EMOJIS, ...MORE_EMOJIS] : QUICK_EMOJIS).map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact?.(emoji); onClose?.() }}
              className="relay-menu-row"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                fontSize: '24px',
                borderRadius: '50%',
                justifyContent: 'center',
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
                background: 'var(--gray-100)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={16} {...iconProps} />
            </button>
          )}
        </div>

        <div style={{ padding: '8px' }}>
          <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onReply?.(); onClose?.() }}>
            <Reply size={17} {...iconProps} /> Reply
          </button>
          {message.type === 'text' && (
            <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onCopy?.(); onClose?.() }}>
              <Copy size={17} {...iconProps} /> Copy
            </button>
          )}
          <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onTogglePin?.(); onClose?.() }}>
            {isPinned ? <PinOff size={17} {...iconProps} /> : <Pin size={17} {...iconProps} />}
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
          {canEdit && (
            <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onEdit?.(); onClose?.() }}>
              <Pencil size={17} {...iconProps} /> Edit
            </button>
          )}
          {isOwn && (
            <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--error)' }} onClick={() => { onDelete?.(); onClose?.() }}>
              <Trash2 size={17} {...iconProps} /> Delete
            </button>
          )}
          <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onSelect?.(); onClose?.() }}>
            <CheckSquare size={17} {...iconProps} /> Select messages
          </button>
          <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
          <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text-tertiary)' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </BottomSheet>
  )
}
