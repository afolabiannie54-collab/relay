'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { updatePrivacySettings } from '@/actions/users'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Notification preferences (push subscription + per-category toggles).
// These fields live in the same privacy_settings row as PrivacySettingsForm
// — split into its own page so "who can message me" and "what notifies me"
// aren't crammed into one screen.
export default function NotificationSettingsForm({ initialSettings, userId }) {
  const [settings, setSettings] = useState(initialSettings)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications(userId)

  const handleToggle = async (key) => {
    const updatedSettings = { ...settings, [key]: !settings[key] }
    setSettings(updatedSettings)

    const data = new FormData()
    Object.entries(updatedSettings).forEach(([k, value]) => {
      data.append(k, String(value))
    })
    const result = await updatePrivacySettings(data)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Saved')
      setTimeout(() => setSuccess(null), 1500)
    }
  }

  const Toggle = ({ value, onChange }) => (
    <div
      onClick={onChange}
      style={{
        width: '44px',
        height: '24px',
        background: value ? 'var(--border-strong)' : 'var(--border)',
        borderRadius: 'var(--radius-pill)',
        border: '1.5px solid var(--border-strong)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '2px',
        left: value ? '22px' : '2px',
        width: '16px',
        height: '16px',
        background: value ? 'var(--accent)' : 'var(--surface)',
        borderRadius: '50%',
        border: '1px solid var(--border-strong)',
        transition: 'left 0.2s, background 0.2s',
      }} />
    </div>
  )

  const SettingRow = ({ label, children }) => (
    <div style={{
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      borderBottom: '1px solid var(--border-light)',
    }}>
      <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{label}</p>
      {children}
    </div>
  )

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
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Notifications</span>
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
            Settings saved successfully.
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

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          marginBottom: '20px',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>Push notifications</p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              {permission === 'denied'
                ? 'Notifications blocked. Enable them in your browser settings.'
                : subscribed
                ? 'Push notifications are enabled on this device.'
                : 'Get notified about messages and mentions even when the app is closed.'}
            </p>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {permission === 'denied' ? (
              <p style={{ fontSize: '13px', color: 'var(--error)' }}>
                Go to browser settings → Site settings → Notifications → Allow relaymsg.vercel.app
              </p>
            ) : subscribed ? (
              <button
                onClick={unsubscribe}
                disabled={pushLoading}
                style={{
                  padding: '8px 16px',
                  background: 'var(--surface)',
                  color: 'var(--error)',
                  border: '1.5px solid var(--error)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: pushLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: pushLoading ? 0.6 : 1,
                }}
              >
                {pushLoading ? 'Disabling...' : 'Disable on this device'}
              </button>
            ) : (
              <button
                onClick={subscribe}
                disabled={pushLoading}
                className="relay-btn relay-btn--filled"
                style={{ boxShadow: 'var(--shadow-hard-accent)' }}
              >
                {pushLoading ? 'Enabling...' : 'Enable on this device'}
              </button>
            )}
          </div>
        </div>

        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          color: 'var(--text-tertiary)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}>Notify me about</p>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          marginBottom: '20px',
        }}>
          <SettingRow label="Direct messages">
            <Toggle
              value={settings?.message_notifications}
              onChange={() => handleToggle('message_notifications')}
            />
          </SettingRow>
          <SettingRow label="Group messages">
            <Toggle
              value={settings?.group_notifications}
              onChange={() => handleToggle('group_notifications')}
            />
          </SettingRow>
          <SettingRow label="Mentions">
            <Toggle
              value={settings?.mention_notifications}
              onChange={() => handleToggle('mention_notifications')}
            />
          </SettingRow>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Reactions</p>
            <Toggle
              value={settings?.reaction_notifications}
              onChange={() => handleToggle('reaction_notifications')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
