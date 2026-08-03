'use client'

import { useState } from 'react'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import { signOut } from '@/actions/auth'

export default function SignOutRow({ isLast }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleConfirm = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <>
      <div
        onClick={() => setShowConfirm(true)}
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
          Sign out
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>→</span>
      </div>

      <ConfirmSheet
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Sign out"
        message="You'll be signed out on this device."
        confirmLabel="Sign out"
        confirmStyle="danger"
        onConfirm={handleConfirm}
      />
    </>
  )
}
