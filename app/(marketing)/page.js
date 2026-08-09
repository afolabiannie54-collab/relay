import Link from 'next/link'
import { AtSign, ShieldCheck, Mic, Users, Check, CheckCheck, Inbox, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import InstallRelay from '@/components/marketing/InstallRelay'
import Logo from '@/components/marketing/Logo'
import Signpost from '@/components/marketing/Signpost'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'
import { BELL, USERS, INBOX } from '@/lib/doodles'
// ChatPreview moves to a later section (not the hero) — see LandingPage.

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export const metadata = {
  title: 'Relay — Your people are one search away',
  description:
    'A messaging app built on usernames, not phone numbers. Find people by @handle, decide who reaches you, and read voice notes you can\'t listen to.',
}

const SECTION = { maxWidth: '1120px', margin: '0 auto', padding: '0 24px' }

// Notion's pattern: a quiet eyebrow, then a headline doing the actual
// talking, then the product itself rather than a description of it.
function Eyebrow({ children }) {
  return (
    <p style={{
      fontSize: '13px',
      fontWeight: '800',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--accent-text)',
      marginBottom: '12px',
    }}>
      {children}
    </p>
  )
}

// Same card style as before (bordered, hard-shadowed, our own tokens) —
// the only thing borrowed from the Gumroad reference is the layout: wide
// cards next to narrow ones instead of a uniform grid. See
// .marketing-feature-grid / --wide in globals.css for the span mechanics.
function FeatureCard({ eyebrow, title, body, wide = false, children }) {
  return (
    <div
      className={`marketing-feature-card${wide ? ' marketing-feature-card--wide' : ''}`}
      style={{
        background: 'var(--surface)',
        border: '3px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-hard-md)',
        padding: '34px 30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 style={{
          fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
          fontWeight: '800',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: 'var(--text)',
          marginBottom: '10px',
        }}>
          {title}
        </h3>
        <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{body}</p>
      </div>
      <div style={{ marginTop: 'auto' }}>{children}</div>
    </div>
  )
}

