'use server'

import { createClient } from '@/lib/supabase/server'

export async function getActiveSessions() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('get_my_sessions')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function revokeSession(sessionId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase.rpc('revoke_my_session', {
    p_session_id: sessionId,
  })

  if (error) return { error: error.message }
  return data
}
