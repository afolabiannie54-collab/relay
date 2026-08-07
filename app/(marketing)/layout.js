import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Logo from '@/components/marketing/Logo'

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
        // 3px to match the section rules further down the page — a 1px
        // hairline was the main thing making this read as a generic
        // template header rather than part of a drawn, heavy-bordered UI.
        borderBottom: '3px solid var(--border-strong)',
      }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
        }}>
          <Link href="/" aria-label="Relay home" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <Logo size={38} />
          </Link>

          <nav className="marketing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            <Link href="/privacy" className="marketing-navlink">Privacy</Link>
            <Link href="/terms" className="marketing-navlink">Terms</Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
            {signedIn ? (
              <Link href="/chat" className="relay-btn relay-btn--filled" style={{
                textDecoration: 'none',
                padding: '10px 20px',
                fontSize: '14px',
                boxShadow: 'var(--shadow-hard-accent)',
              }}>
                Open Relay
              </Link>
            ) : (
              <>
                <Link href="/login" className="marketing-navlink" style={{ marginRight: '4px' }}>
                  Log in
                </Link>
                <Link href="/signup" className="relay-btn relay-btn--filled" style={{
                  textDecoration: 'none',
                  padding: '10px 20px',
                  fontSize: '14px',
                  boxShadow: 'var(--shadow-hard-accent)',
                }}>
                  Get Relay
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <Footer signedIn={signedIn} />
    </div>
  )
}

function FooterColumn({ heading, links }) {
  return (
    <div>
      <p style={{
        fontSize: '12px',
        fontWeight: '800',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        marginBottom: '14px',
      }}>
        {heading}
      </p>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {links.map(l => (
          <li key={l.label}>
            <Link
              href={l.href}
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Footer({ signedIn }) {
  return (
    <footer style={{
      borderTop: '3px solid var(--border-strong)',
      background: 'var(--surface)',
    }}>
      <div style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: 'clamp(40px, 6vw, 64px) 24px clamp(24px, 3vw, 32px)',
        display: 'grid',
        // The brand column is given roughly twice the room of a link column
        // so the tagline sits on two comfortable lines instead of one long
        // one, and the whole thing collapses to a single column on phones.
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '36px',
      }}>
        <div style={{ gridColumn: 'span 1', minWidth: '200px' }}>
          <Logo size={40} />
          <p style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            marginTop: '14px',
            maxWidth: '30ch',
          }}>
            A messaging app built on usernames, not phone numbers.
          </p>
        </div>

        <FooterColumn
          heading="Product"
          links={[
            { label: 'Overview', href: '/' },
            { label: signedIn ? 'Open Relay' : 'Get Relay', href: signedIn ? '/chat' : '/signup' },
          ]}
        />

        <FooterColumn
          heading="Legal"
          links={[
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
          ]}
        />

        <FooterColumn
          heading="Account"
          links={signedIn
            ? [{ label: 'Your chats', href: '/chat' }, { label: 'Settings', href: '/settings' }]
            : [{ label: 'Log in', href: '/login' }, { label: 'Sign up', href: '/signup' }]}
        />
      </div>

      <div style={{
        borderTop: '2px solid var(--border-strong)',
      }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '18px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            © {new Date().getFullYear()} Relay
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Built as a student project.
          </p>
        </div>
      </div>
    </footer>
  )
}
