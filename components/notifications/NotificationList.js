'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Check, Bell, MessageSquare, Users, AtSign, Mail, UserPlus, Heart,
} from 'lucide-react'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications'

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
      <div style={{ padding: '14px 20px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <button
            onClick={() => router.push('/chat')}
            aria-label="Back"
            className="relay-plain-icon-btn"
            style={{ marginLeft: '-10px' }}
          >
            <ChevronLeft size={22} {...iconProps} />
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="relay-btn">
              <Check size={15} {...iconProps} /> Mark all read
            </button>
          )}
        </div>
        <h1 className="relay-page-title">Notifications</h1>
        {unreadCount > 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {unreadCount} unread
          </p>
        )}
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
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              <Bell size={24} {...iconProps} />
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
