'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { storeSessionInfo } from '@/actions/sessions'
import AuthShell from '@/components/auth/AuthShell'

// sessionStorage alone doesn't survive a reload of this exact page (tab
// closed and reopened from the verification email's own link, browser tab
// restore, opening in a new tab) even though the pending signup is still
// valid server-side — the ?email= query param set by signup/page.js is
// the fallback for that case, and gets written back into sessionStorage
// so a resend triggered later in the same tab uses the same primary path.
function getVerifyEmail() {
  const stored = sessionStorage.getItem('verifyEmail')
  if (stored) return stored
  const fromUrl = new URLSearchParams(window.location.search).get('email')
  if (fromUrl) {
    sessionStorage.setItem('verifyEmail', fromUrl)
    return fromUrl
  }
  return null
}

export default function VerifyPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  // Was `resent` alone — once true it disabled the button for the rest
  // of the page's life with no way back, so a lost/delayed first email
  // left the user with no path except reloading (which also wipes
  // sessionStorage.verifyEmail, breaking the session entirely). A cooldown
  // re-enables it instead of locking it forever.
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleVerify = async (e) => {
    e.preventDefault()
    setError(null)

    if (code.length < 6) {
      setError('Please enter the verification code from your email.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const email = getVerifyEmail()

      if (!email) {
        setError('Session expired. Please sign up again.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      })

      if (error) {
        setError('Invalid or expired code. Please try again.')
        setLoading(false)
        return
      }

      sessionStorage.removeItem('verifyEmail')

      // Best-effort device/session bookkeeping — must never block the
      // redirect. Verification itself already succeeded by this point.
      try {
        await storeSessionInfo(navigator.userAgent)
      } catch {}

      const next = new URLSearchParams(window.location.search).get('next')
      // Only ever follow a same-origin relative path — an absolute or
      // protocol-relative (//host) value here would be an open redirect.
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/chat'
      window.location.href = safeNext
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)
    setResent(false)

    try {
      const email = getVerifyEmail()

      if (!email) {
        setError('Session expired. Please sign up again.')
        return
      }

      const supabase = createClient()

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })

      if (error) {
        setError(error.message)
      } else {
        setResent(true)
        setCooldown(30)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell>
      <div style={{ textAlign: 'center' }}>
        {/* Envelope icon */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="14" width="56" height="38" rx="4" stroke="var(--border-strong)" strokeWidth="1.5" fill="var(--accent-light)"/>
            <path d="M4 18 L32 38 L60 18" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <line x1="4" y1="52" x2="22" y2="34" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="60" y1="52" x2="42" y2="34" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>
          Check your email
        </h1>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
          We sent a 6 digit verification code to your email. Enter it below to activate your account.
        </p>

        {error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--error)',
            textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {resent && (
          <div style={{
            background: 'var(--success-light)',
            border: '1.5px solid var(--success)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--success)',
            textAlign: 'left',
          }}>
            Verification code resent successfully.
          </div>
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            className="relay-input"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '28px',
              fontWeight: '800',
              letterSpacing: '12px',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="relay-btn relay-btn--filled"
            style={{ width: '100%', padding: '13px', fontSize: '14px', boxShadow: (loading || code.length !== 6) ? 'none' : 'var(--shadow-hard-accent)' }}
          >
            {loading ? 'Verifying...' : 'Verify account'}
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            cursor: resending || cooldown > 0 ? 'not-allowed' : 'pointer',
            marginTop: '20px',
            fontFamily: 'inherit',
            textDecoration: 'underline',
          }}
        >
          {resending ? 'Sending...' : cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
        </button>

        <p style={{ marginTop: '12px' }}>
          <a href="/login" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Back to sign in
          </a>
        </p>
      </div>
    </AuthShell>
  )
}
