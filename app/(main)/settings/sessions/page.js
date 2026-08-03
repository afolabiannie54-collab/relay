import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getActiveSessions } from '@/actions/sessions'
import SessionRow from '@/components/settings/SessionRow'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export default async function SessionsPage() {
  const result = await getActiveSessions()
  const sessions = result.data || []

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
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Active sessions</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>
        {result.error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--error)',
          }}>
            {result.error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '40px 20px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-md)',
          }}>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>No active sessions found</p>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
          }}>
            {sessions.map((session, i) => (
              <SessionRow
                key={session.id}
                session={session}
                isLast={i === sessions.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
