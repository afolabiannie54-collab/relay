'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updatePrivacySettings } from '@/actions/users'
import { usePushNotifications } from '@/hooks/usePushNotifications'

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
        background: value ? '#0a0a0a' : '#E5E5E5',
        borderRadius: '100px',
        border: '1.5px solid #0a0a0a',
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
        background: value ? '#FFB800' : '#fff',
        borderRadius: '50%',
        border: '1px solid #0a0a0a',
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
      borderBottom: '1px solid #F5F5F5',
    }}>
      <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>{label}</p>
      {children}
    </div>
  )

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#F5F5F5',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
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
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Notifications</span>
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
            Settings saved successfully.
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

        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5F5F5' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Push notifications</p>
            <p style={{ fontSize: '13px', color: '#A3A3A3' }}>
              {permission === 'denied'
                ? 'Notifications blocked. Enable them in your browser settings.'
                : subscribed
                ? 'Push notifications are enabled on this device.'
                : 'Get notified about messages and mentions even when the app is closed.'}
            </p>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {permission === 'denied' ? (
              <p style={{ fontSize: '13px', color: '#EF4444' }}>
                Go to browser settings → Site settings → Notifications → Allow relaymsg.vercel.app
              </p>
            ) : subscribed ? (
              <button
                onClick={unsubscribe}
                disabled={pushLoading}
                style={{
                  padding: '9px 18px',
                  background: '#fff',
                  color: '#EF4444',
                  border: '1.5px solid #EF4444',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {pushLoading ? 'Disabling...' : 'Disable on this device'}
              </button>
            ) : (
              <button
                onClick={subscribe}
                disabled={pushLoading}
                style={{
                  padding: '9px 18px',
                  background: '#0a0a0a',
                  color: '#fff',
                  border: '1.5px solid #0a0a0a',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '2px 2px 0 #FFB800',
                }}
              >
                {pushLoading ? 'Enabling...' : 'Enable on this device'}
              </button>
            )}
          </div>
        </div>

        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          color: '#A3A3A3',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}>Notify me about</p>

        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '4px 4px 0 #0a0a0a',
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
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a' }}>Reactions</p>
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
