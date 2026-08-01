'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Search, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
  // Defaults to collapsed on both server and client render (matching the
  // WhatsApp-style icon rail this is modeled on) so there's no hydration
  // mismatch; a stored "expanded" preference is applied a tick later here
  // rather than read synchronously, since a brief width change on load is
  // far less jarring than the dark/light flash lib/theme.js guards against.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem('relay-sidebar-collapsed')
    if (stored === 'false') setSidebarCollapsed(false)
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      window.localStorage.setItem('relay-sidebar-collapsed', String(next))
      return next
    })
  }

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
    { href: '/chat', label: 'Chats', icon: MessageSquare, badge: unreadChatsCount },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  // Square terminals instead of lucide's default rounded caps/joins — at
  // the stroke widths this app uses, rounded ends read as thick and
  // "painted on" rather than drawn. Squared ends give a sharper, more
  // technical-pen line that fits the notebook/neo-brutalist direction
  // better. One shared object so every icon in the nav renders identically
  // rather than each call site guessing its own values.
  const iconProps = { strokeWidth: 1.75, strokeLinecap: 'square', strokeLinejoin: 'miter' }

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
      {/* Desktop sidebar — collapses to a WhatsApp-style icon rail by
          default; the toggle's choice is remembered per-browser. */}
      <div style={{
        width: sidebarCollapsed ? '76px' : '240px',
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '2px solid var(--border-strong)',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        transition: 'width 0.18s var(--ease-out)',
      }}
        className="desktop-sidebar"
      >
        {/* Collapse toggle — the logo mark was tried here but at 34px its
            detailed sketch linework just disappeared into noise, so it's
            been dropped rather than kept as dead weight. */}
        <div style={{
          padding: sidebarCollapsed ? '14px 12px' : '14px 16px',
          borderBottom: '2px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
        }}>
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="relay-icon-btn relay-icon-btn--neutral"
            style={{ width: '28px', height: '28px', border: 'none' }}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen size={16} {...iconProps} />
              : <PanelLeftClose size={16} {...iconProps} />}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} title={sidebarCollapsed ? item.label : undefined}>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: sidebarCollapsed ? '11px' : '11px 14px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '6px',
                  background: active ? 'var(--surface-active)' : 'var(--surface)',
                  border: active ? '2px solid var(--border-strong)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'border-color 0.12s ease, background 0.12s ease',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <Icon size={21} {...iconProps} color={active ? 'var(--text)' : 'var(--text-secondary)'} style={{ flexShrink: 0 }} />
                  {!sidebarCollapsed && (
                    <span style={{
                      fontSize: '14.5px',
                      fontWeight: active ? '800' : '500',
                      color: active ? 'var(--text)' : 'var(--text-secondary)',
                      flex: 1,
                      whiteSpace: 'nowrap',
                    }}>
                      {item.label}
                    </span>
                  )}
                  {item.badge > 0 && (
                    <div style={{
                      position: sidebarCollapsed ? 'absolute' : 'static',
                      top: sidebarCollapsed ? '2px' : undefined,
                      right: sidebarCollapsed ? '2px' : undefined,
                      minWidth: '19px',
                      height: '19px',
                      background: 'var(--accent)',
                      border: '2px solid var(--border-strong)',
                      borderRadius: 'var(--radius-pill)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: '800',
                      color: 'var(--foreground)',
                      padding: '0 4px',
                      flexShrink: 0,
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
          padding: sidebarCollapsed ? '12px' : '14px 12px',
          borderTop: '2px solid var(--border-strong)',
        }}>
          <Link href="/settings/profile" style={{ textDecoration: 'none' }} title={sidebarCollapsed ? profile?.display_name : undefined}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                gap: '10px',
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Avatar src={profile?.avatar_url} name={profile?.display_name} size={36} />
              {!sidebarCollapsed && (
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
              )}
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
            borderTop: '2px solid var(--border-strong)',
            background: 'var(--surface)',
            padding: '8px 10px',
            gap: '8px',
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
                  gap: '4px',
                  padding: '8px 4px',
                  minHeight: '48px',
                  borderRadius: 'var(--radius-sm)',
                  background: active ? 'var(--surface-active)' : 'transparent',
                  border: active ? '2px solid var(--border-strong)' : '2px solid transparent',
                  position: 'relative',
                  transition: 'border-color 0.12s ease, background 0.12s ease',
                }}>
                  <div style={{ position: 'relative' }}>
                    <Icon size={22} {...iconProps} color={active ? 'var(--text)' : 'var(--text-tertiary)'} />
                    {item.badge > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-8px',
                        minWidth: '16px',
                        height: '16px',
                        background: 'var(--accent)',
                        border: '2px solid var(--border-strong)',
                        borderRadius: 'var(--radius-pill)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8.5px',
                        fontWeight: '800',
                        color: 'var(--foreground)',
                        padding: '0 3px',
                      }}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: active ? '800' : '500',
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
