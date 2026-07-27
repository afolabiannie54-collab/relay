import Link from 'next/link'
import { getBlockedUsers } from '@/actions/blocks'
import BlockedUserRow from '@/components/settings/BlockedUserRow'

export default async function BlockedUsersPage() {
  const result = await getBlockedUsers()
  const users = result.data || []

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
              <BlockedUserRow key={u.id} user={u} isLast={i === users.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
