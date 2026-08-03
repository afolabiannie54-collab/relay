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
      borderBottom: isLast ? 'none' : '1px solid var(--border-light)',
    }}>
      <Avatar src={user.avatar_url} name={user.display_name} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '14px',
          fontWeight: '700',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {user.display_name}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{user.username}</p>
      </div>
      <button
        onClick={handleUnblock}
        disabled={unblocking}
        className="relay-btn"
        style={{ flexShrink: 0 }}
      >
        {unblocking ? 'Unblocking...' : 'Unblock'}
      </button>
    </div>
  )
}
