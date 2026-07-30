'use client'

import { useState } from 'react'
import ConfirmSheet from '@/components/shared/ConfirmSheet'
import { signOutAllSessions } from '@/actions/auth'

export default function SignOutAllRow({ isLast }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleConfirm = async () => {
    await signOutAllSessions()
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
          borderBottom: isLast ? 'none' : '1px solid #F5F5F5',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#0a0a0a' }}>
          Sign out all devices
        </span>
        <span style={{ color: '#A3A3A3', fontSize: '14px' }}>→</span>
      </div>

      <ConfirmSheet
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Sign out all devices"
        message="You'll be signed out on all devices including this one."
        confirmLabel="Sign out all"
        confirmStyle="danger"
        onConfirm={handleConfirm}
      />
    </>
  )
}
