'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkUsernameAvailable } from '@/actions/auth'
import { storeSessionInfo } from '@/actions/sessions'
import AuthShell from '@/components/auth/AuthShell'

export default function SetupUsernamePage() {
  const [formData, setFormData] = useState({ username: '', display_name: '' })
  const [usernameState, setUsernameState] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(null)
  const usernameTimeout = useRef(null)

  // This page is only reached right after Google OAuth completes for a
  // new user (see app/api/auth/callback/route.js), so this is where we
  // capture the browser's real user agent for the active session.
  useEffect(() => {
    storeSessionInfo(navigator.userAgent)
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
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
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError(null)

    const newErrors = {}
    if (!formData.display_name.trim()) newErrors.display_name = 'Display name is required'
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    if (usernameState === 'taken') newErrors.username = 'Username is already taken'
    if (usernameState === 'invalid') newErrors.username = 'Invalid username format'
    if (usernameState === 'checking') newErrors.username = 'Please wait for availability check'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setServerError('Session expired. Please sign in again.')
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('users')
      .update({
        username: formData.username,
        display_name: formData.display_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      setServerError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    const next = new URLSearchParams(window.location.search).get('next')
    // Only ever follow a same-origin relative path — an absolute or
    // protocol-relative (//host) value here would be an open redirect.
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/chat'
    window.location.href = safeNext
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
        One last step
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
        Choose a username and display name for your Relay account.
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
          {errors.username && (
            <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{errors.username}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="relay-btn relay-btn--filled"
          style={{ width: '100%', padding: '13px', fontSize: '14px', marginTop: '4px', boxShadow: loading ? 'none' : 'var(--shadow-hard-accent)' }}
        >
          {loading ? 'Setting up...' : 'Finish setup'}
        </button>
      </form>
    </AuthShell>
  )
}
