'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { deleteAccount } from '@/actions/blocks'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export default function DeleteAccountPage() {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return
    setDeleting(true)
    setError(null)

    const result = await deleteAccount()

    if (result?.error) {
      setError(result.error)
      setDeleting(false)
      return
    }

    window.location.href = '/login'
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-subtle)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border-strong)',
        padding: '14px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div className="relay-page-header-row" style={{ gap: '6px' }}>
          <Link
            href="/settings"
            aria-label="Back"
            className="relay-plain-icon-btn"
            style={{ width: '34px', height: '34px', marginLeft: '-8px', flexShrink: 0 }}
          >
            <ChevronLeft size={22} {...iconProps} />
          </Link>
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Delete account</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          background: 'var(--error-light)',
          border: '1px solid var(--error)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--error)', marginBottom: '8px' }}>
            This action is permanent
          </p>
          <p style={{ fontSize: '14px', color: 'var(--error)', lineHeight: '1.6' }}>
            Deleting your account will permanently remove your profile, messages, groups, and all associated data. This cannot be undone.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--error)',
          }}>
            {error}
          </div>
        )}

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
        }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '8px' }}>
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="relay-input"
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: '16px',
              marginBottom: '16px',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || deleting}
            style={{
              width: '100%',
              padding: '14px',
              background: confirmText === 'DELETE' ? 'var(--error)' : 'var(--gray-100)',
              color: confirmText === 'DELETE' ? '#fff' : 'var(--text-tertiary)',
              border: `1.5px solid ${confirmText === 'DELETE' ? 'var(--error)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: '700',
              cursor: confirmText === 'DELETE' && !deleting ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {deleting ? 'Deleting...' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  )
}
