'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PresenceContext = createContext(null)

// How often the heartbeat below refreshes last_seen while the tab is open
// and visible. Also the worst-case staleness left behind if a session
// ends in a way that skips both exit paths entirely (e.g. the OS
// force-kills a backgrounded PWA without ever firing visibilitychange) —
// far better than the days-stale value that could accumulate when the
// only writes were on exit.
const HEARTBEAT_INTERVAL_MS = 60000

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

    // Recurring "still here" ping — the exit-path writes below only fire
    // if beforeunload or visibilitychange actually gets a chance to run,
    // which mobile PWAs skip more often than not (home-swipe, app-switch,
    // or the OS reclaiming a backgrounded tab all commonly kill the page
    // with no warning). Firing once immediately means last_seen catches
    // up right away on this visit even if the previous session's exit
    // write never landed, instead of waiting a full interval.
    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return
      fetch('/api/presence/offline', { method: 'POST' }).catch(() => {})
    }
    sendHeartbeat()
    const heartbeatId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

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

    // beforeunload is a desktop-tab-close event — it's well known not to
    // fire reliably (often not at all) when a mobile browser or PWA gets
    // backgrounded via home-swipe, app-switch, or the OS reclaiming it.
    // That left last_seen stuck at whatever the last actual desktop-style
    // close happened to be, sometimes days stale, for anyone mostly using
    // this on a phone. visibilitychange fires reliably in that case, so
    // it's a second, independent write — this only ever records the
    // timestamp (not channel.untrack()), since briefly backgrounding
    // isn't the same as actually leaving the online-presence set.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        navigator.sendBeacon('/api/presence/offline')
      } else {
        // Coming back from background — refresh right away rather than
        // waiting up to a full HEARTBEAT_INTERVAL_MS for the next tick.
        sendHeartbeat()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(heartbeatId)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
