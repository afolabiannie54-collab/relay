'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { checkUsernameAvailable } from '@/actions/auth'

export default function SetupUsernamePage() {
  const [formData, setFormData] = useState({ username: '', display_name: '' })
  const [usernameState, setUsernameState] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState(null)
  const usernameTimeout = useRef(null)

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
          }}>One last step</h1>
          <p style={{
            fontSize: '14px',
            color: '#525252',
            marginBottom: '28px',
          }}>Choose a username and display name for your Relay account.</p>

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
            {/* Display name */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '6px' }}>
                Display name
              </label>
              <input
                name="display_name"
                type="text"
                placeholder="John Doe"
                value={formData.display_name}
                onChange={handleChange}
                style={inputStyle('display_name')}
                onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                onBlur={e => e.target.style.borderColor = errors.display_name ? '#EF4444' : '#e5e5e5'}
              />
              {errors.display_name && (
                <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors.display_name}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '6px' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#A3A3A3',
                  fontSize: '14px',
                  pointerEvents: 'none',
                }}>@</span>
                <input
                  name="username"
                  type="text"
                  placeholder="johndoe"
                  value={formData.username}
                  onChange={handleChange}
                  style={{ ...inputStyle('username'), paddingLeft: '28px' }}
                  onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                  onBlur={e => e.target.style.borderColor = errors.username ? '#EF4444' : '#e5e5e5'}
                />
              </div>

              {usernameState === 'checking' && (
                <p style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '4px' }}>Checking availability...</p>
              )}
              {usernameState === 'available' && (
                <p style={{ fontSize: '12px', color: '#22C55E', marginTop: '4px' }}>✓ Username available</p>
              )}
              {usernameState === 'taken' && (
                <div style={{ marginTop: '4px' }}>
                  <p style={{ fontSize: '12px', color: '#EF4444' }}>✗ Username taken</p>
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
                            border: '1.5px solid #0a0a0a',
                            borderRadius: '100px',
                            fontSize: '12px',
                            background: '#fff',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            color: '#0a0a0a',
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
                <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>
                  3-20 characters, lowercase letters, numbers and underscores only
                </p>
              )}
              {errors.username && (
                <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors.username}</p>
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
              {loading ? 'Setting up...' : 'Finish setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}