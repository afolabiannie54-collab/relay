'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState(null)

  const handleVerify = async (e) => {
    e.preventDefault()
    setError(null)

    if (code.length < 6) {
      setError('Please enter the verification code from your email.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const email = sessionStorage.getItem('verifyEmail')

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
    window.location.href = '/chat'
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)
    setResent(false)

    const email = sessionStorage.getItem('verifyEmail')

    if (!email) {
      setError('Session expired. Please sign up again.')
      setResending(false)
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
    }
    setResending(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#fff',
        border: '1.5px solid #0a0a0a',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '4px 4px 0 #0a0a0a',
        textAlign: 'center',
      }}>

        {/* Envelope icon */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="14" width="56" height="38" rx="4" stroke="#0a0a0a" strokeWidth="1.5" fill="#FFF8E1"/>
            <path d="M4 18 L32 38 L60 18" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <line x1="4" y1="52" x2="22" y2="34" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="60" y1="52" x2="42" y2="34" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: '22px',
          fontWeight: '800',
          color: '#0a0a0a',
          marginBottom: '8px',
        }}>Check your email</h1>

        <p style={{
          fontSize: '14px',
          color: '#525252',
          lineHeight: '1.6',
          marginBottom: '32px',
        }}>
          We sent a 6 digit verification code to your email. Enter it below to activate your account.
        </p>

        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1.5px solid #EF4444',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#EF4444',
            textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {resent && (
          <div style={{
            background: '#F0FDF4',
            border: '1.5px solid #22C55E',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#22C55E',
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
            style={{
              width: '100%',
              padding: '16px',
              border: '1.5px solid #e5e5e5',
              borderRadius: '8px',
              fontSize: '28px',
              fontFamily: 'inherit',
              fontWeight: '800',
              letterSpacing: '12px',
              textAlign: 'center',
              outline: 'none',
              color: '#0a0a0a',
              background: '#fff',
            }}
            onFocus={e => e.target.style.borderColor = '#0a0a0a'}
            onBlur={e => e.target.style.borderColor = '#e5e5e5'}
          />

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              width: '100%',
              padding: '13px',
              background: loading || code.length !== 6 ? '#525252' : '#0a0a0a',
              color: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: loading || code.length !== 6 ? 'none' : '3px 3px 0 #FFB800',
            }}
          >
            {loading ? 'Verifying...' : 'Verify account'}
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={resending || resent}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            color: '#525252',
            cursor: resending || resent ? 'not-allowed' : 'pointer',
            marginTop: '20px',
            fontFamily: 'inherit',
            textDecoration: 'underline',
          }}
        >
          {resending ? 'Sending...' : resent ? 'Code sent' : 'Resend code'}
        </button>

        <p style={{ marginTop: '12px' }}>
          <a href="/login" style={{ fontSize: '13px', color: '#525252', textDecoration: 'none' }}>
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  )
}