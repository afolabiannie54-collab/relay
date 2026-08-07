'use server'

import { createClient } from '@/lib/supabase/server'
import { sanitizeText } from '@/lib/utils/sanitize'
import { isBlocked } from '@/actions/blocks'

export async function getOwnProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function getProfileByUsername(username) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('users')
    .select(`
      id, username, display_name, avatar_url, bio, last_seen, created_at,
      website, twitter, instagram, linkedin,
      privacy_settings(show_last_seen, show_online_status)
    `)
    .eq('username', username)
    .single()

  if (error) return { error: 'User not found' }

  // Same "User not found" a nonexistent username gets — a blocked
  // profile should be indistinguishable from one that doesn't exist,
  // not a distinct "you're blocked" message that would reveal the block.
  if (user && user.id !== data.id) {
    const { blocked } = await isBlocked(data.id)
    if (blocked) return { error: 'User not found' }
  }

  const showLastSeen = data.privacy_settings?.show_last_seen ?? true

  return {
    data: {
      ...data,
      // Withheld outright when hidden rather than shipped with a flag —
      // otherwise the raw timestamp is readable straight off the network
      // response regardless of the setting. Same fix as getConversation.
      last_seen: showLastSeen ? data.last_seen : null,
      show_last_seen: showLastSeen,
      show_online_status: data.privacy_settings?.show_online_status ?? true,
    },
  }
}

export async function updateProfile(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const display_name = sanitizeText(formData.get('display_name'), 50)
  const bio = sanitizeText(formData.get('bio'), 160)
  const website = sanitizeText(formData.get('website'), 100)
  const twitter = sanitizeText(formData.get('twitter'), 100)
  const instagram = sanitizeText(formData.get('instagram'), 100)
  const linkedin = sanitizeText(formData.get('linkedin'), 100)

  if (!display_name) return { error: 'Display name is required' }

  const { error } = await supabase
    .from('users')
    .update({
      display_name,
      bio: bio || null,
      website: website || null,
      twitter: twitter || null,
      instagram: instagram || null,
      linkedin: linkedin || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function uploadAvatar(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const file = formData.get('avatar')

  if (!file) return { error: 'No file provided' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Only images are allowed (JPEG, PNG, WebP, GIF)' }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Image must be under 5MB' }
  }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('users')
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) return { error: updateError.message }

  return { success: true, url: publicUrl }
}

export async function changeUsername(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const username = formData.get('username')

  if (!username?.trim()) return { error: 'Username is required' }

  const usernameRegex = /^[a-z0-9_]{3,20}$/
  if (!usernameRegex.test(username) || username.startsWith('_') || username.endsWith('_')) {
    return { error: 'Invalid username format' }
  }

  // Check 30 day cooldown
  const { data: profile } = await supabase
    .from('users')
    .select('last_username_change')
    .eq('id', user.id)
    .single()

  if (profile?.last_username_change) {
    const lastChange = new Date(profile.last_username_change)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    if (lastChange > thirtyDaysAgo) {
      const nextChange = new Date(lastChange)
      nextChange.setDate(nextChange.getDate() + 30)
      return {
        error: `You can change your username again on ${nextChange.toLocaleDateString()}`
      }
    }
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existing) return { error: 'Username is already taken' }

  const { error } = await supabase
    .from('users')
    .update({
      username,
      last_username_change: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function searchUsers(query) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  if (!query || query.trim().length < 3) {
    return { error: 'Search query must be at least 3 characters' }
  }

  const { data: blocks } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

  const blockedIds = blocks?.map(b =>
    b.blocker_id === user.id ? b.blocked_id : b.blocker_id
  ) || []

  let queryBuilder = supabase
    .from('users')
    .select(`
      id,
      username,
      display_name,
      avatar_url,
      privacy_settings(discoverable)
    `)
    .ilike('username', `%${query.trim()}%`)
    .neq('id', user.id)
    .limit(20)

  if (blockedIds.length > 0) {
    queryBuilder = queryBuilder.not('id', 'in', `(${blockedIds.join(',')})`)
  }

  const { data, error } = await queryBuilder

  if (error) return { error: error.message }

  // discoverable was being fetched but never actually enforced — every
  // match was returned regardless of this setting. A user with no
  // privacy_settings row at all (never visited Settings > Privacy) is
  // treated as discoverable by default, same fallback used everywhere
  // else in this file; only an explicit false excludes them.
  const filtered = (data || [])
    .filter(u => u.privacy_settings?.discoverable !== false)
    .map(({ privacy_settings, ...rest }) => rest)

  return { data: filtered }
}

export async function getPrivacySettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('privacy_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { error: error.message }

  // No row yet (never visited these settings) shouldn't error the page
  // out — same defaults used as fallbacks everywhere else this table's
  // columns are read.
  return {
    data: data || {
      who_can_message: 'everyone',
      show_online_status: true,
      show_last_seen: true,
      show_read_receipts: true,
      transcribe_voice_notes: true,
      discoverable: true,
      push_notifications_enabled: true,
      message_notifications: true,
      group_notifications: true,
      mention_notifications: true,
      reaction_notifications: true,
    },
  }
}

export async function updatePrivacySettings(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const updates = {
    who_can_message: formData.get('who_can_message'),
    show_online_status: formData.get('show_online_status') === 'true',
    show_last_seen: formData.get('show_last_seen') === 'true',
    show_read_receipts: formData.get('show_read_receipts') === 'true',
    transcribe_voice_notes: formData.get('transcribe_voice_notes') === 'true',
    discoverable: formData.get('discoverable') === 'true',
    push_notifications_enabled: formData.get('push_notifications_enabled') === 'true',
    message_notifications: formData.get('message_notifications') === 'true',
    group_notifications: formData.get('group_notifications') === 'true',
    mention_notifications: formData.get('mention_notifications') === 'true',
    reaction_notifications: formData.get('reaction_notifications') === 'true',
    updated_at: new Date().toISOString(),
  }

  // upsert, not update — nothing in this codebase ever inserts a
  // privacy_settings row, so a user who's never saved these settings
  // before has none yet. update() against a nonexistent row silently
  // affects zero rows (no error), so every toggle on this page could
  // report "Saved" while never actually persisting anything.
  //
  // privacy_settings has no INSERT policy for a user's own row (only
  // covers SELECT/UPDATE, presumably written assuming a row always
  // already exists via a signup trigger that doesn't actually exist in
  // this schema) — confirmed directly: switching to upsert surfaced
  // "new row violates row-level security policy for table
  // privacy_settings" for a user with no existing row. user.id above is
  // already verified via the real session, so only the write itself
  // needs to bypass RLS here — same pattern as deleteGroup/removeMember/
  // transferOwnership elsewhere in this app.
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error } = await serviceClient
    .from('privacy_settings')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  return { success: true }
}