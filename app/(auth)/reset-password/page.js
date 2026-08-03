'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resetPasswordRequest, resetPassword } from '@/actions/auth'
import AuthShell from '@/components/auth/AuthShell'

export default function ResetPasswordPage() {
  const [step, setStep] = useState('request') // 'request' | 'sent' | 'reset'
  const [formData, setFormData] = useState({ email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(null)

  // Check if we're in reset mode (came from email link)
  useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash.includes('type=recovery')) {
        setStep('reset')
      }
    }
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null }))
  }

  const handleRequest = async (e) => {
    e.preventDefault()
    setServerError(null)

    if (!formData.email.trim()) {
      setErrors({ email: 'Email is required' })
      return
    }

    setLoading(true)

    try {
      const data = new FormData()
      data.append('email', formData.email)

      const result = await resetPasswordRequest(data)

      if (result?.error) {
        setServerError(result.error.message)
        setLoading(false)
        return
      }

      setStep('sent')
    } catch {
      setServerError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setServerError(null)

    const newErrors = {}
    if (!formData.password.trim()) newErrors.password = 'Password is required'
    if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (formData.password !== formData.confirm) newErrors.confirm = 'Passwords do not match'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      const data = new FormData()
      data.append('password', formData.password)

      const result = await resetPassword(data)

      if (result?.error) {
        setServerError(result.error.message)
        setLoading(false)
        return
      }

      window.location.href = '/chat'
    } catch {
      setServerError('Something went wrong. Please try again.')
      setLoading(false)
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
      {/* Request step */}
      {step === 'request' && (
        <>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px', color: 'var(--text)' }}>
            Reset your password
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
            Enter your email and we&apos;ll send you a reset link.
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

          <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

            <button
              type="submit"
              disabled={loading}
              className="relay-btn relay-btn--filled"
              style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px', boxShadow: loading ? 'none' : 'var(--shadow-hard-accent)' }}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
            Remember your password?{' '}
            <Link href="/login" style={{ color: 'var(--text)', fontWeight: '700', textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </>
      )}

      {/* Sent step */}
      {step === 'sent' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="var(--border-strong)" strokeWidth="1.5" fill="var(--accent-light)"/>
              <path d="M20 32 L28 40 L44 24" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', color: 'var(--text)' }}>
            Check your email
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            We sent a reset link to <strong>{formData.email}</strong>. It expires in 15 minutes.
          </p>
          <Link href="/login" style={{
            display: 'block',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}>
            Back to sign in
          </Link>
        </div>
      )}

      {/* Reset step */}
      {step === 'reset' && (
        <>
          <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px', color: 'var(--text)' }}>
            Set new password
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
            Choose a strong password for your account.
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

          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                New password
              </label>
              <input
                name="password"
                type="password"
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={handleChange}
                className="relay-input"
                style={inputStyle('password')}
              />
              {errors.password && (
                <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{errors.password}</p>
              )}
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                Confirm password
              </label>
              <input
                name="confirm"
                type="password"
                placeholder="Repeat your password"
                value={formData.confirm}
                onChange={handleChange}
                className="relay-input"
                style={inputStyle('confirm')}
              />
              {errors.confirm && (
                <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{errors.confirm}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relay-btn relay-btn--filled"
              style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px', boxShadow: loading ? 'none' : 'var(--shadow-hard-accent)' }}
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
