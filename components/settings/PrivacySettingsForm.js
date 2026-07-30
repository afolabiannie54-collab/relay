'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updatePrivacySettings } from '@/actions/users'

// Notification preferences (push subscription + per-category toggles) live
// on their own page now — see components/settings/NotificationSettingsForm.js
// — this form is scoped to privacy only: who can message you, and what
// others can see about you.
export default function PrivacySettingsForm({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const handleAutoSave = async (updatedSettings) => {
    const data = new FormData()
    Object.entries(updatedSettings).forEach(([key, value]) => {
      data.append(key, String(value))
    })
    const result = await updatePrivacySettings(data)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Saved')
      setTimeout(() => setSuccess(null), 1500)
    }
  }

  const handleToggle = async (key) => {
    const updatedSettings = { ...settings, [key]: !settings[key] }
    setSettings(updatedSettings)
    await handleAutoSave(updatedSettings)
  }

  const handleSelect = async (key, value) => {
    const updatedSettings = { ...settings, [key]: value }
    setSettings(updatedSettings)
    await handleAutoSave(updatedSettings)
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

  const SettingRow = ({ label, description, children }) => (
    <div style={{
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      borderBottom: '1px solid #F5F5F5',
    }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '2px' }}>{label}</p>
        {description && <p style={{ fontSize: '12px', color: '#A3A3A3' }}>{description}</p>}
      </div>
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
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Privacy</span>
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

        {/* Privacy */}
        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          color: '#A3A3A3',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}>Privacy</p>

        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          <SettingRow
            label="Who can message me"
            description="Control who can send you message requests"
          >
            <select
              value={settings?.who_can_message}
              onChange={e => handleSelect('who_can_message', e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1.5px solid #0a0a0a',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'inherit',
                background: '#fff',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="everyone">Everyone</option>
              <option value="nobody">Nobody</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Show online status"
            description="Let others see when you're active"
          >
            <Toggle
              value={settings?.show_online_status}
              onChange={() => handleToggle('show_online_status')}
            />
          </SettingRow>

          <SettingRow
            label="Show last seen"
            description="Let others see when you were last active"
          >
            <Toggle
              value={settings?.show_last_seen}
              onChange={() => handleToggle('show_last_seen')}
            />
          </SettingRow>

          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#0a0a0a', marginBottom: '2px' }}>Discoverable</p>
              <p style={{ fontSize: '12px', color: '#A3A3A3' }}>Allow others to find you in search</p>
            </div>
            <Toggle
              value={settings?.discoverable}
              onChange={() => handleToggle('discoverable')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
