import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Footer from '@/components/marketing/Footer'
import NavLinks from '@/components/marketing/NavLinks'
import MobileNav from '@/components/marketing/MobileNav'

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
      {/* No background fill or bottom rule — those made sense when the bar
          was a full-width strip of plain content that needed a line to
          separate it from the page. Now the nav is a self-contained
          bordered pill floating in the corner; a full-width band under it
          would just be a disconnected leftover shape with nothing to
          explain it. */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
        }}>
          {/* No logo here — text-only nav. "Home" covers what the mark
              used to link to; it wasn't reading well at nav scale, a
              delicate line drawing next to plain text just looked like
              clutter, not identity.
              Links, divider, and CTA all live inside one bordered pill
              (marginLeft: auto keeps it pinned right) rather than two
              separate clusters — with only 3 links + 2 buttons, splitting
              them left/right just stretched sparse content across the
              full bar with dead space in the middle. */}
          <div className="marketing-navbar-pill" style={{ marginLeft: 'auto' }}>
            <NavLinks />
            <span className="marketing-navbar-divider" aria-hidden="true" />
            {/* Below 720px, NavLinks/divider disappear and this takes
                over — Home/Privacy/Terms (and Log in) move into its
                dropdown instead of vanishing outright. */}
            <MobileNav signedIn={signedIn} />
            {signedIn ? (
              <Link href="/chat" className="marketing-navbar-cta">Open Relay</Link>
            ) : (
              <>
                {/* marketing-desktop-only: MobileNav's dropdown already
                    carries "Log in" below 720px, so this copy hides there
                    instead of doubling up next to the hamburger. */}
                <Link href="/login" className="marketing-navtab marketing-desktop-only">Log in</Link>
                <Link href="/signup" className="marketing-navbar-cta">Get Relay</Link>
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
