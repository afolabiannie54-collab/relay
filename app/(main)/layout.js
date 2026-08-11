'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Search, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Avatar from '@/components/shared/Avatar'
import { getOwnProfile } from '@/actions/users'
import { PresenceProvider } from '@/lib/presence-context'
import { ProfileSheetProvider } from '@/lib/profile-sheet-context'
import ProfileSheet from '@/components/profile/ProfileSheet'
import { getUnreadChatsCount, markConversationDelivered } from '@/actions/messages'
import { createClient } from '@/lib/supabase/client'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { cache } from '@/lib/cache'
import { canHover } from '@/lib/hover'

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

    // Delivery ACK on app load, covering every conversation at once —
    // messages that arrived while the app was closed produced no realtime
    // INSERT to ack individually, so without this they'd stay on a single
    // tick for the sender until the recipient happened to open that
    // specific thread. Opening the app IS the delivery event; this records
    // it. Lives in the layout (always mounted) rather than the chat list
    // or a conversation, so it doesn't depend on which screen is showing.
    markConversationDelivered()

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
      }, (payload) => {
        loadChatsUnread()
        // This message reached this device — that's precisely what the
        // sender's double tick reports, so ack it right here rather than
        // waiting for the recipient to open that conversation (which
        // would conflate delivered with read).
        if (payload.new?.conversation_id && payload.new.sender_id !== profile.id) {
          markConversationDelivered(payload.new.conversation_id)
        }
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
    <ProfileSheetProvider>
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
            className="relay-icon-btn"
            style={{ width: '34px', height: '34px', border: 'none' }}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen size={20} {...iconProps} />
              : <PanelLeftClose size={20} {...iconProps} />}
          </button>
        </div>

        {/* Nav items — only three of them, so top-aligned left a lot of
            dead space above the profile card; centering the group in the
            available height reads as deliberate instead of sparse. */}
        <nav style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '14px 10px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {navItems.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} title={sidebarCollapsed ? item.label : undefined}>
                <div className="relay-nav-item" style={{
                  display: 'flex',
                  flexDirection: sidebarCollapsed ? 'column' : 'row',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: sidebarCollapsed ? '5px' : '12px',
                  padding: sidebarCollapsed ? '12px 0' : '16px 6px',
                  borderBottom: '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}
                >
                  {/* Not collapsed: the dot sits before the label, like a
                      bullet marking "you're here" in a list. Collapsed: no
                      room to the side, so it drops below the icon instead —
                      either way it's the only thing that changes with
                      state; icon/text color stay constant rather than
                      dimming inactive items, which read as muddy. The
                      bottom rule on each row is what grounds these as a
                      list rather than labels floating in open space, without
                      reintroducing the boxed-button look. */}
                  {!sidebarCollapsed && (
                    <span aria-hidden="true" style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: active ? 'var(--accent)' : 'transparent',
                      border: active ? '1.5px solid var(--border-strong)' : '1.5px solid transparent',
                    }} />
                  )}
                  <div className="relay-nav-icon" style={{ position: 'relative', display: 'inline-flex' }}>
                    <Icon size={22} {...iconProps} color="var(--text)" style={{ flexShrink: 0 }} />
                    {item.badge > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-7px',
                        right: '-9px',
                        minWidth: '17px',
                        height: '17px',
                        background: 'var(--accent)',
                        border: '1.5px solid var(--border-strong)',
                        borderRadius: 'var(--radius-pill)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--on-accent)',
                        fontSize: '9.5px',
                        fontWeight: '800',
                        padding: '0 3px',
                      }}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </div>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="relay-nav-label" style={{
                      fontSize: '12.5px',
                      fontWeight: '700',
                      color: 'var(--text)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      flex: 1,
                      whiteSpace: 'nowrap',
                    }}>
                      {item.label}
                    </span>
                  )}
                  {sidebarCollapsed && (
                    <span aria-hidden="true" style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: active ? 'var(--accent)' : 'transparent',
                      border: active ? '1.5px solid var(--border-strong)' : '1.5px solid transparent',
                    }} />
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
              onMouseEnter={e => { if (canHover()) e.currentTarget.style.background = 'var(--surface-hover)' }}
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
                <div className="relay-nav-item" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 4px',
                  minHeight: '48px',
                }}>
                  <div className="relay-nav-icon" style={{ position: 'relative' }}>
                    <Icon size={23} {...iconProps} color="var(--text)" />
                    {item.badge > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-7px',
                        right: '-9px',
                        minWidth: '17px',
                        height: '17px',
                        background: 'var(--accent)',
                        border: '1.5px solid var(--border-strong)',
                        borderRadius: 'var(--radius-pill)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--on-accent)',
                        fontSize: '9px',
                        fontWeight: '800',
                        padding: '0 3px',
                      }}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </div>
                    )}
                  </div>
                  <span className="relay-nav-label" style={{
                    fontSize: '9.5px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {item.label}
                  </span>
                  <span aria-hidden="true" style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: active ? 'var(--accent)' : 'transparent',
                    border: active ? '1.5px solid var(--border-strong)' : '1.5px solid transparent',
                    marginTop: '-1px',
                  }} />
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

        /* Hover feedback for nav items now that there's no button-box to
           darken — an underline on the label (like marking a line in a
           notebook) plus a small icon lift instead. Scoped to
           (hover: hover) so it's mouse/trackpad only — touch devices fire
           :hover on tap but never cleanly un-fire it, which was leaving
           the underline "stuck" on the mobile nav after a tap. */
        @media (hover: hover) and (pointer: fine) {
          .relay-nav-item:hover .relay-nav-label {
            text-decoration: underline;
            text-decoration-color: var(--accent);
            text-decoration-thickness: 2px;
            text-underline-offset: 3px;
          }
          .relay-nav-item:hover .relay-nav-icon svg {
            transform: translateY(-1px);
          }
        }
        .relay-nav-icon svg {
          transition: transform 0.12s ease;
        }
      `}</style>
    </div>
    <ProfileSheet />
    </ProfileSheetProvider>
    </PresenceProvider>
  )
}
