'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import { getBlockedUsers, unblockUser } from '@/actions/blocks'

export default function BlockedUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [unblockingId, setUnblockingId] = useState(null)

  useEffect(() => {
    async function load() {
      const result = await getBlockedUsers()
      if (result.data) setUsers(result.data)
      setLoading(false)
    }
    load()
  }, [])

  const handleUnblock = async (userId) => {
    setUnblockingId(userId)
    const result = await unblockUser(userId)
    if (!result.error) {
      setUsers(prev => prev.filter(u => u.id !== userId))
    }
    setUnblockingId(null)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F5F5F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <p style={{ color: '#A3A3A3', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
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
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Blocked users</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>
        {users.length === 0 ? (
          <div style={{
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '16px',
            padding: '40px 20px',
            textAlign: 'center',
            boxShadow: '4px 4px 0 #0a0a0a',
          }}>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>You haven&apos;t blocked anyone</p>
          </div>
        ) : (
          <div style={{
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '4px 4px 0 #0a0a0a',
          }}>
            {users.map((u, i) => (
              <div key={u.id} style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: i < users.length - 1 ? '1px solid #F5F5F5' : 'none',
              }}>
                <Avatar src={u.avatar_url} name={u.display_name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#0a0a0a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {u.display_name}
                  </p>
                  <p style={{ fontSize: '12px', color: '#A3A3A3' }}>@{u.username}</p>
                </div>
                <button
                  onClick={() => handleUnblock(u.id)}
                  disabled={unblockingId === u.id}
                  style={{
                    padding: '8px 16px',
                    background: '#0a0a0a',
                    color: '#fff',
                    border: '1.5px solid #0a0a0a',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: unblockingId === u.id ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: unblockingId === u.id ? 'none' : '2px 2px 0 #FFB800',
                    flexShrink: 0,
                  }}
                >
                  {unblockingId === u.id ? 'Unblocking...' : 'Unblock'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
