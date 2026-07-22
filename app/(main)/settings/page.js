import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getOwnProfile } from '@/actions/users'
import Avatar from '@/components/shared/Avatar'

export default async function SettingsPage() {
  const result = await getOwnProfile()
  const profile = result.data

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
        <Link href="/chat" style={{
          textDecoration: 'none',
          color: '#0a0a0a',
          fontSize: '14px',
          fontWeight: '600',
        }}>
          ← Back
        </Link>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>Settings</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Profile card */}
        <Link href="/settings/profile" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#fff',
            border: '1.5px solid #0a0a0a',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '4px 4px 0 #0a0a0a',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
          }}>
            <Avatar src={profile?.avatar_url} name={profile?.display_name} size={56} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '16px', fontWeight: '800', color: '#0a0a0a', marginBottom: '2px' }}>
                {profile?.display_name}
              </p>
              <p style={{ fontSize: '13px', color: '#A3A3A3' }}>@{profile?.username}</p>
            </div>
            <span style={{ color: '#A3A3A3', fontSize: '16px' }}>→</span>
          </div>
        </Link>

        {/* Settings sections */}
        {[
          {
            title: 'Account',
            items: [
              { label: 'Edit profile', href: '/settings/profile' },
              { label: 'Privacy settings', href: '/settings/privacy' },
            ]
          },
          {
            title: 'Session',
            items: [
              { label: 'Active sessions', href: '/settings/sessions' },
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
              color: '#A3A3A3',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              paddingLeft: '4px',
            }}>
              {section.title}
            </p>
            <div style={{
              background: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '4px 4px 0 #0a0a0a',
            }}>
              {section.items.map((item, i) => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: i < section.items.length - 1 ? '1px solid #F5F5F5' : 'none',
                    cursor: 'pointer',
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: item.danger ? '#EF4444' : '#0a0a0a',
                    }}>
                      {item.label}
                    </span>
                    <span style={{ color: '#A3A3A3', fontSize: '14px' }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}