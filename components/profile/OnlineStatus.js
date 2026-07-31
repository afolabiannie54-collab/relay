'use client'

import { useOnlineUsers } from '@/lib/presence-context'

function formatLastSeen(lastSeen) {
  const date = new Date(lastSeen)
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

// Realtime presence needs PresenceProvider's context, which only exists
// on the client — kept as its own small component so the profile page
// itself can stay a server component for the initial data fetch.
export default function OnlineStatus({ userId, lastSeen, showLastSeen, showOnlineStatus }) {
  const { onlineUsers } = useOnlineUsers()
  const isOnline = onlineUsers.includes(userId)

  // showOnlineStatus gates the live "Online" indicator itself, not just
  // the last-seen fallback — previously this only respected showLastSeen,
  // so turning off "Show online status" in Settings > Privacy had no
  // effect on whether other people saw you online in real time.
  if (isOnline && showOnlineStatus) {
    return (
      <p style={{ fontSize: '13px', color: '#22C55E', fontWeight: '600' }}>
        ● Online
      </p>
    )
  }

  if (showLastSeen && lastSeen) {
    return (
      <p style={{ fontSize: '13px', color: '#A3A3A3' }}>
        Last seen {formatLastSeen(lastSeen)}
      </p>
    )
  }

  return null
}
