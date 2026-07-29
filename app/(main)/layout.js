'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import { getOwnProfile } from '@/actions/users'
import { PresenceProvider } from '@/lib/presence-context'
import { getUnreadChatsCount } from '@/actions/messages'
import { createClient } from '@/lib/supabase/client'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { signOut } from '@/actions/auth'

export default function MainLayout({ children }) {
  const pathname = usePathname()
  const [profile, setProfile] = useState(null)
  const [unreadChatsCount, setUnreadChatsCount] = useState(0)

  usePushNotifications(profile?.id)

  useEffect(() => {
    async function load() {
      const result = await getOwnProfile()
      if (result.data) setProfile(result.data)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadChatsUnread() {
      const result = await getUnreadChatsCount()
      setUnreadChatsCount(result.count || 0)
    }
    loadChatsUnread()

    // Deterministic same-tab signal: fires the instant a conversation is
    // marked read, without depending on Realtime being enabled for
    // conversation_participants (this layout persists across /chat <->
    // /chat/[id] navigations, so it never remounts to pick up fresh data).
    window.addEventListener('relay:conversation-read', loadChatsUnread)

    if (!profile?.id) {
      return () => window.removeEventListener('relay:conversation-read', loadChatsUnread)
    }

    const supabase = createClient()

    const channel = supabase
      .channel('unread-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => {
        loadChatsUnread()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${profile.id}`,
      }, () => {
        loadChatsUnread()
      })
      .subscribe()

    return () => {
      window.removeEventListener('relay:conversation-read', loadChatsUnread)
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const navItems = [
    { href: '/chat', label: 'Chats', icon: '💬', badge: unreadChatsCount },
    { href: '/search', label: 'Search', icon: '🔍' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const isActive = (href) => {
    if (href === '/chat') return pathname === '/chat' || pathname.startsWith('/chat/')
    return pathname.startsWith(href)
  }

  // Matches /chat/<uuid> and /chat/<uuid>/settings — i.e. any page that's
  // "inside" a conversation on mobile, where the two-panel chat shell is
  // already showing its own back button and the bottom tab bar would just
  // be redundant chrome eating into the conversation view.
  const isConversationPage = /^\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(pathname)

  return (
    <PresenceProvider userId={profile?.id}>
    <div style={{
      display: 'flex',
      height: '100dvh',
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
        height: '100dvh',
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
                  flex: 1,
                }}>
                  {item.label}
                </span>
                {item.badge > 0 && (
                  <div style={{
                    minWidth: '18px',
                    height: '18px',
                    background: '#FFB800',
                    border: '1.5px solid #0a0a0a',
                    borderRadius: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '0 4px',
                  }}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </div>
                )}
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
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#A3A3A3',
              fontFamily: 'inherit',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: '1px solid #E5E5E5',
              marginTop: '4px',
              paddingTop: '12px',
            }}
          >
            Sign out
          </button>
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
          overflowX: 'hidden',
        }}>
          {children}
        </div>

        {/* Mobile bottom nav */}
        <div
          className={isConversationPage ? 'mobile-nav hide-mobile-nav' : 'mobile-nav'}
          style={{
            display: 'none',
            borderTop: '1.5px solid #0a0a0a',
            background: '#fff',
            padding: '8px 0',
          }}
        >
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px',
                minHeight: '44px',
                minWidth: '44px',
                position: 'relative',
              }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: '20px' }}>{item.icon}</span>
                  {item.badge > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      minWidth: '14px',
                      height: '14px',
                      background: '#FFB800',
                      border: '1px solid #0a0a0a',
                      borderRadius: '100px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      fontWeight: '800',
                      padding: '0 3px',
                    }}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}
                </div>
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
          .mobile-nav.hide-mobile-nav { display: none !important; }
        }
      `}</style>
    </div>
    </PresenceProvider>
  )
}
