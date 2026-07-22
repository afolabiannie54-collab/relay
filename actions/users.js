'use server'

import { createClient } from '@/lib/supabase/server'

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

  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, bio, last_seen, created_at')
    .eq('username', username)
    .single()

  if (error) return { error: 'User not found' }
  return { data }
}

export async function updateProfile(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const display_name = formData.get('display_name')
  const bio = formData.get('bio')

  if (!display_name?.trim()) return { error: 'Display name is required' }

  const { error } = await supabase
    .from('users')
    .update({
      display_name: display_name.trim(),
      bio: bio?.trim() || null,
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
  return { data }
}

export async function getPrivacySettings() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('privacy_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function updatePrivacySettings(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const updates = {
    who_can_message: formData.get('who_can_message'),
    show_online_status: formData.get('show_online_status') === 'true',
    show_last_seen: formData.get('show_last_seen') === 'true',
    discoverable: formData.get('discoverable') === 'true',
    push_notifications_enabled: formData.get('push_notifications_enabled') === 'true',
    message_notifications: formData.get('message_notifications') === 'true',
    group_notifications: formData.get('group_notifications') === 'true',
    mention_notifications: formData.get('mention_notifications') === 'true',
    reaction_notifications: formData.get('reaction_notifications') === 'true',
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('privacy_settings')
    .update(updates)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}