'use client'

import { useState, useEffect } from 'react'
import BottomSheet from '@/components/shared/BottomSheet'
import Skeleton from '@/components/shared/Skeleton'
import { getPrivacySettings, updatePrivacySettings } from '@/actions/users'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { createClient } from '@/lib/supabase/client'

// Notification preferences (push subscription + per-category toggles).
// These fields live in the same privacy_settings row as the Privacy page
// — split out so "who can message me" and "what notifies me" aren't
// crammed into one screen. Lives in a sheet (not its own route) since it's
// just two small toggle groups plus a push-permission button.
export default function NotificationSettingsSheet({ isOpen, onClose }) {
  const [userId, setUserId] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications(userId)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null);
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
      const result = await getPrivacySettings()
      setSettings(result.data || null)
      setLoading(false)
    })()
  }, [isOpen])

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

  const handlePushSubscribe = async () => {
    setError(null)
    const result = await subscribe()
    if (result?.error) setError(result.error)
  }

  const handlePushUnsubscribe = async () => {
    setError(null)
    const result = await unsubscribe()
    if (result?.error) setError(result.error)
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

  const ToggleRowSkeleton = ({ last }) => (
    <div style={{
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      borderBottom: last ? 'none' : '1px solid var(--border-light)',
    }}>
      <Skeleton width="120px" height="14px" />
      <Skeleton width="44px" height="24px" borderRadius="var(--radius-pill)" />
    </div>
  )

  const SettingRow = ({ label, children, last }) => (
    <div style={{
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      borderBottom: last ? 'none' : '1px solid var(--border-light)',
    }}>
      <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{label}</p>
      {children}
    </div>
  )

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Notifications">
      <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", padding: '4px 20px 20px' }}>
        {loading ? (
          <>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              marginBottom: '16px',
              padding: '14px 20px',
            }}>
              <Skeleton width="140px" height="14px" style={{ marginBottom: '8px' }} />
              <Skeleton width="220px" height="12px" />
            </div>
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              <ToggleRowSkeleton />
              <ToggleRowSkeleton />
              <ToggleRowSkeleton />
              <ToggleRowSkeleton last />
            </div>
          </>
        ) : (
          <>
            {success && (
              <div style={{
                background: 'var(--success-light)',
                border: '1.5px solid var(--success)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: 'var(--success)',
              }}>
                Settings saved.
              </div>
            )}

            {error && (
              <div style={{
                background: 'var(--error-light)',
                border: '1.5px solid var(--error)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: 'var(--error)',
              }}>
                {error}
              </div>
            )}

            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              marginBottom: '16px',
            }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)' }}>
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>Push notifications</p>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  {permission === 'denied'
                    ? 'Notifications blocked. Enable them in your browser settings.'
                    : subscribed
                    ? 'Push notifications are enabled on this device.'
                    : 'Get notified about messages and mentions even when the app is closed.'}
                </p>
              </div>
              <div style={{ padding: '14px 20px' }}>
                {permission === 'denied' ? (
                  <p style={{ fontSize: '13px', color: 'var(--error)' }}>
                    Go to browser settings → Site settings → Notifications → Allow relaymsg.vercel.app
                  </p>
                ) : subscribed ? (
                  <button
                    onClick={handlePushUnsubscribe}
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
                    onClick={handlePushSubscribe}
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
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
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
              <SettingRow label="Reactions" last>
                <Toggle
                  value={settings?.reaction_notifications}
                  onChange={() => handleToggle('reaction_notifications')}
                />
              </SettingRow>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
