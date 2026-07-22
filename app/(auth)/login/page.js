'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signInWithEmail, signInWithGoogle } from '@/actions/auth'

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

    const data = new FormData()
    data.append('email', formData.email)
    data.append('password', formData.password)

    const result = await signInWithEmail(data)

    if (result?.error) {
      setServerError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    window.location.href = '/chat'
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const result = await signInWithGoogle()
    if (result?.error) {
      setServerError(result.error.message || 'Google sign in failed.')
      setGoogleLoading(false)
      return
    }
    if (result?.url) {
      window.location.href = result.url
    }
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
          <h1 style={{
            fontSize: '22px',
            fontWeight: '800',
            marginBottom: '6px',
            color: '#0a0a0a',
          }}>Welcome back</h1>
          <p style={{
            fontSize: '14px',
            color: '#525252',
            marginBottom: '28px',
          }}>Sign in to continue to Relay.</p>

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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a' }}>
                  Password
                </label>
                <Link href="/reset-password" style={{ fontSize: '12px', color: '#525252', textDecoration: 'none', fontWeight: '500' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                name="password"
                type="password"
                placeholder="Your password"
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

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? '#525252' : '#0a0a0a',
                color: '#fff',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: loading ? 'none' : '3px 3px 0 #FFB800',
                transition: 'transform 0.15s, box-shadow 0.15s',
                marginTop: '4px',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.target.style.transform = 'translate(-1px, -1px)'
                  e.target.style.boxShadow = '4px 4px 0 #FFB800'
                }
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translate(0, 0)'
                e.target.style.boxShadow = loading ? 'none' : '3px 3px 0 #FFB800'
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '24px 0',
          }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
            <span style={{ fontSize: '12px', color: '#A3A3A3', fontWeight: '500' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e5e5' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: '100%',
              padding: '13px',
              background: '#fff',
              color: '#0a0a0a',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <p style={{
            textAlign: 'center',
            fontSize: '13px',
            color: '#525252',
            marginTop: '24px',
          }}>
            Don't have an account?{' '}
            <Link href="/signup" style={{ color: '#0a0a0a', fontWeight: '700', textDecoration: 'none' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}