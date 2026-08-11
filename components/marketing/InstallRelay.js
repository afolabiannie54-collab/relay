'use client'

import { useState, useEffect } from 'react'
import {
  BookOpen, Star, StickyNote, Search, SquarePlus,
  Share, ChevronLeft, ChevronRight, Copy,
  Download, Check, X,
} from 'lucide-react'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Chrome/Edge (desktop and Android alike) fire beforeinstallprompt, which
// can be captured and replayed from a button of our own — a real one-tap
// native install, same event on both, so both tabs just show the button.
//
// iOS has no equivalent and never has: Safari exposes no API to trigger
// "Add to Home Screen". So that tab shows the share sheet itself, drawn
// at full size — the whole reason nobody installs PWAs on iPhone is that
// they've never seen where the option lives, and a description of a menu
// doesn't fix that. A picture of the menu does.
export default function InstallRelay() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [platform, setPlatform] = useState('ios')

  // Detected in an effect, not a lazy useState initializer: this renders
  // on the server first (no `window`), so the first client render has to
  // match that server output or React throws a hydration mismatch.
  useEffect(() => {
    const ua = window.navigator.userAgent
    // iPadOS 13+ reports itself as a Mac, so the touch-point check is what
    // actually catches modern iPads.
    const iOSLike = /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes('Mac') && typeof document !== 'undefined' && navigator.maxTouchPoints > 1)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(iOSLike ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop')

    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setInstalled(standalone)

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null) }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    // The event is single-use — Chrome won't replay the same one, so it's
    // dropped either way and re-fired by the browser if still eligible.
    setDeferredPrompt(null)
    if (outcome === 'accepted') setInstalled(true)
  }

  if (installed) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '18px 26px',
        background: 'var(--accent-light)',
        border: '3px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-hard-md)',
      }}>
        <Check size={20} strokeWidth={3} color="var(--accent-text)" />
        <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>
          Relay is installed on this device
        </span>
      </div>
    )
  }

  return (
    <div>
      {/* Same bordered pill + filled-active tab as the header nav — this
          is a subnav, so it should read as the same kind of control
          rather than inventing a second tab style for one section. */}
      <div className="marketing-navbar-pill marketing-install-tabs" style={{ marginBottom: '28px', width: 'fit-content' }}>
        {[
          { id: 'ios', label: 'iPhone' },
          { id: 'android', label: 'Android' },
          { id: 'desktop', label: 'Desktop' },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPlatform(t.id)}
            className={`marketing-navtab${platform === t.id ? ' marketing-navtab--active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* One fixed height across all three tabs — iPhone needs two
          mockups' worth of room while Android/desktop is a single button,
          so without it the whole page jumps every time you switch. */}
      <div className="marketing-install-panel">
        {platform === 'ios' && <IOSSteps />}
        {platform === 'android' && (
          <OneTapInstall deferredPrompt={deferredPrompt} onInstall={handleInstall}>
            <HomeScreenMock />
          </OneTapInstall>
        )}
        {platform === 'desktop' && (
          <OneTapInstall deferredPrompt={deferredPrompt} onInstall={handleInstall}>
            <AppWindowMock />
          </OneTapInstall>
        )}
      </div>
    </div>
  )
}

// Android + desktop have no steps worth showing — it's one click — so
// instead of a button stranded in empty space, these show the payoff:
// what you actually end up with. iOS answers "what do I do", these
// answer "what do I get", and both do it with a real picture rather
// than a sentence.
function OneTapInstall({ deferredPrompt, onInstall, children }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      alignItems: 'flex-start',
      justifyContent: 'center',
      flex: 1,
    }}>
      {children}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
        {/* Same scale as the site's other primary buttons — oversized, it
            read as a second heavy slab competing with the mockup above
            rather than an action beneath it. */}
        <button
          onClick={onInstall}
          disabled={!deferredPrompt}
          className="relay-btn relay-btn--filled"
          style={{
            padding: '15px 26px',
            fontSize: '16px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-hard-accent)',
          }}
        >
          <Download size={18} {...iconProps} />
          Install Relay
        </button>
        {!deferredPrompt && (
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', maxWidth: '320px', lineHeight: 1.5 }}>
            Your browser enables this after a moment on the site.
          </p>
        )}
      </div>
    </div>
  )
}

// Desktop's payoff is the window: no tabs, no address bar, no other
// sites — so the mockup is deliberately chrome-less apart from a title
// bar, since that absence is the entire point.
function AppWindowMock() {
  return (
    <div style={{ width: '100%', maxWidth: '430px' }}>
      <div style={{
        background: 'var(--surface)',
        border: '3px solid var(--border-strong)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-hard-md)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '11px 14px',
          borderBottom: '2px solid var(--border-strong)',
          background: 'var(--bg-subtle)',
        }}>
          <span style={{ display: 'flex', gap: '6px' }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map(c => (
              <span key={c} style={{ width: '11px', height: '11px', borderRadius: '50%', background: c }} />
            ))}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" style={{ width: '17px', height: '17px', borderRadius: '4px', marginLeft: '6px' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>Relay</span>
        </div>
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { n: 'Maya Okonkwo', m: 'found you by username', c: 'var(--accent)', unread: 2 },
            { n: 'Study Group', m: 'Dami: see you at 6', c: '#C084FC' },
            { n: 'Tobi', m: 'Voice message', c: '#60A5FA' },
          ].map(r => (
            <div key={r.n} style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <span style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: r.c, border: '2px solid var(--border-strong)',
              }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{r.n}</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)' }}>{r.m}</span>
              </span>
              {r.unread && (
                <span style={{
                  minWidth: '20px', height: '20px', borderRadius: '999px', flexShrink: 0,
                  background: 'var(--accent)', border: '2px solid var(--border-strong)',
                  fontSize: '11px', fontWeight: '800', color: 'var(--on-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{r.unread}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '14px', lineHeight: 1.5 }}>
        Its own window — no tabs, no address bar.
      </p>
    </div>
  )
}

// Android's payoff is the icon sitting on the home screen with everything
// else — the real icon asset, next to muted placeholders so it reads as
// "one of your apps" rather than a lone logo on a card.
//
// The wallpaper is the app's own dark-theme charcoals rather than an
// invented gradient: a purple/mauve one was the only colour on the whole
// site that belonged to nothing, and a warm near-black both looks like a
// real phone and lets the accent-ringed icon carry the colour alone.
function HomeScreenMock() {
  return (
    <div style={{ width: '100%', maxWidth: '430px' }}>
      <div style={{
        background: 'linear-gradient(160deg, #2B2A25 0%, #1B1B18 100%)',
        border: '3px solid var(--border-strong)',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-hard-md)',
        padding: '22px 20px 26px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px 14px' }}>
          {[0, 1, 2, 3, 4].map(i => <PlaceholderApp key={i} i={i} />)}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt=""
              style={{
                width: '100%', aspectRatio: '1', borderRadius: '15px',
                border: '2.5px solid var(--accent)', background: '#fff',
                boxShadow: '0 0 0 4px rgba(255,184,0,0.28)',
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>Relay</span>
          </div>
          {[5, 6].map(i => <PlaceholderApp key={i} i={i} />)}
        </div>
      </div>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '14px', lineHeight: 1.5 }}>
        On your home screen with everything else.
      </p>
    </div>
  )
}

function PlaceholderApp({ i }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
      <span style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: '15px',
        background: `rgba(255,255,255,${0.1 + (i % 3) * 0.045})`,
      }} />
      <span style={{
        width: `${60 + (i % 3) * 12}%`,
        height: '5px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.28)',
      }} />
    </div>
  )
}

// Both taps, in order — the sheet alone assumed people already know
// where Share lives, which is exactly the thing most iPhone users don't.
function IOSSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '430px' }}>
      <Step n="1" label="Tap Share in Safari">
        <SafariToolbar />
      </Step>
      <Step n="2" label="Pick Add to Home Screen">
        <ShareSheet />
      </Step>
    </div>
  )
}

function Step({ n, label, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{
          width: '26px',
          height: '26px',
          flexShrink: 0,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: '2px solid var(--border-strong)',
          color: 'var(--on-accent)',
          fontSize: '13px',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>{n}</span>
        <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.01em' }}>{label}</p>
      </div>
      {children}
    </div>
  )
}

// Safari's real bottom toolbar. The Share glyph is the only one ringed in
// accent — everything else is deliberately muted, so the eye lands on the
// one button that matters rather than reading five icons.
function SafariToolbar() {
  const dim = 'rgba(0,0,0,0.32)'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      background: '#F2F2F7',
      border: '3px solid var(--border-strong)',
      borderRadius: '18px',
      boxShadow: 'var(--shadow-hard-md)',
      padding: '14px 18px',
    }}>
      <ChevronLeft size={22} strokeWidth={2.2} color={dim} />
      <ChevronRight size={22} strokeWidth={2.2} color={dim} />
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: 'var(--accent)',
        border: '2.5px solid var(--border-strong)',
        flexShrink: 0,
      }}>
        <Share size={20} strokeWidth={2.4} color="var(--on-accent)" />
      </span>
      <BookOpen size={22} strokeWidth={2.2} color={dim} />
      <Copy size={22} strokeWidth={2.2} color={dim} />
    </div>
  )
}

const SHEET_ROWS = [
  { icon: BookOpen, label: 'Add Bookmark to…' },
  { icon: Star, label: 'Add to Favourites' },
  { icon: StickyNote, label: 'Add to Quick Note' },
  { icon: Search, label: 'Find on Page' },
  { icon: SquarePlus, label: 'Add to Home Screen', highlight: true },
]

// A full-size recreation of the iOS share sheet, not a hint about it.
// Dark greys are hardcoded rather than themed: this is a drawing of
// Apple's UI, and Apple's sheet doesn't turn white because our site is
// in light mode — recolouring it would break the recognition that makes
// it useful. The outer card uses our own border/shadow so the artifact
// still sits inside the site's language.
function ShareSheet() {
  return (
    <div>
      <div style={{
        background: '#6B6B6E',
        border: '3px solid var(--border-strong)',
        borderRadius: '22px',
        boxShadow: 'var(--shadow-hard-md)',
        padding: '18px 16px 16px',
      }}>
        {/* Header: the real sheet leads with the app's own icon, name and
            URL — the one place a visitor sees Relay's icon before it's
            actually on their phone. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            style={{ width: '58px', height: '58px', borderRadius: '13px', flexShrink: 0, background: '#fff' }}
          />
          <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
            <p style={{ fontSize: '19px', fontWeight: '700', color: '#fff', letterSpacing: '-0.01em' }}>Relay</p>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>relaymsg.vercel.app</p>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
              background: 'rgba(255,255,255,0.18)',
              borderRadius: '999px',
              padding: '5px 14px',
            }}>
              Options ›
            </span>
          </div>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            flexShrink: 0,
          }}>
            <X size={17} strokeWidth={2.5} color="rgba(255,255,255,0.85)" />
          </span>
        </div>

        {/* The list itself. Add to Home Screen is the last row in the real
            sheet too — no reordering, since the point is that it matches
            what they'll actually be looking at. */}
        <div style={{ background: '#3A3A3C', borderRadius: '14px', overflow: 'hidden' }}>
          {SHEET_ROWS.map(({ icon: Icon, label, highlight }, i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '15px 16px',
                borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.09)',
                background: highlight ? 'var(--accent)' : 'transparent',
              }}
            >
              <Icon size={21} strokeWidth={1.9} color={highlight ? 'var(--on-accent)' : '#fff'} />
              <span style={{
                fontSize: '16px',
                fontWeight: highlight ? '800' : '500',
                color: highlight ? 'var(--on-accent)' : '#fff',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
