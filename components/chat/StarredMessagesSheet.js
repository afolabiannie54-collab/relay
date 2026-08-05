'use client'

import { useState, useEffect } from 'react'
import { StarOff } from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import Skeleton from '@/components/shared/Skeleton'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'
import { getStarredMessages, toggleStar } from '@/actions/messages'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Reused from the empty-state doodle set — a bookmark reads as "saved for
// later" without needing a literal star, which the row icons already carry.
const BOOKMARK_PATH = "M5 3.5C5 2.11929 6.11929 1 7.5 1H16.5C17.8807 1 19 2.11929 19 3.5V22.5C19 22.6893 18.893 22.8624 18.7236 22.9472C18.5543 23.0319 18.3516 23.0136 18.2 22.9L12 18.25L5.8 22.9C5.64841 23.0136 5.44574 23.0319 5.27639 22.9472C5.10704 22.8624 5 22.6893 5 22.5V3.5Z"

function formatWhen(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function previewOf(message) {
  if (!message) return ''
  if (message.type === 'image') return 'Photo'
  if (message.type === 'audio') return 'Voice message'
  if (message.type === 'file') return 'File'
  return message.content || ''
}

// Per-conversation list of the current user's starred messages. Tapping a
// row jumps to that message in the thread (onJumpTo), same affordance the
// pinned-messages panel already uses, so the two read as siblings.
export default function StarredMessagesSheet({ isOpen, onClose, conversationId, onJumpTo }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [unstarring, setUnstarring] = useState(null)

  useEffect(() => {
    if (!isOpen || !conversationId) return
    setLoading(true)
    setError(null)
    getStarredMessages(conversationId).then(result => {
      if (result.error) setError(result.error)
      else setRows(result.data || [])
      setLoading(false)
    })
  }, [isOpen, conversationId])

  const handleUnstar = async (row) => {
    setUnstarring(row.id)
    const result = await toggleStar(conversationId, row.message_id)
    setUnstarring(null)
    if (result?.error) {
      setError(result.error)
      return
    }
    setRows(prev => prev.filter(r => r.id !== row.id))
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Starred messages">
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
        {error && (
          <div style={{
            margin: '0 20px 8px',
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

        {loading ? (
          <div style={{ padding: '4px 0' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ padding: '12px 20px', borderBottom: i === 2 ? 'none' : '1px solid var(--border-light)' }}>
                <Skeleton width="110px" height="12px" style={{ marginBottom: '8px' }} />
                <Skeleton width="70%" height="14px" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 40px', textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <NotionDoodle d={BOOKMARK_PATH} size={110} />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', marginBottom: '4px', letterSpacing: '-0.01em' }}>
              No starred messages
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '260px' }}>
              Long-press any message and choose Star to save it here. Only you can see your starred messages.
            </p>
          </div>
        ) : (
          <div style={{ padding: '4px 0', maxHeight: '60dvh', overflowY: 'auto' }}>
            {rows.map((row, i) => (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 20px',
                  borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border-light)',
                }}
              >
                <button
                  onClick={() => { onJumpTo?.(row.message_id); onClose?.() }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>
                    {row.messages?.sender_name_snapshot}
                    <span style={{ fontWeight: '400', color: 'var(--text-tertiary)' }}>
                      {' · '}{formatWhen(row.messages?.created_at)}
                    </span>
                  </p>
                  <p style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.45',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {previewOf(row.messages)}
                  </p>
                </button>
                <button
                  onClick={() => handleUnstar(row)}
                  disabled={unstarring === row.id}
                  aria-label="Unstar"
                  title="Unstar"
                  className="relay-plain-icon-btn"
                  style={{ width: '32px', height: '32px', flexShrink: 0, opacity: unstarring === row.id ? 0.5 : 1 }}
                >
                  <StarOff size={16} {...iconProps} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
