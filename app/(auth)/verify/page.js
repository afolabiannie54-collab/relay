'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPage() {
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState(null)

  const handleResend = async () => {
    setResending(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('No account found. Please sign up again.')
      setResending(false)
      return
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
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
        {/* Stickman illustration */}
        <div style={{ marginBottom: '24px' }}>
          <svg width="80" height="100" viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="18" r="14" stroke="#0a0a0a" strokeWidth="1.5" fill="#FFB800"/>
            <line x1="40" y1="32" x2="40" y2="65" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="20" y1="45" x2="60" y2="45" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="40" y1="65" x2="25" y2="88" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="40" y1="65" x2="55" y2="88" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round"/>
            {/* envelope in hand */}
            <rect x="55" y="35" width="22" height="16" rx="3" stroke="#0a0a0a" strokeWidth="1.5" fill="white"/>
            <path d="M55 38 L66 46 L77 38" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
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
          We sent you a verification link. Click it to activate your account. Check your spam folder if you don't see it.
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
          }}>
            Verification email resent successfully.
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={resending || resent}
          style={{
            width: '100%',
            padding: '13px',
            background: resending || resent ? '#525252' : '#0a0a0a',
            color: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: resending || resent ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: resending || resent ? 'none' : '3px 3px 0 #FFB800',
            marginBottom: '16px',
          }}
        >
          {resending ? 'Sending...' : resent ? 'Email sent' : 'Resend verification email'}
        </button>

        <a href="/login" style={{
          fontSize: '13px',
          color: '#525252',
          textDecoration: 'none',
        }}>
          Back to sign in
        </a>
      </div>
    </div>
  )
}