'use client'

import { useState } from 'react'
import { revokeSession } from '@/actions/sessions'

function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown browser', os: 'Unknown device' }

  let browser = 'Unknown browser'
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari'

  let os = 'Unknown device'
  if (/iPad/.test(ua)) os = 'iPad'
  else if (/iPhone/.test(ua)) os = 'iPhone'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Windows/.test(ua)) os = 'Windows'
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac'
  else if (/Linux/.test(ua)) os = 'Linux'

  return { browser, os }
}

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
  const [error, setError] = useState(null)

  const handleRevoke = async () => {
    setRevoking(true)
    setError(null)
    const result = await revokeSession(session.id)
    setRevoking(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setRevoked(true)
    }
  }

  if (revoked) return null

  const { browser, os } = parseUserAgent(session.user_agent)

  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
    }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <p style={{
            fontSize: '14px',
            fontWeight: '700',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {browser} · {os}
          </p>
          {session.is_current && (
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--on-accent)',
              background: 'var(--accent)',
              border: '1.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-pill)',
              padding: '1px 8px',
              flexShrink: 0,
            }}>
              This device
            </span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {session.ip || 'Unknown IP'} · {formatRelative(session.created_at)}
        </p>
      </div>
      {!session.is_current && (
        <button
          onClick={handleRevoke}
          disabled={revoking}
          style={{
            padding: '8px 16px',
            background: 'var(--surface)',
            color: 'var(--error)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: revoking ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
            opacity: revoking ? 0.6 : 1,
          }}
        >
          {revoking ? 'Logging out...' : 'Log out'}
        </button>
      )}
    </div>
    {error && (
      <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>
    )}
    </div>
  )
}