// Small in-page product fragments. Same reasoning as ChatPreview: built
// from the real tokens so they can't go stale and work in both themes.
function HandleDemo() {
  return (
    <div style={{
      background: 'var(--bg-subtle)',
      border: '2px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '14px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--surface)',
        border: '2px solid var(--border-strong)',
        borderRadius: 'var(--radius-pill)',
        padding: '9px 14px',
        marginBottom: '12px',
      }}>
        <AtSign size={15} {...iconProps} color="var(--text-tertiary)" />
        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>maya</span>
        <span style={{ width: '2px', height: '15px', background: 'var(--accent)', marginLeft: '1px' }} />
      </div>
      {[
        { n: 'Maya Okonkwo', h: 'maya', c: 'var(--accent)' },
        { n: 'Maya R.', h: 'mayar', c: '#C084FC' },
      ].map(u => (
        <div key={u.h} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: u.c,
            border: '2px solid var(--border-strong)',
            flexShrink: 0,
          }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{u.n}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>@{u.h}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function RequestDemo() {
  return (
    <div style={{
      background: 'var(--bg-subtle)',
      border: '2px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'var(--accent)',
          border: '2px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Inbox size={17} {...iconProps} color="var(--on-accent)" />
        </div>
        <div>
          <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text)' }}>Message request</p>
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>from @someone_new</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <span className="relay-btn relay-btn--filled" style={{ flex: 1, justifyContent: 'center', fontSize: '12px', pointerEvents: 'none' }}>Accept</span>
        <span className="relay-btn" style={{ flex: 1, justifyContent: 'center', fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)', pointerEvents: 'none' }}>Block</span>
      </div>
    </div>
  )
}

// Hero CTA — the same "message request" UI as RequestDemo below, but a
// real, functional instance of it rather than a pointer-events:none
// mockup: the avatar is the Relay mark instead of a stranger's icon (the
// request is "from Relay" itself), and Accept/Log in actually route
// signup/login rather than illustrating what accepting a request looks
// like. Reusing the product's own UI as the hero's CTA does double duty
// as both the conversion action and a piece of product illustration,
// instead of a plain button pair or a second preview competing with
// ChatPreview's spot later on the page.
function HeroRequestCTA() {
  return (
    <div style={{
      maxWidth: '460px',
      margin: '0 auto',
      textAlign: 'left',
      background: 'var(--surface)',
      border: '3px solid var(--border-strong)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-hard-lg)',
      // Every size below is clamp()-based rather than fixed — at 460px
      // fixed this card was a large, heavy block on a phone screen where
      // the rest of the hero has already scaled way down.
      padding: 'clamp(18px, 5vw, 28px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 3vw, 14px)', marginBottom: 'clamp(14px, 4vw, 22px)' }}>
        <div style={{
          width: 'clamp(40px, 10vw, 54px)',
          height: 'clamp(40px, 10vw, 54px)',
          borderRadius: '50%',
          background: 'var(--accent-light)',
          border: '2.5px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Logo size="clamp(22px, 6vw, 30px)" showWordmark={false} />
        </div>
        <div>
          <p style={{ fontSize: 'clamp(15px, 4vw, 18px)', fontWeight: '800', color: 'var(--text)' }}>Message request</p>
          <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', color: 'var(--text-tertiary)' }}>from @relay</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 12px)' }}>
        <Link href="/signup" className="relay-btn relay-btn--filled" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', padding: 'clamp(10px, 3vw, 13px) clamp(14px, 4vw, 20px)', fontSize: 'clamp(13px, 3.5vw, 15px)' }}>
          Accept
        </Link>
        <Link href="/login" className="relay-btn" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', padding: 'clamp(10px, 3vw, 13px) clamp(14px, 4vw, 20px)', fontSize: 'clamp(13px, 3.5vw, 15px)' }}>
          Log in
        </Link>
      </div>
    </div>
  )
}

function TicksDemo() {
  const rows = [
    { label: 'Sent', icon: <Check size={14} {...iconProps} color="var(--text-tertiary)" /> },
    { label: 'Delivered', icon: <CheckCheck size={14} {...iconProps} color="var(--text-tertiary)" /> },
    { label: 'Read', icon: <CheckCheck size={14} {...iconProps} color="var(--accent)" /> },
  ]
  return (
    <div style={{
      background: 'var(--bg-subtle)',
      border: '2px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 14px',
    }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 0',
          borderBottom: i < rows.length - 1 ? '1px solid var(--border-light)' : 'none',
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{r.label}</span>
          {r.icon}
        </div>
      ))}
    </div>
  )
}

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const signedIn = !!user

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      {/* Centered, Notion/Gumroad-style — a single stacked column instead
          of text-left/preview-right. The product preview moves to a later
          section instead of sharing the hero. */}
      {/* Min bound of these clamps is what governs mobile, not the vw
          term — 11vw/10vw are both well under 64px at phone widths, so
          the clamp bottoms out at its floor. That floor being 64px (a
          fairly small number to begin with) is why the hero felt short
          on mobile no matter what the overlap below it was doing. */}
      <section style={{
        ...SECTION,
        position: 'relative',
        paddingTop: 'clamp(96px, 11vw, 140px)',
        paddingBottom: 'clamp(88px, 10vw, 128px)',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          {/* Just the signpost now, not the whole mascot — planted so it
              looks like it's sticking straight up out of the Y rather than
              flying in beside it. The pole's base overlaps the letter's
              top; the arrows float above it. */}
          <div
            className="hero-mascot"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 'clamp(-4px, 0.2vw, 8px)',
              top: 'clamp(-78px, -6vw, -46px)',
              transform: 'rotate(-4deg)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <Signpost size="clamp(74px, 8.5vw, 116px)" />
          </div>

          {/* A few tiny scattered doodles to balance the signpost's weight
              on the left — bare line icons, no tile/border, muted color,
              so they read as light background texture (Gumroad's scattered
              marks, Notion's small floating accents) rather than another
              thing competing for attention. */}
          <div className="hero-mascot" aria-hidden="true" style={{
            position: 'absolute', right: 'clamp(-16px, 1vw, 24px)', top: 'clamp(-22px, -1.5vw, 4px)',
            transform: 'rotate(13deg)', pointerEvents: 'none', zIndex: 0,
          }}>
            <NotionDoodle d={BELL} size={30} color="var(--text-tertiary)" />
          </div>
          <div className="hero-mascot" aria-hidden="true" style={{
            position: 'absolute', right: 'clamp(-48px, -3vw, -16px)', top: '52%',
            transform: 'rotate(-11deg)', pointerEvents: 'none', zIndex: 0,
          }}>
            <NotionDoodle d={USERS} size={26} color="var(--text-tertiary)" />
          </div>
          <div className="hero-mascot" aria-hidden="true" style={{
            position: 'absolute', left: 'clamp(-36px, -2.5vw, -6px)', bottom: 'clamp(48px, 6vw, 88px)',
            transform: 'rotate(9deg)', pointerEvents: 'none', zIndex: 0,
          }}>
            <NotionDoodle d={INBOX} size={24} color="var(--text-tertiary)" />
          </div>

          {/* The phrase was previously given a filled yellow background.
              Across a wrap that renders as two offset slabs with ragged
              edges — unavoidable, since a background box follows line
              boxes. A drawn underline sits under the text instead of
              behind it, so wrapping can't fragment it, and a wobbly
              stroke belongs with the hand-drawn logo far more than a
              rectangle does. nowrap keeps the phrase intact. */}
          <h1 style={{
            fontSize: 'clamp(2.75rem, 7vw, 5.75rem)',
            fontWeight: '800',
            letterSpacing: '-0.045em',
            lineHeight: 1.0,
            color: 'var(--text)',
            marginBottom: '28px',
          }}>
            Your people are{' '}
            <span style={{ position: 'relative', whiteSpace: 'nowrap' }}>
              one search
              <svg
                aria-hidden="true"
                viewBox="0 0 300 16"
                preserveAspectRatio="none"
                style={{
                  position: 'absolute',
                  left: '-1%',
                  bottom: '-0.16em',
                  width: '102%',
                  height: '0.22em',
                  overflow: 'visible',
                }}
              >
                <path
                  d="M2 10.5C48 4.5 108 3.2 160 6.4C212 9.6 262 9.2 298 5"
                  stroke="var(--accent)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>{' '}
            away.
          </h1>

          {/* nowrap only kicks in above 640px (see .hero-subtitle) — forcing
              it always would push this phrase past a phone's viewport
              width and cause horizontal scroll, since there's no room left
              to shrink the font enough to fit it on one line that small. */}
          <p className="hero-subtitle" style={{
            fontSize: 'clamp(1rem, 1.4vw, 1.15rem)',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            margin: '0 auto 36px',
          }}>
            Find people by handle, and decide who reaches you.
          </p>

          {/* Signed-in visitors already have "Open Relay" sitting right in
              the sticky nav above — repeating it here would just be the
              same button twice on screen at once, so the hero has no CTA
              of its own for that case.
              Signed-out gets the app's own message-request UI instead of
              plain buttons — it's a real, recognizable piece of the
              product (see the matching mockup in the feature grid below)
              doing double duty as the hero's CTA, not a second, unrelated
              preview competing with ChatPreview's spot later on the page. */}
          {!signedIn && <HeroRequestCTA />}
        </div>
      </section>

      {/* ---------------- Feature grid ---------------- */}
      {/* Our own surfaces/borders/shadows throughout — the Gumroad
          reference is borrowed for one thing only: wide cards mixed with
          narrow ones (.marketing-feature-grid) instead of a uniform grid.
          A 3-column base with 2-of-3 vs 1-of-3 spans, and the wide column
          swapping sides each row (left, right, left) rather than every
          "wide" card being alone on its own row — that alternating-side
          pattern is what actually reads as loosely arranged instead of a
          repeating checkerboard.
          White background, no section headline, and pulled up over the
          hero's bottom padding (negative margin) so the two sections
          overlap slightly instead of sitting as two stacked blocks with a
          gap between — same as how Notion/Gumroad let a section bleed up
          under the one before it. */}
      {/* Overlap amount is a CSS class + media query, not a clamp() —
          clamp(-180px, -13vw, -10px) looked like it would pin to -10px on
          phones, but the max end of a clamp only takes over once the
          preferred value crosses past it, and -13vw doesn't cross -10px
          until the viewport is ~77px wide. Below 640px it was still
          resolving to roughly -13vw directly (~-55px on a typical phone),
          nowhere near "barely." A real breakpoint says exactly what
          happens on each side instead of relying on clamp's math. */}
      <section className="marketing-feature-overlap" style={{
        position: 'relative',
        background: 'var(--background)',
        padding: 'clamp(72px, 10vw, 136px) 0',
      }}>
        <div style={SECTION}>
          <div className="marketing-feature-grid">
            <FeatureCard
              wide
              eyebrow="Find people"
              title="A handle, not a number."
              body="Search @usernames to start a conversation. Nothing to hand over, no contact list to upload, and no way for someone to find you just because they have your number."
            >
              <HandleDemo />
            </FeatureCard>

            <FeatureCard
              eyebrow="Stay in control"
              title="Strangers ask first."
              body="A first message from someone new arrives as a request, not a conversation. Accept it, ignore it, or block — before they can send anything else."
            >
              <RequestDemo />
            </FeatureCard>

            <FeatureCard
              eyebrow="Voice notes"
              title="Read what you can't play."
              body="Every voice note is transcribed automatically, so a message you can't listen to right now is still a message you can read. Switch it off any time."
            >
              <div style={{
                background: 'var(--bg-subtle)',
                border: '2px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: 'var(--accent-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginBottom: '8px',
                }}>
                  <Mic size={12} {...iconProps} /> TRANSCRIPT
                </p>
                <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--text)' }}>
                  &ldquo;Running about ten minutes late — start without me and I&apos;ll catch up.&rdquo;
                </p>
              </div>
            </FeatureCard>

            {/* Wide column swaps to the right side here (row 2) — the same
                span pattern as row 1 but mirrored, so the grid doesn't
                read as a mechanical repeat of "big card always on the
                left." */}
            <FeatureCard
              wide
              eyebrow="Groups"
              title="Rooms with real roles."
              body="Owners and admins, invites for people you haven't met, pinned messages everyone sees, and starred ones only you do."
            >
              <div style={{
                background: 'var(--bg-subtle)',
                border: '2px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                {[
                  { icon: Users, label: 'Study Group', sub: '6 members' },
                  { icon: Star, label: 'Starred messages', sub: 'Only visible to you' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--surface)',
                      border: '2px solid var(--border-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <r.icon size={15} {...iconProps} color="var(--text)" />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{r.label}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{r.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FeatureCard>

            <FeatureCard
              wide
              eyebrow="Read receipts"
              title="Ticks that tell the truth."
              body="Sent, delivered, read — and if you turn your read receipts off, you stop seeing everyone else's too. It works both ways or not at all."
            >
              <TicksDemo />
            </FeatureCard>

            <FeatureCard
              eyebrow="Your settings"
              title="Quiet by default, loud on request."
              body="Hide a conversation and its notifications stop naming names. Mute a group. Choose who can find you in search at all."
            >
              <div style={{
                background: 'var(--bg-subtle)',
                border: '2px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
              }}>
                {['Discoverable in search', 'Show last seen', 'Read receipts'].map((label, i) => (
                  <div key={label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: i < 2 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{label}</span>
                    <span style={{
                      width: '38px',
                      height: '21px',
                      borderRadius: 'var(--radius-pill)',
                      background: i === 1 ? 'var(--border)' : 'var(--border-strong)',
                      border: '1.5px solid var(--border-strong)',
                      position: 'relative',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        position: 'absolute',
                        top: '2px',
                        left: i === 1 ? '2px' : '18px',
                        width: '13px',
                        height: '13px',
                        borderRadius: '50%',
                        background: i === 1 ? 'var(--surface)' : 'var(--accent)',
                        border: '1px solid var(--border-strong)',
                      }} />
                    </span>
                  </div>
                ))}
              </div>
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* ---------------- Install ---------------- */}
      <section style={{ ...SECTION, padding: 'clamp(72px, 10vw, 136px) 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'clamp(28px, 5vw, 56px)',
          alignItems: 'center',
        }}>
          <div>
            <Eyebrow>Install</Eyebrow>
            <h2 style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
              fontWeight: '800',
              letterSpacing: '-0.04em',
              lineHeight: 1.05,
              color: 'var(--text)',
              marginBottom: '16px',
            }}>
              Put it on your home screen.
            </h2>
            <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: '440px' }}>
              Relay installs like a normal app — its own icon, its own window, and
              push notifications when someone messages you. No app store, nothing
              to download.
            </p>
          </div>
          <InstallRelay />
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section style={{
        background: 'var(--accent)',
        padding: 'clamp(72px, 10vw, 136px) 24px',
      }}>
        <div style={{ ...SECTION, textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(2.25rem, 6vw, 4rem)',
            fontWeight: '800',
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
            color: 'var(--on-accent)',
            marginBottom: '20px',
          }}>
            Start with a username.
          </h2>
          <p style={{
            fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
            color: 'var(--on-accent)',
            opacity: 0.85,
            maxWidth: '46ch',
            margin: '0 auto 32px',
            lineHeight: 1.6,
          }}>
            Free, takes a minute, and nobody needs your phone number to say hello.
          </p>
          <Link
            href={signedIn ? '/chat' : '/signup'}
            className="relay-btn"
            style={{
              textDecoration: 'none',
              padding: '17px 34px',
              fontSize: '17px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-hard-md)',
            }}
          >
            {signedIn ? 'Open Relay' : 'Get Relay free'}
          </Link>
        </div>
      </section>
    </>
  )
}
