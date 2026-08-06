'use client'

import { useState } from 'react'
import { Plus, Reply, Copy, Pin, PinOff, Pencil, Trash2, CheckSquare, Star, StarOff, Forward } from 'lucide-react'
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
  isStarred,
  onReply,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleStar,
  onForward,
  onReact,
  onCopy,
  onSelect,
}) {
  const [showMoreEmojis, setShowMoreEmojis] = useState(false)

  if (!message) return null

  const canEdit = isOwn && message.type === 'text' && (Date.now() - new Date(message.created_at).getTime()) < EDIT_WINDOW_MS

  // Not yet accepted by the server, so it only exists client-side under a
  // temp id — every action that names it to the server would reference a
  // row that doesn't exist. Copy works off local text, so it survives.
  const isPending = message._status === 'sending' || message._status === 'failed'

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
        {!isPending && (
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
        )}

        <div style={{ padding: '8px' }}>
          {isPending && (
            <p style={{ padding: '12px', fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              {message._status === 'failed'
                ? 'This message hasn\'t sent yet. Close this and tap the message to retry.'
                : 'This message is still sending. Other actions become available once it\'s delivered.'}
            </p>
          )}
          {!isPending && (
          <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onReply?.(); onClose?.() }}>
            <Reply size={17} {...iconProps} /> Reply
          </button>
          )}
          {message.type === 'text' && (
            <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onCopy?.(); onClose?.() }}>
              <Copy size={17} {...iconProps} /> Copy
            </button>
          )}
          {!isPending && (
            <>
              <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onForward?.(); onClose?.() }}>
                <Forward size={17} {...iconProps} /> Forward
              </button>
              {/* Starring is private to this user, unlike pinning which is
                  shared with the whole conversation — they sit next to each
                  other deliberately so the distinction is easy to learn. */}
              <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onToggleStar?.(); onClose?.() }}>
                {isStarred ? <StarOff size={17} {...iconProps} /> : <Star size={17} {...iconProps} />}
                {isStarred ? 'Unstar' : 'Star'}
              </button>
              <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onTogglePin?.(); onClose?.() }}>
                {isPinned ? <PinOff size={17} {...iconProps} /> : <Pin size={17} {...iconProps} />}
                {isPinned ? 'Unpin' : 'Pin'}
              </button>
            </>
          )}
          {canEdit && !isPending && (
            <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onEdit?.(); onClose?.() }}>
              <Pencil size={17} {...iconProps} /> Edit
            </button>
          )}
          {isOwn && !isPending && (
            <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--error)' }} onClick={() => { onDelete?.(); onClose?.() }}>
              <Trash2 size={17} {...iconProps} /> Delete
            </button>
          )}
          {!isPending && (
            <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text)' }} onClick={() => { onSelect?.(); onClose?.() }}>
              <CheckSquare size={17} {...iconProps} /> Select messages
            </button>
          )}
          <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
          <button className="relay-menu-row" style={{ padding: '14px 12px', fontSize: '15px', color: 'var(--text-tertiary)' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </BottomSheet>
  )
}
