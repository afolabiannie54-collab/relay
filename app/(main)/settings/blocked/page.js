import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getBlockedUsers } from '@/actions/blocks'
import BlockedUserRow from '@/components/settings/BlockedUserRow'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export default async function BlockedUsersPage() {
  const result = await getBlockedUsers()
  const users = result.data || []

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-subtle)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border-strong)',
        padding: '14px 24px',
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
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Blocked users</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>
        {users.length === 0 ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '40px 20px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>You haven&apos;t blocked anyone</p>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
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
