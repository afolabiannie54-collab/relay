'use client'

import { useEffect } from 'react'
import { storeSessionInfo } from '@/actions/sessions'

export default function OAuthCompletePage() {
  useEffect(() => {
    async function finish() {
      // Best-effort device/session bookkeeping — the OAuth callback route
      // already set a valid session cookie before ever redirecting here,
      // so this failing/hanging must never block the redirect below.
      try {
        await storeSessionInfo(navigator.userAgent)
      } catch {}
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')
      // Same guard login/page.js and verify/page.js already apply to
      // their own `next` params — this was the one redirect in the app
      // that used it unchecked. A crafted OAuth callback URL
      // (?next=https://evil.example) would otherwise send a user who
      // just signed in straight to an external site.
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/chat'
      window.location.href = safeNext
    }
    finish()
  }, [])

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Signing you in...</p>
    </div>
  )
}
