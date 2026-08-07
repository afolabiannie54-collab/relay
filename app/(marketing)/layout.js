import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Marketing shell. Deliberately NOT the app shell: (main)/layout.js mounts
// the bottom nav, the presence heartbeat, realtime subscriptions and the
// profile-sheet context. None of that belongs on a public page a stranger
// loads once — it would open sockets and start polling for someone who
// hasn't even signed up. This layout is static chrome and nothing else.
export default async function MarketingLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const signedIn = !!user

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--background)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border-strong)',
      }}>
        <div style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            {/* The icon ships as flat RGB with a white ground, so it's
                framed as an app-icon chip rather than floated loose — in
                dark mode a bare white square would read as a broken image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-96.png"
              alt=""
              width={32}
              height={32}
              style={{
                borderRadius: '8px',
                border: '2px solid var(--border-strong)',
                display: 'block',
              }}
            />
            <span style={{ fontSize: '19px', fontWeight: '900', letterSpacing: '-0.03em', color: 'var(--text)' }}>
              Relay
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {signedIn ? (
              <Link href="/chat" className="relay-btn relay-btn--filled" style={{ textDecoration: 'none', padding: '9px 18px', fontSize: '14px' }}>
                Open Relay
              </Link>
            ) : (
              <>
                <Link href="/login" className="relay-btn" style={{ textDecoration: 'none', padding: '9px 16px', fontSize: '14px' }}>
                  Log in
                </Link>
                <Link href="/signup" className="relay-btn relay-btn--filled" style={{ textDecoration: 'none', padding: '9px 18px', fontSize: '14px' }}>
                  Get Relay
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{
        borderTop: '2px solid var(--border-strong)',
        background: 'var(--surface)',
        padding: '32px 24px',
      }}>
        <div style={{
          maxWidth: '1120px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            © {new Date().getFullYear()} Relay
          </p>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link href="/privacy" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
