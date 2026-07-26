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
      minHeight: '100vh',
      background: '#F5F5F5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <p style={{ color: '#A3A3A3', fontSize: '14px' }}>Signing you in...</p>
    </div>
  )
}
