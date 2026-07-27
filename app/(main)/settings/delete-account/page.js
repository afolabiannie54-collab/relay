'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteAccount } from '@/actions/blocks'

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
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #0a0a0a',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/settings" style={{
          textDecoration: 'none',
          color: '#0a0a0a',
          fontSize: '14px',
          fontWeight: '600',
        }}>
          ← Back
        </Link>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Delete account</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{
          background: '#FEF2F2',
          border: '1.5px solid #EF4444',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
        }}>
          <p style={{ fontSize: '16px', fontWeight: '800', color: '#EF4444', marginBottom: '8px' }}>
            This action is permanent
          </p>
          <p style={{ fontSize: '14px', color: '#7F1D1D', lineHeight: '1.6' }}>
            Deleting your account will permanently remove your profile, messages, groups, and all associated data. This cannot be undone.
          </p>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1.5px solid #EF4444',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#EF4444',
          }}>
            {error}
          </div>
        )}

        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '4px 4px 0 #0a0a0a',
        }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '8px' }}>
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            style={{
              width: '100%',
              padding: '12px 14px',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
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
              background: confirmText === 'DELETE' ? '#EF4444' : '#F5F5F5',
              color: confirmText === 'DELETE' ? '#fff' : '#A3A3A3',
              border: `1.5px solid ${confirmText === 'DELETE' ? '#EF4444' : '#E5E5E5'}`,
              borderRadius: '8px',
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
