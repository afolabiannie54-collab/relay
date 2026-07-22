'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import { getOwnProfile, updateProfile, uploadAvatar, changeUsername } from '@/actions/users'
import { checkUsernameAvailable } from '@/actions/auth'

export default function EditProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({ display_name: '', bio: '' })

  // Username change state
  const [showUsernameChange, setShowUsernameChange] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameState, setUsernameState] = useState(null)
  const [usernameSuggestions, setUsernameSuggestions] = useState([])
  const [usernameError, setUsernameError] = useState(null)
  const [savingUsername, setSavingUsername] = useState(false)
  const usernameTimeout = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    async function load() {
      const result = await getOwnProfile()
      if (result.data) {
        setProfile(result.data)
        setFormData({
          display_name: result.data.display_name || '',
          bio: result.data.bio || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const data = new FormData()
    data.append('display_name', formData.display_name)
    data.append('bio', formData.bio)

    const result = await updateProfile(data)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Profile updated successfully.')
      setProfile(prev => ({ ...prev, ...formData }))
    }
    setSaving(false)
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    const data = new FormData()
    data.append('avatar', file)

    const result = await uploadAvatar(data)

    if (result.error) {
      setError(result.error)
    } else {
      setProfile(prev => ({ ...prev, avatar_url: result.url }))
      setSuccess('Avatar updated successfully.')
    }
    setUploadingAvatar(false)
  }

  const handleUsernameChange = (e) => {
    const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setNewUsername(cleaned)
    setUsernameError(null)

    if (usernameTimeout.current) clearTimeout(usernameTimeout.current)

    if (cleaned.length < 3) {
      setUsernameState(null)
      setUsernameSuggestions([])
      return
    }

    if (cleaned === profile?.username) {
      setUsernameState(null)
      return
    }

    setUsernameState('checking')
    usernameTimeout.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(cleaned)
      if (result.error) {
        setUsernameState('invalid')
        setUsernameSuggestions([])
      } else if (result.available) {
        setUsernameState('available')
        setUsernameSuggestions([])
      } else {
        setUsernameState('taken')
        setUsernameSuggestions(result.suggestions || [])
      }
    }, 500)
  }

  const handleSaveUsername = async () => {
    if (!newUsername || usernameState !== 'available') return

    setSavingUsername(true)
    setUsernameError(null)

    const data = new FormData()
    data.append('username', newUsername)

    const result = await changeUsername(data)

    if (result.error) {
      setUsernameError(result.error)
    } else {
      setProfile(prev => ({ ...prev, username: newUsername }))
      setShowUsernameChange(false)
      setNewUsername('')
      setUsernameState(null)
      setSuccess('Username updated successfully.')
    }
    setSavingUsername(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid #e5e5e5',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    background: '#fff',
    color: '#0a0a0a',
    transition: 'border-color 0.15s',
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F5F5F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <p style={{ color: '#A3A3A3', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Top nav */}
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #0a0a0a',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Link href="/settings" style={{
          textDecoration: 'none',
          color: '#0a0a0a',
          fontSize: '14px',
          fontWeight: '600',
        }}>
          ← Back
        </Link>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Edit Profile</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>

        {success && (
          <div style={{
            background: '#F0FDF4',
            border: '1.5px solid #22C55E',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#22C55E',
          }}>
            {success}
          </div>
        )}

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

        {/* Avatar section */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Profile picture</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={profile?.avatar_url} name={profile?.display_name} size={72} />
              {uploadingAvatar && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: '#fff',
                  fontWeight: '700',
                }}>
                  ...
                </div>
              )}
            </div>
            <div>
              <button
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                style={{
                  padding: '9px 18px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '2px 2px 0 #FFB800',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                {uploadingAvatar ? 'Uploading...' : 'Change photo'}
              </button>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>JPEG, PNG, WebP or GIF. Max 5MB.</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Profile info */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Profile info</h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '6px' }}>
                Display name
              </label>
              <input
                name="display_name"
                type="text"
                value={formData.display_name}
                onChange={handleChange}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                onBlur={e => e.target.style.borderColor = '#e5e5e5'}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0a0a0a', display: 'block', marginBottom: '6px' }}>
                Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell people a little about yourself..."
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: '1.5',
                }}
                onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                onBlur={e => e.target.style.borderColor = '#e5e5e5'}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px',
                background: saving ? '#525252' : '#0a0a0a',
                color: '#fff',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: saving ? 'none' : '3px 3px 0 #FFB800',
              }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Username section */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Username</h2>
          <p style={{ fontSize: '13px', color: '#A3A3A3', marginBottom: '16px' }}>
            Current: @{profile?.username} · Can be changed once every 30 days
          </p>

          {!showUsernameChange ? (
            <button
              onClick={() => setShowUsernameChange(true)}
              style={{
                padding: '9px 18px',
                background: '#fff',
                color: '#0a0a0a',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Change username
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {usernameError && (
                <p style={{ fontSize: '12px', color: '#EF4444' }}>{usernameError}</p>
              )}
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
                  type="text"
                  value={newUsername}
                  onChange={handleUsernameChange}
                  placeholder={profile?.username}
                  style={{ ...inputStyle, paddingLeft: '28px' }}
                  onFocus={e => e.target.style.borderColor = '#0a0a0a'}
                  onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              {usernameState === 'checking' && (
                <p style={{ fontSize: '12px', color: '#A3A3A3' }}>Checking availability...</p>
              )}
              {usernameState === 'available' && (
                <p style={{ fontSize: '12px', color: '#22C55E' }}>✓ Username available</p>
              )}
              {usernameState === 'taken' && (
                <div>
                  <p style={{ fontSize: '12px', color: '#EF4444' }}>✗ Username taken</p>
                  {usernameSuggestions.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {usernameSuggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setNewUsername(s)
                            setUsernameState('available')
                            setUsernameSuggestions([])
                          }}
                          style={{
                            padding: '4px 10px',
                            border: '1.5px solid #0a0a0a',
                            borderRadius: '100px',
                            fontSize: '12px',
                            background: '#fff',
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSaveUsername}
                  disabled={savingUsername || usernameState !== 'available'}
                  style={{
                    padding: '9px 18px',
                    background: usernameState === 'available' ? '#0a0a0a' : '#525252',
                    color: '#fff',
                    border: '1.5px solid #0a0a0a',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: usernameState === 'available' ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                    boxShadow: usernameState === 'available' ? '2px 2px 0 #FFB800' : 'none',
                  }}
                >
                  {savingUsername ? 'Saving...' : 'Save username'}
                </button>
                <button
                  onClick={() => {
                    setShowUsernameChange(false)
                    setNewUsername('')
                    setUsernameState(null)
                    setUsernameError(null)
                  }}
                  style={{
                    padding: '9px 18px',
                    background: '#fff',
                    color: '#525252',
                    border: '1.5px solid #e5e5e5',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* View public profile link */}
        <div style={{ textAlign: 'center' }}>
          <Link
            href={`/u/${profile?.username}`}
            style={{
              fontSize: '13px',
              color: '#525252',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            View your public profile →
          </Link>
        </div>
      </div>
    </div>
  )
}