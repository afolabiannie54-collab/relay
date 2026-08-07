'use client'

import { useState, useEffect } from 'react'
import { Share, SquarePlus, Check, Download } from 'lucide-react'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Chrome/Edge fire beforeinstallprompt, which can be captured and replayed
// from a button of our own — a real one-tap native install.
//
// iOS has no equivalent and never has: Safari exposes no API to trigger
// "Add to Home Screen", so the only honest option there is to show the
// steps. Rather than a line of small print, they're laid out as numbered
// cards with the actual iOS glyphs, because the whole reason people don't
// install PWAs on iPhone is that the Share-sheet route is undiscoverable.
export default function InstallRelay() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent
    // iPadOS 13+ reports itself as a Mac, so the touch-point check is what
    // actually catches modern iPads.
    const iOSLike = /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes('Mac') && typeof document !== 'undefined' && navigator.maxTouchPoints > 1)
    setIsIOS(iOSLike)

    // Already running as an installed app — nothing to offer.
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
    // The event is single-use — Chrome won't let the same one be replayed,
    // so it's dropped either way and re-fired by the browser if still
    // eligible.
    setDeferredPrompt(null)
    if (outcome === 'accepted') setInstalled(true)
  }

  if (installed) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 22px',
        background: 'var(--accent-light)',
        border: '2px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-hard-sm)',
      }}>
        <Check size={18} strokeWidth={3} color="var(--accent-text)" />
        <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)' }}>
          Relay is installed on this device
        </span>
      </div>
    )
  }

  if (isIOS) return <IOSSteps />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
      <button
        onClick={handleInstall}
        disabled={!deferredPrompt}
        className="relay-btn relay-btn--filled"
        style={{
          padding: '16px 28px',
          fontSize: '16px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-hard-accent)',
        }}
      >
        <Download size={18} {...iconProps} />
        Install Relay
      </button>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '340px', lineHeight: 1.5 }}>
        {deferredPrompt
          ? 'Installs as a real app — own window, home screen icon, notifications.'
          : 'Your browser will offer to install Relay once you’ve used it for a moment. You can also use it right here in the browser.'}
      </p>
    </div>
  )
}

const STEPS = [
  { n: '1', icon: Share, title: 'Tap Share', body: 'The square with an arrow, in Safari’s bottom bar.' },
  { n: '2', icon: SquarePlus, title: 'Add to Home Screen', body: 'Scroll the share sheet until you see it.' },
  { n: '3', icon: Check, title: 'Tap Add', body: 'Relay lands on your home screen like any other app.' },
]

function IOSSteps() {
  return (
    <div style={{ width: '100%' }}>
      <p style={{
        fontSize: '13px',
        fontWeight: '800',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--accent-text)',
        marginBottom: '14px',
      }}>
        Installing on iPhone
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
      }}>
        {STEPS.map(({ n, icon: Icon, title, body }) => (
          <div
            key={n}
            style={{
              background: 'var(--surface)',
              border: '2px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-hard-sm)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              <Icon size={20} {...iconProps} color="var(--text)" />
            </div>
            <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.5 }}>
        Apple doesn&apos;t let websites install themselves on iOS — these three taps are the only way, for every app like this.
      </p>
    </div>
  )
}
