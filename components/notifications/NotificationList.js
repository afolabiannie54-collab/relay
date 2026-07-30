'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications'

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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'message': return '💬'
      case 'group_message': return '👥'
      case 'mention': return '@'
      case 'message_request': return '📨'
      case 'group_invite': return '👋'
      case 'reaction': return '❤️'
      default: return '🔔'
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
      <div style={{
        padding: '16px 20px',
        borderBottom: '1.5px solid #E5E5E5',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0a0a0a' }}>Notifications</h1>
          {unreadCount > 0 && (
            <p style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '2px' }}>
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              padding: '7px 14px',
              background: '#fff',
              border: '1.5px solid #0a0a0a',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Mark all read
          </button>
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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>No notifications</h2>
            <p style={{ fontSize: '14px', color: '#A3A3A3' }}>
              You're all caught up.
            </p>
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 20px',
                borderBottom: '1px solid #F5F5F5',
                cursor: 'pointer',
                background: notification.read ? '#fff' : '#FFFBEB',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = notification.read ? '#F9F9F9' : '#FFF8E1'}
              onMouseLeave={e => e.currentTarget.style.background = notification.read ? '#fff' : '#FFFBEB'}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: notification.read ? '#F5F5F5' : '#FFB800',
                border: '1.5px solid #0a0a0a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: notification.type === 'mention' ? '14px' : '18px',
                fontWeight: '800',
                flexShrink: 0,
              }}>
                {getNotificationIcon(notification.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '14px',
                  fontWeight: notification.read ? '500' : '700',
                  color: '#0a0a0a',
                  marginBottom: '2px',
                }}>
                  {notification.title}
                </p>
                {notification.body && (
                  <p style={{
                    fontSize: '13px',
                    color: '#525252',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {notification.body}
                  </p>
                )}
                <p style={{
                  fontSize: '11px',
                  color: '#A3A3A3',
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
                  background: '#FFB800',
                  border: '1.5px solid #0a0a0a',
                  flexShrink: 0,
                  marginTop: '6px',
                }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
