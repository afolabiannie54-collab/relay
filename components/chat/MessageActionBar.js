'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Smile, Reply, Copy, Pin, PinOff, Pencil, Trash2, CheckSquare, Star, StarOff, Forward } from 'lucide-react'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const EDIT_WINDOW_MS = 15 * 60 * 1000
const iconProps = { strokeWidth: 2.5, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Lucide's paths are stroke-only, drawn as three thin outlined circles —
// not built to be filled. A notebook doesn't outline everything, some
// marks get shaded in solid; three solid dots read as a much more
// confident "more" trigger than three faint rings at this size.
function DotsFilled({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--text-secondary)">
      <circle cx="5" cy="12" r="2.4" />
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="19" cy="12" r="2.4" />
    </svg>
  )
}

// Desktop-only floating action bar shown above a message on hover
// (visibility is pure CSS — see the .message-action-bar rule in
// chat/[id]/page.js — so hovering doesn't cost a re-render per message).
// The dropdown's open/closed state is lifted to the parent so a
// right-click on the bubble itself can open the same dropdown this
// bar's ⋯ button opens.
//
// Both popovers (emoji row, dropdown) are portalled to document.body with
// fixed positioning computed from the trigger button's own bounding rect,
// rather than living inside this bar as position:absolute children. That
// bar's visibility is CSS :hover-driven (see message-action-bar-wrap in
// chat/[id]/page.js) — an open popover nested inside it would fade out and
// go pointer-events:none the instant the cursor left the message row on
// its way down to actually click an item, which is exactly what made this
// feel broken rather than just badly positioned.
export default function MessageActionBar({
  message,
  isOwn,
  isPinned,
  isStarred,
  dropdownOpen,
  onDropdownOpenChange,
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
  const [showEmojiRow, setShowEmojiRow] = useState(false)
  const [popoverPos, setPopoverPos] = useState(null)
  const moreBtnRef = useRef(null)
  const reactBtnRef = useRef(null)

  const canEdit = isOwn && message.type === 'text' && (Date.now() - new Date(message.created_at).getTime()) < EDIT_WINDOW_MS

  const iconBtnStyle = {
    width: '30px',
    height: '30px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'background 0.1s ease, color 0.1s ease',
  }

  // Anchors a popover below-right of the trigger button, clamped so it
  // never renders off the right/bottom edge of the viewport — same math
  // as ConversationContextMenu's clamp.
  const anchorBelow = (btnRef, width, height) => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      left: Math.min(rect.right - width, window.innerWidth - width - 8),
      top: Math.min(rect.bottom + 4, window.innerHeight - height - 8),
    }
  }

  const openEmojiRow = () => {
    setPopoverPos(anchorBelow(reactBtnRef, 230, 44))
    setShowEmojiRow(true)
  }

  const openDropdown = () => {
    setPopoverPos(anchorBelow(moreBtnRef, 150, 220))
    onDropdownOpenChange?.(!dropdownOpen)
  }

  return (
    <div className="message-action-bar" style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        background: 'var(--surface)',
        border: '2px solid var(--border-strong)',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-hard-sm)',
        padding: '2px',
      }}>
        <button
          ref={reactBtnRef}
          className="relay-menu-row"
          style={{ ...iconBtnStyle, padding: 0 }}
          title="React"
          onClick={() => (showEmojiRow ? setShowEmojiRow(false) : openEmojiRow())}
        >
          <Smile size={18} {...iconProps} />
        </button>
        <button
          className="relay-menu-row"
          style={{ ...iconBtnStyle, padding: 0 }}
          title="Reply"
          onClick={onReply}
        >
          <Reply size={18} {...iconProps} />
        </button>
        <button
          ref={moreBtnRef}
          className="relay-menu-row"
          style={{ ...iconBtnStyle, padding: 0 }}
          title="More"
          onClick={openDropdown}
        >
          <DotsFilled size={18} />
        </button>
      </div>

      {showEmojiRow && popoverPos && createPortal(
        <>
          <div onClick={() => setShowEmojiRow(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div className="relay-popover" style={{
            position: 'fixed',
            left: popoverPos.left,
            top: popoverPos.top,
            background: 'var(--surface)',
            border: '2px solid var(--border-strong)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-hard-sm)',
            padding: '4px 6px',
            display: 'flex',
            gap: '2px',
            zIndex: 1000,
          }}>
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReact?.(emoji); setShowEmojiRow(false) }}
                className="relay-menu-row"
                style={{ width: '30px', padding: '4px', fontSize: '18px', justifyContent: 'center' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}

      {dropdownOpen && popoverPos && createPortal(
        <>
          <div onClick={() => onDropdownOpenChange?.(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div className="relay-popover" style={{
            position: 'fixed',
            left: popoverPos.left,
            top: popoverPos.top,
            background: 'var(--surface)',
            border: '2px solid var(--border-strong)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-hard-sm)',
            padding: '6px',
            zIndex: 1000,
            minWidth: '150px',
          }}>
            {message.type === 'text' && (
              <button className="relay-menu-row" style={{ color: 'var(--text)' }} onClick={() => { onCopy?.(); onDropdownOpenChange?.(false) }}>
                <Copy size={17} {...iconProps} /> Copy
              </button>
            )}
            <button className="relay-menu-row" style={{ color: 'var(--text)' }} onClick={() => { onForward?.(); onDropdownOpenChange?.(false) }}>
              <Forward size={17} {...iconProps} /> Forward
            </button>
            <button className="relay-menu-row" style={{ color: 'var(--text)' }} onClick={() => { onToggleStar?.(); onDropdownOpenChange?.(false) }}>
              {isStarred ? <StarOff size={17} {...iconProps} /> : <Star size={17} {...iconProps} />}
              {isStarred ? 'Unstar' : 'Star'}
            </button>
            <button className="relay-menu-row" style={{ color: 'var(--text)' }} onClick={() => { onTogglePin?.(); onDropdownOpenChange?.(false) }}>
              {isPinned ? <PinOff size={17} {...iconProps} /> : <Pin size={17} {...iconProps} />}
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
            {canEdit && (
              <button className="relay-menu-row" style={{ color: 'var(--text)' }} onClick={() => { onEdit?.(); onDropdownOpenChange?.(false) }}>
                <Pencil size={17} {...iconProps} /> Edit
              </button>
            )}
            {isOwn && (
              <button className="relay-menu-row" style={{ color: 'var(--error)' }} onClick={() => { onDelete?.(); onDropdownOpenChange?.(false) }}>
                <Trash2 size={17} {...iconProps} /> Delete
              </button>
            )}
            <button className="relay-menu-row" style={{ color: 'var(--text)' }} onClick={() => { onSelect?.(); onDropdownOpenChange?.(false) }}>
              <CheckSquare size={17} {...iconProps} /> Select
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
