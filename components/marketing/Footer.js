import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Logo, { LOGO_SIZES } from '@/components/marketing/Logo'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'
import { USERS, BOOKMARK, BELL, INBOX, LAPTOP, COMMENT_SLASH } from '@/lib/doodles'

// ─────────────────────────────────────────────────────────────
//  DOODLE TILE SIZE — change this to resize the footer tiles.
//  clamp(MIN, PREFERRED, MAX): smallest on phones, largest on
//  desktop. The drawing inside is a percentage of the tile, so
//  it scales with it automatically.
// ─────────────────────────────────────────────────────────────
const TILE_SIZE = 'clamp(52px, 11vw, 68px)'
const TILE_ART = '56%'

// The tiles are deliberately not a uniform row: each carries its own
// rotation and vertical offset so the strip reads as hand-placed rather
// than stamped out on a grid — the same reason the logo is a drawing and
// not a glyph. Rotation is passed through a CSS variable so the hover
// lift in globals.css can preserve it instead of snapping the tile
// straight.
const TILES = [
  { d: USERS, label: 'Find people by username', rot: -6, dy: 6 },
  { d: INBOX, label: 'Message requests', rot: 4, dy: -10 },
  { d: BELL, label: 'Notifications you control', rot: -3, dy: 14 },
  { d: BOOKMARK, label: 'Starred messages', rot: 7, dy: -4 },
  { d: COMMENT_SLASH, label: 'Hidden chats', rot: -5, dy: 10 },
  { d: LAPTOP, label: 'Works on every device', rot: 3, dy: -8 },
]

function DoodleTile({ d, label, rot, dy }) {
  return (
    <div
      className="marketing-doodle-tile"
      title={label}
      style={{
        '--tile-rot': `${rot}deg`,
        transform: `rotate(${rot}deg) translateY(${dy}px)`,
        width: TILE_SIZE,
        height: TILE_SIZE,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--footer-tile-bg)',
        border: '2.5px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-hard-sm)',
      }}
    >
      {/* Percentage rather than a pixel value, so the drawing tracks the
          tile as TILE_SIZE clamps down on smaller screens instead of
          staying fixed and crowding the edges. */}
      <NotionDoodle d={d} size={TILE_ART} color="var(--text)" />
    </div>
  )
}

function Column({ heading, links }) {
  return (
    <div>
      <p style={{
        fontSize: '12px',
        fontWeight: '800',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
        marginBottom: '18px',
      }}>
        {heading}
      </p>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {links.map(l => (
          <li key={l.label}>
            <Link href={l.href} className="marketing-arrowlink">
              <ArrowRight size={15} strokeWidth={2.5} />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Footer({ signedIn }) {
  return (
    <footer style={{
      borderTop: '3px solid var(--border-strong)',
      background: 'var(--footer-bg)',
    }}>
      <div style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: 'clamp(56px, 8vw, 96px) 28px clamp(32px, 4vw, 48px)',
      }}>
        {/* Statement + links. The headline is the point of the footer, so
            it gets roughly twice the width of the link area and the links
            sit alongside it rather than under it. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'clamp(36px, 6vw, 72px)',
          alignItems: 'start',
        }}>
          <div style={{ gridColumn: 'span 1' }}>
            <h2 style={{
              fontSize: 'clamp(2rem, 4.4vw, 3.25rem)',
              fontWeight: '800',
              letterSpacing: '-0.04em',
              lineHeight: 1.02,
              color: 'var(--text)',
              maxWidth: '13ch',
            }}>
              Your people are one search away.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '32px',
            gridColumn: 'span 1',
          }}>
            <Column
              heading="Product"
              links={[
                { label: 'Overview', href: '/' },
                { label: signedIn ? 'Open Relay' : 'Get Relay', href: signedIn ? '/chat' : '/signup' },
                ...(signedIn
                  ? [{ label: 'Settings', href: '/settings' }]
                  : [{ label: 'Log in', href: '/login' }]),
              ]}
            />
            <Column
              heading="Legal"
              links={[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
              ]}
            />
          </div>
        </div>

        {/* Tiles left, logo right. The logo sat above the headline before,
            which left the whole bottom-right corner empty while stacking
            two heavy elements in one column. Out here it fills that gap and
            balances the tile strip, and the figure reads as flying up out
            of the footer. */}
        <div className="marketing-footer-strip" style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'clamp(24px, 4vw, 56px)',
          flexWrap: 'wrap',
        }}>
          {/* Wrapping (not scrolling) is handled in globals.css — see
              .marketing-footer-tiles for why. Padding keeps the hover lift
              from being clipped by the tiles' own bounds. */}
          <div className="marketing-footer-tiles" style={{
            display: 'flex',
            gap: 'clamp(14px, 2.5vw, 26px)',
            alignItems: 'center',
            paddingTop: '18px',
            paddingBottom: '18px',
            flex: '1 1 auto',
            minWidth: 0,
          }}>
            {TILES.map(t => <DoodleTile key={t.label} {...t} />)}
          </div>

          {/* Flipped so he flies back into the page rather than off the
              right edge. Hidden below the stacking breakpoint — see
              .marketing-footer-logo. */}
          <div className="marketing-footer-logo" style={{ flexShrink: 0 }}>
            <Logo size={LOGO_SIZES.footer} showWordmark={false} flip />
          </div>
        </div>
      </div>

      <div style={{ borderTop: '2px solid var(--border-strong)' }}>
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          padding: '20px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            © {new Date().getFullYear()} Relay
          </p>
          <div style={{ display: 'flex', gap: '22px' }}>
            <Link href="/privacy" className="marketing-navlink" style={{ fontSize: '13px' }}>Privacy</Link>
            <Link href="/terms" className="marketing-navlink" style={{ fontSize: '13px' }}>Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
