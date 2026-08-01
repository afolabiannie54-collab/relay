'use client'

import { useState } from 'react'
import Avatar from '@/components/shared/Avatar'
import { unblockUser } from '@/actions/blocks'

export default function BlockedUserRow({ user, isLast }) {
  const [unblocking, setUnblocking] = useState(false)
  const [unblocked, setUnblocked] = useState(false)

  const handleUnblock = async () => {
    setUnblocking(true)
    const result = await unblockUser(user.id)
    if (!result.error) {
      setUnblocked(true)
      // unblockUser() just restored a hidden conversation, if there was
      // one — this is the same signal every block/unblock handler in the
      // app fires so ChatList picks it back up without a manual refresh.
      window.dispatchEvent(new Event('relay:conversations-changed'))
    }
    setUnblocking(false)
  }

  if (unblocked) return null

  return (
    <div style={{
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      borderBottom: isLast ? 'none' : '1px solid #F5F5F5',
    }}>
      <Avatar src={user.avatar_url} name={user.display_name} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#0a0a0a',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {user.display_name}
        </p>
        <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{user.username}</p>
      </div>
      <button
        onClick={handleUnblock}
        disabled={unblocking}
        style={{
          padding: '8px 16px',
          background: '#0a0a0a',
          color: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '600',
          cursor: unblocking ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: unblocking ? 'none' : '2px 2px 0 #FFB800',
          flexShrink: 0,
        }}
      >
        {unblocking ? 'Unblocking...' : 'Unblock'}
      </button>
    </div>
  )
}
