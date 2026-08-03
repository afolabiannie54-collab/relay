'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Check, Bell, MessageSquare, Users, AtSign, Mail, UserPlus, Heart,
} from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications'
import NotionDoodle from '@/components/shared/illustrations/NotionDoodle'

const BELL_PATH = "M1.24781 20.2525C0.799006 19.3618 1.06081 18.3969 1.24781 18.0258C2.1828 16.3558 4.15781 12.1821 4.6138 8.56227C5.24492 3.55218 8.54079 2.9955 11.9068 2.9955C15.2728 2.9955 18.0778 4.66553 18.6388 8.00559C19.1998 11.3457 20.3216 16.1925 22.1692 18.0258C23.3564 19.2038 23.2131 20.226 22.1089 21.0099M1.24781 20.2525L22.3463 20.399C22.5417 20.4004 22.6585 20.1892 22.5338 20.0387C22.4241 19.9063 22.3021 19.78 22.1692 19.6596M1.24781 20.2525C1.35243 20.4601 1.69121 20.7259 2.23502 21.0099M1.24781 20.2525C1.38625 20.0808 1.5849 19.8773 1.84235 19.6596M10.2238 1.88214C10.4108 1.32547 11.9068 0.211855 13.0288 1.88214M2.23502 21.0099H22.1089M2.23502 21.0099C2.58096 21.1907 3.00987 21.3788 3.51425 21.5642M22.1089 21.0099C21.826 21.2108 21.5061 21.396 21.1687 21.5642M18.6388 22.4792C19.3915 22.2925 20.3337 21.9804 21.1687 21.5642M18.6388 22.4792C13.5376 23.3725 9.07844 22.9916 5.94805 22.2737M18.6388 22.4792L5.94805 22.2737M21.1687 21.5642H3.51425M3.51425 21.5642C4.1944 21.8141 5.01179 22.059 5.94805 22.2737M22.1692 19.6596H1.84235M22.1692 19.6596C21.8811 19.3987 21.5423 19.1654 21.1687 18.9575M1.84235 19.6596C2.04077 19.4919 2.27412 19.3158 2.54174 19.1393M2.54174 19.1393L11.4236 19.162M2.54174 19.1393C3.03652 18.8131 3.64845 18.4858 4.3734 18.2084M11.4236 19.162C12.2797 19.2774 13.2049 19.0561 14.0799 18.2084M11.4236 19.162C10.6327 19.0554 9.90068 18.6614 9.32161 18.2084M21.1687 18.9575H13.0286M21.1687 18.9575C20.6282 18.6567 20.0151 18.4093 19.3784 18.2084M14.0799 18.2084C14.268 18.0263 14.4537 17.8152 14.6359 17.5723C14.6842 17.508 14.7591 17.4689 14.8395 17.47C15.9577 17.4849 17.7457 17.6934 19.3784 18.2084M14.0799 18.2084H19.3784M9.32161 18.2084C9.04962 17.9957 8.81137 17.7699 8.61658 17.5548C8.56782 17.5009 8.49889 17.469 8.42625 17.4696C6.82603 17.4836 5.47033 17.7888 4.3734 18.2084M9.32161 18.2084H4.3734"

const iconProps = { strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' }

const NOTIFICATION_ICONS = {
  message: MessageSquare,
  group_message: Users,
  mention: AtSign,
  message_request: Mail,
  group_invite: UserPlus,
  reaction: Heart,
}

export default function NotificationList({ initialNotifications }) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const router = useRouter()

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markNotificationRead(notification.id)
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, read: true } : n
      ))
    }

    if (notification.reference_id) {
      switch (notification.type) {
        case 'message':
        case 'group_message':
        case 'mention':
        case 'reaction':
          router.push(`/chat/${notification.reference_id}`)
          break
        case 'message_request':
          // The only producer of this type is acceptMessageRequest(),
          // which sets reference_id to the resulting conversation — a
          // "someone wants to message you" notification is push-only
          // today and never lands in this in-app feed, so this is
          // always the "your request was accepted" case.
          router.push(`/chat/${notification.reference_id}`)
          break
        case 'group_invite':
          router.push('/requests')
          break
        default:
          break
      }
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 16px', borderBottom: '2px solid var(--border-strong)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <button
              onClick={() => router.push('/chat')}
              aria-label="Back"
              className="relay-plain-icon-btn"
              style={{ width: '34px', height: '34px', marginLeft: '-8px', flexShrink: 0 }}
            >
              <ChevronLeft size={22} {...iconProps} />
            </button>
            <h1 className="relay-page-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Notifications</h1>
            {unreadCount > 0 && (
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="relay-btn" style={{ flexShrink: 0 }}>
              <Check size={15} {...iconProps} /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '16px' }}>
              <NotionDoodle d={BELL_PATH} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.01em' }}>No notifications</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              You&apos;re all caught up.
            </p>
          </div>
        ) : (
          notifications.map(notification => {
            const NotifIcon = NOTIFICATION_ICONS[notification.type] || Bell
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px 20px 14px 17px',
                  borderLeft: '3px solid transparent',
                  borderBottom: '1px solid var(--border-light)',
                  cursor: 'pointer',
                  background: notification.read ? 'var(--surface)' : 'var(--accent-light)',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = notification.read ? 'var(--surface-hover)' : 'var(--accent-wash-strong)'
                  e.currentTarget.style.borderLeftColor = 'var(--accent)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = notification.read ? 'var(--surface)' : 'var(--accent-light)'
                  e.currentTarget.style.borderLeftColor = 'transparent'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: notification.read ? 'var(--gray-100)' : 'var(--accent)',
                  border: '2px solid var(--border-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: notification.read ? 'var(--text-secondary)' : 'var(--foreground)',
                  flexShrink: 0,
                }}>
                  <NotifIcon size={17} {...iconProps} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: notification.read ? '500' : '700',
                    color: 'var(--text)',
                    marginBottom: '2px',
                  }}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {notification.body}
                    </p>
                  )}
                  <p style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    marginTop: '4px',
                  }}>
                    {formatTime(notification.created_at)}
                  </p>
                </div>
                {!notification.read && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    border: '1.5px solid var(--border-strong)',
                    flexShrink: 0,
                    marginTop: '6px',
                  }} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
