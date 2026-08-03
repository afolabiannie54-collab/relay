'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signInWithEmail, signInWithGoogle } from '@/actions/auth'
import { storeSessionInfo } from '@/actions/sessions'
import AuthShell from '@/components/auth/AuthShell'

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [serverError, setServerError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.password.trim()) newErrors.password = 'Password is required'
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError(null)

    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      const data = new FormData()
      data.append('email', formData.email)
      data.append('password', formData.password)

      const result = await signInWithEmail(data)

      if (result?.error) {
        setServerError('Invalid email or password. Please try again.')
        setLoading(false)
        return
      }

      // Best-effort device/session bookkeeping (powers Settings > Active
      // sessions) — must never block the redirect below. Sign-in itself
      // already succeeded by this point; if this hangs or fails, the user
      // shouldn't be stuck staring at "Signing in..." over it.
      try {
        await storeSessionInfo(navigator.userAgent)
      } catch {}

      const next = new URLSearchParams(window.location.search).get('next')
      // Only ever follow a same-origin relative path — an absolute or
      // protocol-relative (//host) value here would be an open redirect.
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/chat'
      window.location.href = safeNext
    } catch {
      setServerError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      const result = await signInWithGoogle()
      if (result?.error) {
        setServerError(result.error.message || 'Google sign in failed.')
        setGoogleLoading(false)
        return
      }
      if (result?.url) {
        window.location.href = result.url
      } else {
        setGoogleLoading(false)
      }
    } catch {
      setServerError('Google sign in failed. Please try again.')
      setGoogleLoading(false)
    }
  }

  const inputStyle = (field) => ({
    width: '100%',
    padding: '12px 14px',
    fontSize: '16px',
    boxSizing: 'border-box',
    borderColor: errors[field] ? 'var(--error)' : undefined,
  })

  return (
    <AuthShell>
      <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px', color: 'var(--text)' }}>
        Welcome back
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
        Sign in to continue to Relay.
      </p>

      {serverError && (
        <div style={{
          background: 'var(--error-light)',
          border: '1.5px solid var(--error)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          marginBottom: '20px',
          fontSize: '13px',
          color: 'var(--error)',
        }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
            Email
          </label>
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            className="relay-input"
            style={inputStyle('email')}
          />
          {errors.email && (
            <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{errors.email}</p>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
              Password
            </label>
            <Link href="/reset-password" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>
              Forgot password?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            placeholder="Your password"
            value={formData.password}
            onChange={handleChange}
            className="relay-input"
            style={inputStyle('password')}
          />
          {errors.password && (
            <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="relay-btn relay-btn--filled"
          style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px', boxShadow: 'var(--shadow-hard-accent)' }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '500' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="relay-btn"
        style={{ width: '100%', padding: '13px', fontSize: '14px' }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" style={{ color: 'var(--text)', fontWeight: '700', textDecoration: 'none' }}>
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}
