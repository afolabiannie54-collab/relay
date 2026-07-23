'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import { getOwnProfile } from '@/actions/users'

export default function MainLayout({ children }) {
  const pathname = usePathname()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function load() {
      const result = await getOwnProfile()
      if (result.data) setProfile(result.data)
    }
    load()
  }, [])

  const navItems = [
    { href: '/chat', label: 'Chats', icon: '💬' },
    { href: '/search', label: 'Search', icon: '🔍' },
    { href: '/requests', label: 'Requests', icon: '📨' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  const isActive = (href) => {
    if (href === '/chat') return pathname === '/chat' || pathname.startsWith('/chat/')
    return pathname.startsWith(href)
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F5F5F5',
    }}>
      {/* Desktop sidebar */}
      <div style={{
        width: '260px',
        flexShrink: 0,
        background: '#fff',
        borderRight: '1.5px solid #0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
        className="desktop-sidebar"
      >
        {/* Logo */}
        <div style={{
          padding: '20px',
          borderBottom: '1.5px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: '#FFB800',
            borderRadius: '8px',
            border: '1.5px solid #0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>⚡</div>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0a0a0a' }}>Relay</span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '2px',
                background: isActive(item.href) ? '#F5F5F5' : 'transparent',
                border: isActive(item.href) ? '1.5px solid #0a0a0a' : '1.5px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}>
                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: isActive(item.href) ? '700' : '500',
                  color: '#0a0a0a',
                }}>
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </nav>

        {/* Profile at bottom */}
        <div style={{
          padding: '16px',
          borderTop: '1.5px solid #E5E5E5',
        }}>
          <Link href="/settings/profile" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}>
              <Avatar src={profile?.avatar_url} name={profile?.display_name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#0a0a0a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {profile?.display_name}
                </p>
                <p style={{
                  fontSize: '11px',
                  color: '#A3A3A3',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  @{profile?.username}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
        }}>
          {children}
        </div>

        {/* Mobile bottom nav */}
        <div style={{
          display: 'none',
          borderTop: '1.5px solid #0a0a0a',
          background: '#fff',
          padding: '8px 0',
        }}
          className="mobile-nav"
        >
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '6px',
              }}>
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: isActive(item.href) ? '700' : '500',
                  color: isActive(item.href) ? '#0a0a0a' : '#A3A3A3',
                }}>
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </div>
  )
}