'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePresence(userId) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const channel = supabase.channel('presence:tracking', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    // Update last_seen on disconnect
    const handleBeforeUnload = async () => {
      await channel.untrack()
      const supabase = createClient()
      await supabase
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      supabase.removeChannel(channel)
    }
  }, [userId])
}

export function useOnlineUsers() {
  const channelRef = useRef(null)

  const getOnlineUsers = (channel) => {
    const state = channel.presenceState()
    return Object.keys(state)
  }

  return { channelRef, getOnlineUsers }
}