import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Logo, { LOGO_SIZES } from '@/components/marketing/Logo'
import Footer from '@/components/marketing/Footer'

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
          // Taller bar: the mark is a full hand-drawn illustration, not a
          // glyph, so at 38px it collapsed into unreadable scribble. It
          // needs size to be legible, and the bar needs room around it.
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
        }}>
          {/* Mark only, no wordmark — Notion's treatment. The logo carries
              the identity on its own and the bar stays uncluttered. */}
          <Link href="/" aria-label="Relay home" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <Logo size={LOGO_SIZES.nav} showWordmark={false} />
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
