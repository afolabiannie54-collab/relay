'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getPrivacySettings, updatePrivacySettings } from '@/actions/users'

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const result = await getPrivacySettings()
      if (result.data) setSettings(result.data)
      setLoading(false)
    }
    load()
  }, [])

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelect = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    const data = new FormData()
    Object.entries(settings).forEach(([key, value]) => {
      data.append(key, String(value))
    })

    const result = await updatePrivacySettings(data)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
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
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Privacy & Notifications</span>
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
                fontSize: '13px',
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

        {/* Notifications */}
        <p style={{
          fontSize: '11px',
          fontWeight: '700',
          color: '#A3A3A3',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: '8px',
          paddingLeft: '4px',
        }}>Notifications</p>

        <div style={{
          background: '#fff',
          border: '1.5px solid #0a0a0a',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '4px 4px 0 #0a0a0a',
          marginBottom: '20px',
        }}>
          <SettingRow label="Push notifications" description="Receive notifications when app is closed">
            <Toggle
              value={settings?.push_notifications_enabled}
              onChange={() => handleToggle('push_notifications_enabled')}
            />
          </SettingRow>
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

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
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
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}