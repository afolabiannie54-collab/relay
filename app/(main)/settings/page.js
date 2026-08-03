'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getOwnProfile } from '@/actions/users'
import { signOut } from '@/actions/auth'
import Avatar from '@/components/shared/Avatar'
import SignOutAllRow from '@/components/settings/SignOutAllRow'
import ThemeToggle from '@/components/settings/ThemeToggle'
import { cache } from '@/lib/cache'

export default function SettingsPage() {
  const [profile, setProfile] = useState(() => cache.peek('profile'))

  useEffect(() => {
    async function load() {
      const result = await getOwnProfile()
      if (result.data) {
        setProfile(result.data)
        cache.set('profile', result.data, 300000)
      }
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  if (!profile) return null

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
        <div className="relay-page-header-row">
          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Settings</span>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Profile card */}
        <Link href="/settings/profile" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
          }}>
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={56} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', marginBottom: '2px' }}>
                {profile?.display_name}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>@{profile?.username}</p>
            </div>
            <ChevronRight size={17} strokeWidth={2.25} color="var(--text-tertiary)" />
          </div>
        </Link>

        {/* Appearance */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--text-tertiary)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            marginBottom: '8px',
            paddingLeft: '4px',
          }}>
            Appearance
          </p>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            padding: '16px 20px',
          }}>
            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '10px' }}>
              Theme
            </p>
            <ThemeToggle />
          </div>
        </div>

        {/* Settings sections */}
        {[
          {
            title: 'Account',
            items: [
              { label: 'Edit profile', href: '/settings/profile' },
              { label: 'Privacy settings', href: '/settings/privacy' },
              { label: 'Blocked users', href: '/settings/blocked' },
            ]
          },
          {
            title: 'Notifications',
            items: [
              { label: 'Notification preferences', href: '/settings/notifications' },
            ]
          },
          {
            title: 'Security',
            items: [
              { label: 'Active sessions', href: '/settings/sessions' },
              { label: 'Sign out', action: 'signOut' },
              { label: 'Sign out all devices', action: 'signOutAll' },
            ]
          },
          {
            title: 'Danger zone',
            items: [
              { label: 'Delete account', href: '/settings/delete-account', danger: true },
            ]
          }
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '20px' }}>
            <p style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--text-tertiary)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              paddingLeft: '4px',
            }}>
              {section.title}
            </p>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-md)',
            }}>
              {section.items.map((item, i) => (
                item.action === 'signOutAll' ? (
                  <SignOutAllRow key="signOutAll" isLast={i === section.items.length - 1} />
                ) : item.action === 'signOut' ? (
                  <div
                    key="signOut"
                    onClick={handleSignOut}
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: i < section.items.length - 1 ? '1px solid var(--border-light)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                      Sign out
                    </span>
                    <ChevronRight size={15} strokeWidth={2.25} color="var(--text-tertiary)" />
                  </div>
                ) : (
                  <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: i < section.items.length - 1 ? '1px solid var(--border-light)' : 'none',
                      cursor: 'pointer',
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: item.danger ? 'var(--error)' : 'var(--text)',
                      }}>
                        {item.label}
                      </span>
                      <ChevronRight size={15} strokeWidth={2.25} color="var(--text-tertiary)" />
                    </div>
                  </Link>
                )
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
