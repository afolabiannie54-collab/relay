'use client'

import { useEffect } from 'react'
import { storeSessionInfo } from '@/actions/sessions'

export default function OAuthCompletePage() {
  useEffect(() => {
    async function finish() {
      await storeSessionInfo(navigator.userAgent)
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
