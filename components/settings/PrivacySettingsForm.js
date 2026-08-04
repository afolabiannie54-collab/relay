'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { updatePrivacySettings } from '@/actions/users'

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

// Notification preferences (push subscription + per-category toggles) live
// in their own sheet now — see components/settings/NotificationSettingsSheet.js
// — this form is scoped to privacy only: who can message you, and what
// others can see about you.
export default function PrivacySettingsForm({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [savingKey, setSavingKey] = useState(null)

  const handleAutoSave = async (key, previousSettings, updatedSettings) => {
    setSavingKey(key)
    const data = new FormData()
    Object.entries(updatedSettings).forEach(([k, value]) => {
      data.append(k, String(value))
    })
    const result = await updatePrivacySettings(data)
    setSavingKey(null)
    if (result.error) {
      // The toggle/select already flipped optimistically before this
      // resolved — without reverting, a failed save would silently leave
      // the UI showing a value the server never actually saved.
      setSettings(previousSettings)
      setError(result.error)
    } else {
      setSuccess('Saved')
      setTimeout(() => setSuccess(null), 1500)
    }
  }

  const handleToggle = async (key) => {
    const previousSettings = settings
    const updatedSettings = { ...settings, [key]: !settings[key] }
    setSettings(updatedSettings)
    await handleAutoSave(key, previousSettings, updatedSettings)
  }

  const handleSelect = async (key, value) => {
    const previousSettings = settings
    const updatedSettings = { ...settings, [key]: value }
    setSettings(updatedSettings)
    await handleAutoSave(key, previousSettings, updatedSettings)
  }

  const Toggle = ({ value, onChange, saving }) => (
    <div
      onClick={saving ? undefined : onChange}
      style={{
        width: '44px',
        height: '24px',
        background: value ? 'var(--border-strong)' : 'var(--border)',
        borderRadius: 'var(--radius-pill)',
        border: '1.5px solid var(--border-strong)',
        cursor: saving ? 'default' : 'pointer',
        opacity: saving ? 0.6 : 1,
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

  const SettingRow = ({ label, description, children }) => (
    <div style={{
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      borderBottom: '1px solid var(--border-light)',
    }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>{label}</p>
        {description && <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{description}</p>}
      </div>
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
          <h1 className="relay-page-title">Privacy</h1>
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

        {/* Privacy */}
        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          color: 'var(--text-tertiary)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}>Privacy</p>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          marginBottom: '20px',
        }}>
          <SettingRow
            label="Who can message me"
            description="Control who can send you message requests"
          >
            <select
              value={settings?.who_can_message}
              onChange={e => handleSelect('who_can_message', e.target.value)}
              disabled={savingKey === 'who_can_message'}
              style={{
                padding: '6px 10px',
                border: '1.5px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '16px',
                fontFamily: 'inherit',
                background: 'var(--surface)',
                color: 'var(--text)',
                cursor: savingKey === 'who_can_message' ? 'default' : 'pointer',
                opacity: savingKey === 'who_can_message' ? 0.6 : 1,
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
              saving={savingKey === 'show_online_status'}
            />
          </SettingRow>

          <SettingRow
            label="Show last seen"
            description="Let others see when you were last active"
          >
            <Toggle
              value={settings?.show_last_seen}
              onChange={() => handleToggle('show_last_seen')}
              saving={savingKey === 'show_last_seen'}
            />
          </SettingRow>

          <SettingRow
            label="Read receipts"
            description="Turn off and you won't see read receipts either"
          >
            <Toggle
              value={settings?.show_read_receipts}
              onChange={() => handleToggle('show_read_receipts')}
              saving={savingKey === 'show_read_receipts'}
            />
          </SettingRow>

          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>Discoverable</p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Allow others to find you in search</p>
            </div>
            <Toggle
              value={settings?.discoverable}
              onChange={() => handleToggle('discoverable')}
              saving={savingKey === 'discoverable'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
