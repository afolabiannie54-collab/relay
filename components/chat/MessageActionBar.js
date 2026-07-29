'use client'

import { useState } from 'react'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const EDIT_WINDOW_MS = 15 * 60 * 1000

// Desktop-only floating action bar shown above a message on hover
// (visibility is pure CSS — see the .message-action-bar rule in
// chat/[id]/page.js — so hovering doesn't cost a re-render per message).
// The dropdown's open/closed state is lifted to the parent so a
// right-click on the bubble itself can open the same dropdown this
// bar's ⋯ button opens.
export default function MessageActionBar({
  message,
  isOwn,
  isPinned,
  dropdownOpen,
  onDropdownOpenChange,
  onReply,
  onEdit,
  onDelete,
  onTogglePin,
  onReact,
  onCopy,
}) {
  const [showEmojiRow, setShowEmojiRow] = useState(false)

  const canEdit = isOwn && message.type === 'text' && (Date.now() - new Date(message.created_at).getTime()) < EDIT_WINDOW_MS

  const iconBtnStyle = {
    width: '28px',
    height: '28px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
  }

  const dropdownRowStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#0a0a0a',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }

  return (
    <div className="message-action-bar" style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        background: '#fff',
        border: '1.5px solid #0a0a0a',
        borderRadius: '8px',
        boxShadow: '2px 2px 0 #0a0a0a',
        padding: '2px',
      }}>
        <button style={iconBtnStyle} title="React" onClick={() => setShowEmojiRow(v => !v)}>🙂</button>
        <button style={iconBtnStyle} title="Reply" onClick={onReply}>↩️</button>
        <button
          style={iconBtnStyle}
          title="More"
          onClick={() => onDropdownOpenChange?.(!dropdownOpen)}
        >
          ⋯
        </button>
      </div>

      {showEmojiRow && (
        <>
          <div onClick={() => setShowEmojiRow(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '10px',
            boxShadow: '2px 2px 0 #0a0a0a',
            padding: '4px 6px',
            display: 'flex',
            gap: '2px',
            zIndex: 200,
          }}>
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => { onReact?.(emoji); setShowEmojiRow(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {dropdownOpen && (
        <>
          <div onClick={() => onDropdownOpenChange?.(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '10px',
            boxShadow: '2px 2px 0 #0a0a0a',
            padding: '4px 0',
            zIndex: 200,
            minWidth: '140px',
          }}>
            {message.type === 'text' && (
              <button style={dropdownRowStyle} onClick={() => { onCopy?.(); onDropdownOpenChange?.(false) }}>Copy</button>
            )}
            <button style={dropdownRowStyle} onClick={() => { onTogglePin?.(); onDropdownOpenChange?.(false) }}>
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
            {canEdit && (
              <button style={dropdownRowStyle} onClick={() => { onEdit?.(); onDropdownOpenChange?.(false) }}>Edit</button>
            )}
            {isOwn && (
              <button style={{ ...dropdownRowStyle, color: '#EF4444' }} onClick={() => { onDelete?.(); onDropdownOpenChange?.(false) }}>Delete</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
