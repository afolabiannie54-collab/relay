'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resetPasswordRequest, resetPassword } from '@/actions/auth'

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
    const data = new FormData()
    data.append('email', formData.email)

    const result = await resetPasswordRequest(data)

    if (result?.error) {
      setServerError(result.error.message)
      setLoading(false)
      return
    }

    setStep('sent')
    setLoading(false)
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
    const data = new FormData()
    data.append('password', formData.password)

    const result = await resetPassword(data)

    if (result?.error) {
      setServerError(result.error.message)
      setLoading(false)
      return
    }

    window.location.href = '/chat'
  }

  const inputStyle = (field) => ({
    width: '100%',
    padding: '12px 14px',
    border: `1.5px solid ${errors[field] ? '#EF4444' : '#e5e5e5'}`,
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    background: '#fff',
    color: '#0a0a0a',
    transition: 'border-color 0.15s',
  })

  const buttonStyle = (isLoading) => ({
    width: '100%',
    padding: '13px',
    background: isLoading ? '#525252' : '#0a0a0a',
    color: '#fff',
    border: '1.5px solid #0a0a0a',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    boxShadow: isLoading ? 'none' : '3px 3px 0 #FFB800',
    marginTop: '4px',
  })

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
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '4px 4px 0 #0a0a0a',
        }}>

          {/* Request step */}
          {step === 'request' && (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px', color: '#0a0a0a' }}>
                Reset your password
              </h1>
              <p style={{ fontSize: '14px', color: '#525252', marginBottom: '28px' }}>
                Enter your email and we'll send you a reset link.
              </p>

              {serverError && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1.5px solid #EF4444',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#EF4444',
                }}>
                  {serverError}
                </div>
              )}

              <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '6px' }}>
                    Email
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    style={inputStyle('email')}
                    onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                    onBlur={e => e.target.style.borderColor = errors.email ? '#EF4444' : '#e5e5e5'}
                  />
                  {errors.email && (
                    <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors.email}</p>
                  )}
                </div>

                <button type="submit" disabled={loading} style={buttonStyle(loading)}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#525252', marginTop: '24px' }}>
                Remember your password?{' '}
                <Link href="/login" style={{ color: '#0a0a0a', fontWeight: '700', textDecoration: 'none' }}>
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
                  <circle cx="32" cy="32" r="30" stroke="#0a0a0a" strokeWidth="1.5" fill="#FFF8E1"/>
                  <path d="M20 32 L28 40 L44 24" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px', color: '#0a0a0a' }}>
                Check your email
              </h1>
              <p style={{ fontSize: '14px', color: '#525252', lineHeight: '1.6', marginBottom: '24px' }}>
                We sent a reset link to <strong>{formData.email}</strong>. It expires in 15 minutes.
              </p>
              <Link href="/login" style={{
                display: 'block',
                textAlign: 'center',
                fontSize: '13px',
                color: '#525252',
                textDecoration: 'none',
              }}>
                Back to sign in
              </Link>
            </div>
          )}

          {/* Reset step */}
          {step === 'reset' && (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '6px', color: '#0a0a0a' }}>
                Set new password
              </h1>
              <p style={{ fontSize: '14px', color: '#525252', marginBottom: '28px' }}>
                Choose a strong password for your account.
              </p>

              {serverError && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1.5px solid #EF4444',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#EF4444',
                }}>
                  {serverError}
                </div>
              )}

              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '6px' }}>
                    New password
                  </label>
                  <input
                    name="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    style={inputStyle('password')}
                    onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                    onBlur={e => e.target.style.borderColor = errors.password ? '#EF4444' : '#e5e5e5'}
                  />
                  {errors.password && (
                    <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors.password}</p>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '6px' }}>
                    Confirm password
                  </label>
                  <input
                    name="confirm"
                    type="password"
                    placeholder="Repeat your password"
                    value={formData.confirm}
                    onChange={handleChange}
                    style={inputStyle('confirm')}
                    onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                    onBlur={e => e.target.style.borderColor = errors.confirm ? '#EF4444' : '#e5e5e5'}
                  />
                  {errors.confirm && (
                    <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors.confirm}</p>
                  )}
                </div>

                <button type="submit" disabled={loading} style={buttonStyle(loading)}>
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}