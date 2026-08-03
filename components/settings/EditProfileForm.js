'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import { updateProfile, uploadAvatar, changeUsername } from '@/actions/users'
import { checkUsernameAvailable } from '@/actions/auth'
import { useProfileSheet } from '@/lib/profile-sheet-context'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

export default function EditProfileForm({ initialProfile }) {
  const { openProfile } = useProfileSheet()
  const [profile, setProfile] = useState(initialProfile)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    display_name: initialProfile?.display_name || '',
    bio: initialProfile?.bio || '',
    website: initialProfile?.website || '',
    twitter: initialProfile?.twitter || '',
    instagram: initialProfile?.instagram || '',
    linkedin: initialProfile?.linkedin || '',
  })

  // Username change state
  const [showUsernameChange, setShowUsernameChange] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameState, setUsernameState] = useState(null)
  const [usernameSuggestions, setUsernameSuggestions] = useState([])
  const [usernameError, setUsernameError] = useState(null)
  const [savingUsername, setSavingUsername] = useState(false)
  const usernameTimeout = useRef(null)
  const fileInputRef = useRef(null)

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
    data.append('website', formData.website)
    data.append('twitter', formData.twitter)
    data.append('instagram', formData.instagram)
    data.append('linkedin', formData.linkedin)

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

  // Shown once a field is within 20% of its max length, so it stays out
  // of the way until it's actually relevant.
  const CharCount = ({ value, max }) => {
    if (value.length < max * 0.8) return null
    return (
      <p style={{
        fontSize: '11px',
        color: value.length >= max ? 'var(--error)' : 'var(--text-tertiary)',
        textAlign: 'right',
        marginTop: '4px',
      }}>
        {value.length}/{max}
      </p>
    )
  }

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-md)',
    marginBottom: '20px',
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-subtle)',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border-strong)',
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div className="relay-page-header-row" style={{ gap: '6px' }}>
          <Link
            href="/settings"
            aria-label="Back"
            className="relay-plain-icon-btn"
            style={{ width: '34px', height: '34px', marginLeft: '-8px', flexShrink: 0 }}
          >
            <ChevronLeft size={22} {...iconProps} />
          </Link>
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Edit profile</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>

        {success && (
          <div style={{
            background: 'var(--success-light)',
            border: '1.5px solid var(--success)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--success)',
          }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{
            background: 'var(--error-light)',
            border: '1.5px solid var(--error)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--error)',
          }}>
            {error}
          </div>
        )}

        {/* Avatar section */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '16px' }}>Profile picture</h2>
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
                className="relay-btn relay-btn--filled"
                style={{ boxShadow: 'var(--shadow-hard-accent)', display: 'block', marginBottom: '8px' }}
              >
                {uploadingAvatar ? 'Uploading...' : 'Change photo'}
              </button>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>JPEG, PNG, WebP or GIF. Max 5MB.</p>
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
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '16px' }}>Profile info</h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                Display name
              </label>
              <input
                name="display_name"
                type="text"
                value={formData.display_name}
                onChange={handleChange}
                maxLength={50}
                className="relay-input"
                style={{ width: '100%', padding: '12px 14px', fontSize: '16px', boxSizing: 'border-box' }}
              />
              <CharCount value={formData.display_name} max={50} />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '6px' }}>
                Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell people a little about yourself..."
                rows={3}
                maxLength={160}
                className="relay-input"
                style={{ width: '100%', padding: '12px 14px', fontSize: '16px', resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box' }}
              />
              <CharCount value={formData.bio} max={160} />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)', display: 'block', marginBottom: '10px' }}>
                Social links
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <input
                    name="website"
                    type="text"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://yoursite.com"
                    maxLength={100}
                    className="relay-input"
                    style={{ width: '100%', padding: '12px 14px', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                  <CharCount value={formData.website} max={100} />
                </div>
                <div>
                  <input
                    name="twitter"
                    type="text"
                    value={formData.twitter}
                    onChange={handleChange}
                    placeholder="@username (Twitter/X)"
                    maxLength={100}
                    className="relay-input"
                    style={{ width: '100%', padding: '12px 14px', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                  <CharCount value={formData.twitter} max={100} />
                </div>
                <div>
                  <input
                    name="instagram"
                    type="text"
                    value={formData.instagram}
                    onChange={handleChange}
                    placeholder="@username (Instagram)"
                    maxLength={100}
                    className="relay-input"
                    style={{ width: '100%', padding: '12px 14px', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                  <CharCount value={formData.instagram} max={100} />
                </div>
                <div>
                  <input
                    name="linkedin"
                    type="text"
                    value={formData.linkedin}
                    onChange={handleChange}
                    placeholder="linkedin.com/in/username"
                    maxLength={100}
                    className="relay-input"
                    style={{ width: '100%', padding: '12px 14px', fontSize: '16px', boxSizing: 'border-box' }}
                  />
                  <CharCount value={formData.linkedin} max={100} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="relay-btn relay-btn--filled"
              style={{ padding: '12px', boxShadow: 'var(--shadow-hard-accent)' }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Username section */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>Username</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            Current: @{profile?.username} · Can be changed once every 30 days
          </p>

          {!showUsernameChange ? (
            <button
              onClick={() => setShowUsernameChange(true)}
              className="relay-btn"
            >
              Change username
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {usernameError && (
                <p style={{ fontSize: '12px', color: 'var(--error)' }}>{usernameError}</p>
              )}
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
                  type="text"
                  value={newUsername}
                  onChange={handleUsernameChange}
                  placeholder={profile?.username}
                  maxLength={20}
                  className="relay-input"
                  style={{ width: '100%', padding: '12px 14px', paddingLeft: '28px', fontSize: '16px', boxSizing: 'border-box' }}
                />
              </div>
              <CharCount value={newUsername} max={20} />

              {usernameState === 'checking' && (
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Checking availability...</p>
              )}
              {usernameState === 'available' && (
                <p style={{ fontSize: '12px', color: 'var(--success)' }}>✓ Username available</p>
              )}
              {usernameState === 'taken' && (
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--error)' }}>✗ Username taken</p>
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSaveUsername}
                  disabled={savingUsername || usernameState !== 'available'}
                  className="relay-btn relay-btn--filled"
                  style={{ boxShadow: usernameState === 'available' ? 'var(--shadow-hard-accent)' : 'none' }}
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
                  className="relay-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Email — read-only. Changing it needs its own verification flow
            (Supabase requires confirming the new address before it takes
            effect) which isn't built yet; this at least surfaces which
            account is actually linked, which wasn't visible anywhere
            before — easy to lose track of for a Google sign-in in
            particular, where the email is never manually typed. */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>Email</h2>
          <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>
            {profile?.email}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Contact support to change the email on your account.
          </p>
        </div>

        {/* View public profile link */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => openProfile(profile?.username)}
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none',
              fontWeight: '500',
              fontFamily: 'inherit',
            }}
          >
            View your public profile →
          </button>
        </div>
      </div>
    </div>
  )
}
