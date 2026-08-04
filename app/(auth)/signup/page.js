'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { signUpWithEmail, signInWithGoogle, checkUsernameAvailable, checkEmailExists } from '@/actions/auth'
import AuthShell from '@/components/auth/AuthShell'

export default function SignupPage() {
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [usernameState, setUsernameState] = useState(null) // null | 'checking' | 'available' | 'taken' | 'invalid'
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [serverError, setServerError] = useState(null)
  const usernameTimeout = useRef(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: null }))

    if (name === 'username') {
      const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '')
      setFormData(prev => ({ ...prev, username: cleaned }))

      if (usernameTimeout.current) clearTimeout(usernameTimeout.current)

      if (cleaned.length < 3) {
        setUsernameState(null)
        setSuggestions([])
        return
      }

      setUsernameState('checking')
      usernameTimeout.current = setTimeout(async () => {
        const result = await checkUsernameAvailable(cleaned)
        if (result.error) {
          setUsernameState('invalid')
          setSuggestions([])
        } else if (result.available) {
          setUsernameState('available')
          setSuggestions([])
        } else {
          setUsernameState('taken')
          setSuggestions(result.suggestions || [])
        }
      }, 500)
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.display_name.trim()) newErrors.display_name = 'Display name is required'
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    if (usernameState === 'taken') newErrors.username = 'Username is already taken'
    if (usernameState === 'invalid') newErrors.username = 'Invalid username format'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    if (!formData.password.trim()) newErrors.password = 'Password is required'
    if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
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
      const emailCheck = await checkEmailExists(formData.email)
      if (emailCheck.exists) {
        setErrors(prev => ({ ...prev, email: 'An account with this email already exists.' }))
        setLoading(false)
        return
      }

      const data = new FormData()
      data.append('display_name', formData.display_name)
      data.append('username', formData.username)
      data.append('email', formData.email)
      data.append('password', formData.password)

      const result = await signUpWithEmail(data)

      if (result?.error) {
        setServerError(result.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      sessionStorage.setItem('verifyEmail', formData.email)
      window.location.href = '/verify'
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
        setServerError(result.error || 'Google sign in failed.')
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
        Create your account
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
        Your people are one search away.
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
        {/* Display name */}
        <div>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
            Display name
          </label>
          <input
            name="display_name"
            type="text"
            placeholder="John Doe"
            value={formData.display_name}
            onChange={handleChange}
            className="relay-input"
            style={inputStyle('display_name')}
          />
          {errors.display_name && (
            <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{errors.display_name}</p>
          )}
        </div>

        {/* Username */}
        <div>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
            Username
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              fontSize: '14px',
              pointerEvents: 'none',
            }}>@</span>
            <input
              name="username"
              type="text"
              placeholder="johndoe"
              value={formData.username}
              onChange={handleChange}
              className="relay-input"
              style={{ ...inputStyle('username'), paddingLeft: '28px' }}
            />
          </div>

          {/* Username feedback */}
          {usernameState === 'checking' && (
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Checking availability...</p>
          )}
          {usernameState === 'available' && (
            <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>✓ Username available</p>
          )}
          {usernameState === 'taken' && (
            <div style={{ marginTop: '4px' }}>
              <p style={{ fontSize: '12px', color: 'var(--error)' }}>✗ Username taken</p>
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, username: s }))
                        setUsernameState('available')
                        setSuggestions([])
                      }}
                      style={{
                        padding: '4px 10px',
                        border: '1.5px solid var(--border-strong)',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '12px',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      @{s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {usernameState === 'invalid' && (
            <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>
              3-20 characters, lowercase letters, numbers and underscores only
            </p>
          )}
          {errors.username && !usernameState && (
            <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{errors.username}</p>
          )}
        </div>

        {/* Email */}
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

        {/* Password */}
        <div>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
            Password
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

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="relay-btn relay-btn--filled"
          style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px', boxShadow: 'var(--shadow-hard-accent)' }}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: '500' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      {/* Google */}
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

      {/* Sign in link */}
      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--text)', fontWeight: '700', textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
