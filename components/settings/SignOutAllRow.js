'use client'

import { signOutAllSessions } from '@/actions/auth'

export default function SignOutAllRow({ isLast }) {
  const handleClick = async () => {
    await signOutAllSessions()
    window.location.href = '/login'
  }

  return (
    <div
      onClick={handleClick}
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
  )
}
