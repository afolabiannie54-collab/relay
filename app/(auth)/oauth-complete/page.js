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
      const next = params.get('next') || '/chat'
      window.location.href = next
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
