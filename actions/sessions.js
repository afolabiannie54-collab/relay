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

export async function storeSessionInfo(userAgent) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims?.session_id) {
    return { error: claimsError?.message || 'Could not determine session' }
  }

  const { error } = await supabase
    .from('user_sessions')
    .upsert({
      user_id: user.id,
      session_id: claimsData.claims.session_id,
      user_agent: userAgent,
    }, { onConflict: 'session_id' })

  if (error) return { error: error.message }
  return { success: true }
}
