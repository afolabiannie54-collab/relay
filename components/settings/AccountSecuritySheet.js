'use client'

import { useState, useEffect } from 'react'
import { KeyRound, Mail, ChevronRight, ChevronLeft } from 'lucide-react'
import BottomSheet from '@/components/shared/BottomSheet'
import Skeleton from '@/components/shared/Skeleton'
import { getAccountInfo, changePassword, changeEmail } from '@/actions/auth'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '16px',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '13px',
  fontWeight: '700',
  color: 'var(--text)',
  display: 'block',
  marginBottom: '6px',
}

function Banner({ tone, children }) {
  const isError = tone === 'error'
  return (
    <div style={{
      background: isError ? 'var(--error-light)' : 'var(--success-light)',
      border: `1.5px solid ${isError ? 'var(--error)' : 'var(--success)'}`,
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
      marginBottom: '14px',
      fontSize: '13px',
      color: isError ? 'var(--error)' : 'var(--success)',
      lineHeight: 1.45,
    }}>
      {children}
    </div>
  )
}

// Credential management for a signed-in user. Deliberately separate from
// the reset-password route: that one proves identity through an emailed
// link and so never asks for the old password, whereas here the session is
// already open, which is exactly when a borrowed device could otherwise be
// used to take the account over. Both actions re-authenticate server-side.
//
// A Google-only account has no password to confirm against, so it gets
// "Set a password" (no current-password field) and can change its email
// without one — there is nothing to verify, and blocking on a password
// that has never existed would make both actions unreachable.
export default function AccountSecuritySheet({ isOpen, onClose }) {
  const [view, setView] = useState('menu')
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setView('menu')
    setLoading(true)
    setError(null)
    setSuccess(null)
    getAccountInfo().then(result => {
      if (result.data) setAccount(result.data)
      setLoading(false)
    })
  }, [isOpen])

  const resetFields = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setNewEmail('')
    setError(null)
    setSuccess(null)
  }

  const go = (next) => {
    resetFields()
    setView(next)
  }

  const hasPassword = account?.hasPassword

  const handleSavePassword = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Checked here as well as server-side so the mismatch is caught before
    // spending a round-trip on it.
    if (newPassword !== confirmPassword) {
      setError('The two passwords don\'t match')
      return
    }

    setSaving(true)
    const data = new FormData()
    data.append('current_password', currentPassword)
    data.append('new_password', newPassword)
    const result = await changePassword(data)
    setSaving(false)

    if (result.error) { setError(result.error); return }

    resetFields()
    setSuccess(result.wasSet
      ? 'Password set. You can now sign in with your email and password as well as with Google.'
      : 'Password updated.')
    setView('menu')
  }

  const handleSaveEmail = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    const data = new FormData()
    data.append('new_email', newEmail)
    data.append('current_password', currentPassword)
    const result = await changeEmail(data)
    setSaving(false)

    if (result.error) { setError(result.error); return }

    const pending = result.pendingEmail
    resetFields()
    // Not "changed" — Supabase only applies it once the emailed link is
    // followed, so saying it's done would be a lie the user discovers later
    // when their old address still signs them in.
    setSuccess(`Almost there — we sent a confirmation link to ${pending}. Your email changes once you open it.`)
    setView('menu')
  }

  const title = view === 'password'
    ? (hasPassword ? 'Change password' : 'Set a password')
    : view === 'email' ? 'Change email' : 'Password & email'

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", padding: '4px 20px 20px' }}>
        {loading ? (
          <div style={{ padding: '8px 0' }}>
            <Skeleton width="100%" height="52px" borderRadius="var(--radius-md)" style={{ marginBottom: '10px' }} />
            <Skeleton width="100%" height="52px" borderRadius="var(--radius-md)" />
          </div>
        ) : view === 'menu' ? (
          <>
            {success && <Banner tone="success">{success}</Banner>}

            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => go('password')}
                className="relay-menu-row"
                style={{ width: '100%', padding: '16px 18px', borderRadius: 0, borderBottom: '1px solid var(--border-light)' }}
              >
                <KeyRound size={17} {...iconProps} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                  {hasPassword ? 'Change password' : 'Set a password'}
                </span>
                <ChevronRight size={16} strokeWidth={2.25} color="var(--text-tertiary)" />
              </button>

              <button
                onClick={() => go('email')}
                className="relay-menu-row"
                style={{ width: '100%', padding: '16px 18px', borderRadius: 0 }}
              >
                <Mail size={17} {...iconProps} />
                <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Change email</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {account?.email}
                  </span>
                </span>
                <ChevronRight size={16} strokeWidth={2.25} color="var(--text-tertiary)" />
              </button>
            </div>

            {account?.newEmailPending && (
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.5 }}>
                A change to <strong style={{ color: 'var(--text-secondary)' }}>{account.newEmailPending}</strong> is
                waiting on confirmation. Until you open that link, your current email still signs you in.
              </p>
            )}

            {!hasPassword && (
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.5 }}>
                You signed in with Google. Setting a password lets you sign in either way.
              </p>
            )}
          </>
        ) : view === 'password' ? (
          <form onSubmit={handleSavePassword}>
            <button
              type="button"
              onClick={() => go('menu')}
              className="relay-menu-row"
              style={{ padding: '6px 0', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}
            >
              <ChevronLeft size={16} {...iconProps} /> Back
            </button>

            {error && <Banner tone="error">{error}</Banner>}

            {hasPassword && (
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="relay-input"
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="relay-input"
                style={inputStyle}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '5px' }}>At least 8 characters.</p>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="relay-input"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={saving || !newPassword || !confirmPassword || (hasPassword && !currentPassword)}
              className="relay-btn relay-btn--filled"
              style={{ width: '100%', padding: '12px', boxShadow: 'var(--shadow-hard-accent)' }}
            >
              {saving ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSaveEmail}>
            <button
              type="button"
              onClick={() => go('menu')}
              className="relay-menu-row"
              style={{ padding: '6px 0', marginBottom: '10px', color: 'var(--text-secondary)', fontSize: '13px' }}
            >
              <ChevronLeft size={16} {...iconProps} /> Back
            </button>

            {error && <Banner tone="error">{error}</Banner>}

            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '14px', lineHeight: 1.5 }}>
              Currently <strong style={{ color: 'var(--text-secondary)' }}>{account?.email}</strong>. We&apos;ll send a
              confirmation link to the new address — the change only takes effect once you open it.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>New email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                autoComplete="email"
                className="relay-input"
                style={inputStyle}
              />
            </div>

            {hasPassword && (
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Your password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="relay-input"
                  style={inputStyle}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !newEmail || (hasPassword && !currentPassword)}
              className="relay-btn relay-btn--filled"
              style={{ width: '100%', padding: '12px', boxShadow: 'var(--shadow-hard-accent)' }}
            >
              {saving ? 'Sending…' : 'Send confirmation link'}
            </button>
          </form>
        )}
      </div>
    </BottomSheet>
  )
}
