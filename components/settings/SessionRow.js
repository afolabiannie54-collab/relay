'use client'

import { useState } from 'react'
import { revokeSession } from '@/actions/sessions'

function formatRelative(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function SessionRow({ session, isLast }) {
  const [revoking, setRevoking] = useState(false)
  const [revoked, setRevoked] = useState(false)

  const handleRevoke = async () => {
    setRevoking(true)
    const result = await revokeSession(session.id)
    setRevoking(false)
    if (!result?.error) {
      setRevoked(true)
    }
  }

  if (revoked) return null

  return (
    <div style={{
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      borderBottom: isLast ? 'none' : '1px solid #F5F5F5',
    }}>
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <p style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#0a0a0a',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {session.ip || 'Unknown IP'} · {formatRelative(session.created_at)}
        </p>
        {session.is_current && (
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#0a0a0a',
            background: '#FFB800',
            border: '1.5px solid #0a0a0a',
            borderRadius: '100px',
            padding: '1px 8px',
            flexShrink: 0,
          }}>
            This device
          </span>
        )}
      </div>
      {!session.is_current && (
        <button
          onClick={handleRevoke}
          disabled={revoking}
          style={{
            padding: '8px 16px',
            background: '#fff',
            color: '#EF4444',
            border: '1.5px solid #EF4444',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: revoking ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {revoking ? 'Logging out...' : 'Log out'}
        </button>
      )}
    </div>
  )
}
