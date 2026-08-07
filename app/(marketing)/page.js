import Link from 'next/link'
import { AtSign, ShieldCheck, Mic, Users, Check, CheckCheck, Inbox, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import InstallRelay from '@/components/marketing/InstallRelay'
import ChatPreview from '@/components/marketing/ChatPreview'

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

function FeatureCard({ eyebrow, title, body, children }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '3px solid var(--border-strong)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-hard-md)',
      padding: '28px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 style={{
          fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
          fontWeight: '900',
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
      <section style={{ ...SECTION, paddingTop: 'clamp(48px, 9vw, 96px)', paddingBottom: 'clamp(40px, 7vw, 80px)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'clamp(32px, 5vw, 64px)',
          alignItems: 'center',
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--accent-light)',
              border: '2px solid var(--border-strong)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 14px',
              marginBottom: '24px',
            }}>
              <AtSign size={14} strokeWidth={2.5} color="var(--accent-text)" />
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text)' }}>
                No phone number required
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.75rem, 7.5vw, 5rem)',
              fontWeight: '900',
              letterSpacing: '-0.045em',
              lineHeight: 0.98,
              color: 'var(--text)',
              marginBottom: '20px',
            }}>
              Your people are{' '}
              <span style={{
                background: 'var(--accent)',
                padding: '0 0.12em',
                borderRadius: '6px',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
                color: 'var(--on-accent)',
              }}>
                one search
              </span>{' '}
              away.
            </h1>

            <p style={{
              fontSize: 'clamp(1rem, 1.6vw, 1.2rem)',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              maxWidth: '480px',
              marginBottom: '28px',
            }}>
              Relay is a messaging app built on usernames. Share a handle, not your
              number — and decide for yourself who gets to reach you.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {signedIn ? (
                <Link href="/chat" className="relay-btn relay-btn--filled" style={{
                  textDecoration: 'none',
                  padding: '16px 30px',
                  fontSize: '16px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-hard-accent)',
                }}>
                  Open Relay
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="relay-btn relay-btn--filled" style={{
                    textDecoration: 'none',
                    padding: '16px 30px',
                    fontSize: '16px',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-hard-accent)',
                  }}>
                    Get Relay free
                  </Link>
                  <Link href="/login" className="relay-btn" style={{
                    textDecoration: 'none',
                    padding: '16px 26px',
                    fontSize: '16px',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ChatPreview />
          </div>
        </div>
      </section>

      {/* ---------------- Feature grid ---------------- */}
      <section style={{
        background: 'var(--bg-subtle)',
        borderTop: '3px solid var(--border-strong)',
        borderBottom: '3px solid var(--border-strong)',
        padding: 'clamp(56px, 8vw, 96px) 0',
      }}>
        <div style={SECTION}>
          <h2 style={{
            fontSize: 'clamp(2.25rem, 5.5vw, 3.75rem)',
            fontWeight: '900',
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
            color: 'var(--text)',
            marginBottom: 'clamp(32px, 5vw, 56px)',
            maxWidth: '15ch',
          }}>
            Built around who reaches you.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
          }}>
            <FeatureCard
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

            <FeatureCard
              eyebrow="Read receipts"
              title="Ticks that tell the truth."
              body="Sent, delivered, read — and if you turn your read receipts off, you stop seeing everyone else's too. It works both ways or not at all."
            >
              <TicksDemo />
            </FeatureCard>

            <FeatureCard
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
      <section style={{ ...SECTION, padding: 'clamp(56px, 8vw, 96px) 24px' }}>
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
              fontWeight: '900',
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
        borderTop: '3px solid var(--border-strong)',
        background: 'var(--accent)',
        padding: 'clamp(56px, 8vw, 96px) 24px',
      }}>
        <div style={{ ...SECTION, textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(2.25rem, 6vw, 4rem)',
            fontWeight: '900',
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
