'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle, Search, Settings, Zap } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import { getOwnProfile } from '@/actions/users'
import { PresenceProvider } from '@/lib/presence-context'
import { getUnreadChatsCount } from '@/actions/messages'
import { createClient } from '@/lib/supabase/client'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { cache } from '@/lib/cache'

export default function MainLayout({ children }) {
  const pathname = usePathname()
  // Lazy-initialized from cache so a cached profile is already in place
  // on the very first render — this is the app shell, mounted before any
  // conversation page, so priming this shared cache key here is what
  // lets chat/[id]/page.js's own header/message-ownership rendering
  // avoid its own first-paint flash on a warm session.
  const [profile, setProfile] = useState(() => cache.peek('profile'))
  const [unreadChatsCount, setUnreadChatsCount] = useState(0)
  const [bulkSelectActive, setBulkSelectActive] = useState(false)

  usePushNotifications(profile?.id)

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
    // Mirrors ChatList.js's own same-tab signal — fired by whoever just
    // deleted/left a group themselves, so this badge stays in sync with
    // the chat list even when Realtime's conversation_participants DELETE
    // event never reaches them (see ChatList.js for why).
    window.addEventListener('relay:conversations-changed', loadChatsUnread)

    if (!profile?.id) {
      return () => {
        window.removeEventListener('relay:conversation-read', loadChatsUnread)
        window.removeEventListener('relay:conversations-changed', loadChatsUnread)
      }
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
      // Mirrors ChatList.js's own listeners — being added to or removed
      // from a conversation (new group, added to an existing group, the
      // owner deleting a group) changes how many conversations have
      // unread messages, so this badge needs to react to the same two
      // events ChatList already refreshes the list on, not just new
      // messages and read-state changes.
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${profile.id}`,
      }, () => {
        loadChatsUnread()
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${profile.id}`,
      }, () => {
        loadChatsUnread()
      })
      // Other participants' conversation_participants DELETE event above
      // often never arrives at all — Realtime's authorization check for
      // delivering it re-queries a table the same deletion just emptied.
      // A DB trigger inserts this notification as a reliable fallback
      // (see ChatList.js's identical listener).
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        if (payload.new.type === 'group_removed') loadChatsUnread()
      })
      .subscribe()

    return () => {
      window.removeEventListener('relay:conversation-read', loadChatsUnread)
      window.removeEventListener('relay:conversations-changed', loadChatsUnread)
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  // ChatList (several layers down: this layout -> chat/layout.js's shell
  // -> ChatList) dispatches this whenever bulk-select mode toggles, so
  // the bottom tab bar can hide in favor of the bulk-action bar — same
  // WhatsApp-style behavior as swapping the tab bar for a contextual
  // action bar, rather than showing both stacked on top of each other.
  useEffect(() => {
    const handleBulkSelect = (e) => setBulkSelectActive(!!e.detail?.active)
    window.addEventListener('relay:bulk-select-mode', handleBulkSelect)
    return () => window.removeEventListener('relay:bulk-select-mode', handleBulkSelect)
  }, [])

  const navItems = [
    { href: '/chat', label: 'Chats', icon: MessageCircle, badge: unreadChatsCount },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

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
      background: 'var(--bg-subtle)',
    }}>
      {/* Desktop sidebar */}
      <div style={{
        width: '260px',
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
        className="desktop-sidebar"
      >
        {/* Logo */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'var(--accent)',
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Zap size={17} strokeWidth={2.5} fill="var(--foreground)" color="var(--foreground)" />
          </div>
          <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.02em' }}>Relay</span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '2px',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--accent-light)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon size={18} strokeWidth={active ? 2.5 : 2.25} color={active ? 'var(--accent-text)' : 'var(--text-secondary)'} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: active ? '700' : '500',
                    color: active ? 'var(--text)' : 'var(--text-secondary)',
                    flex: 1,
                  }}>
                    {item.label}
                  </span>
                  {item.badge > 0 && (
                    <div style={{
                      minWidth: '18px',
                      height: '18px',
                      background: 'var(--accent)',
                      borderRadius: 'var(--radius-pill)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: '800',
                      color: 'var(--foreground)',
                      padding: '0 4px',
                    }}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Profile at bottom — sign out lives in Settings > Security now */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--border-light)',
        }}>
          <Link href="/settings/profile" style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar src={profile?.avatar_url} name={profile?.display_name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {profile?.display_name}
                </p>
                <p style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
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
          overflowX: 'hidden',
        }}>
          {children}
        </div>

        {/* Mobile bottom nav */}
        <div
          className={(isConversationPage || bulkSelectActive) ? 'mobile-nav hide-mobile-nav' : 'mobile-nav'}
          style={{
            display: 'none',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '6px 0',
          }}
        >
          {navItems.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  padding: '6px',
                  minHeight: '44px',
                  minWidth: '44px',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'relative',
                    width: '34px',
                    height: '26px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? 'var(--accent-light)' : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                    <Icon size={19} strokeWidth={active ? 2.5 : 2.25} color={active ? 'var(--accent-text)' : 'var(--text-tertiary)'} />
                    {item.badge > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-2px',
                        minWidth: '15px',
                        height: '15px',
                        background: 'var(--accent)',
                        border: '2px solid var(--surface)',
                        borderRadius: 'var(--radius-pill)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        fontWeight: '800',
                        color: 'var(--foreground)',
                        padding: '0 3px',
                      }}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: active ? '700' : '500',
                    color: active ? 'var(--text)' : 'var(--text-tertiary)',
                  }}>
                    {item.label}
                  </span>
                </div>
              </Link>
            )
          })}
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
