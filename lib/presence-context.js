'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PresenceContext = createContext(null)

export function PresenceProvider({ userId, children }) {
  const [onlineUsers, setOnlineUsers] = useState([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const channel = supabase.channel('presence:global', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineUsers(Object.keys(state))
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUsers(prev => [...new Set([...prev, key])])
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => prev.filter(id => id !== key))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    // beforeunload can't reliably await anything — the page can be gone
    // before an ordinary fetch/Supabase call finishes, which is why
    // last_seen was frequently stuck days stale for anyone who closed the
    // tab instead of using an in-app sign-out. sendBeacon is built
    // specifically to survive page unload; it can't carry an
    // Authorization header, so /api/presence/offline authenticates via
    // the session cookie sendBeacon does send, instead of trusting a
    // client-supplied user id.
    const handleBeforeUnload = () => {
      channel.untrack()
      navigator.sendBeacon('/api/presence/offline')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      supabase.removeChannel(channel)
    }
  }, [userId])

  return (
    <PresenceContext.Provider value={{ onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  )
}

export function useOnlineUsers() {
  const context = useContext(PresenceContext)
  if (!context) return { onlineUsers: [] }
  return context
}
