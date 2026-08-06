'use server'

import { createClient } from '@/lib/supabase/server'

export async function signUpWithEmail(formData) {
  const display_name = formData.get('display_name')
  const username = formData.get('username')
  const email = formData.get('email')
  const password = formData.get('password')

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function signInWithEmail(formData) {
  const email = formData.get('email')
  const password = formData.get('password')

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()

  // supabase-js defaults signOut() to { scope: 'global' } when no options
  // are passed — silently signing out every device, not just this one.
  // Must be explicit to get "this session only" behavior.
  const { error } = await supabase.auth.signOut({ scope: 'local' })

  if (error) {
    return { error: error.message }
  }
}

export async function signOutAllSessions() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut({ scope: 'global' })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

// What the account screen needs to render itself correctly. A Google
// sign-in has no password at all, so that case has to offer "set a
// password" rather than "change" it — asking for a current password the
// account has never had would be an unpassable gate.
export async function getAccountInfo() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const providers = (user.identities || []).map(i => i.provider)

  return {
    data: {
      email: user.email,
      // Supabase records a separate identity per provider; the 'email'
      // one is what a password actually belongs to.
      hasPassword: providers.includes('email'),
      providers,
      newEmailPending: user.new_email || null,
    },
  }
}

// Changing a password while signed in is deliberately NOT the same thing
// as the reset-link flow below. That flow proves identity via the emailed
// link, so it never asks for the old password. Here the session is already
// open — which is exactly the case where a borrowed/unlocked device could
// otherwise be used to lock the real owner out — so the current password
// is required and verified first.
export async function changePassword(formData) {
  const currentPassword = formData.get('current_password')
  const newPassword = formData.get('new_password')

  if (!newPassword || newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const providers = (user.identities || []).map(i => i.provider)
  const hasPassword = providers.includes('email')

  if (hasPassword) {
    if (!currentPassword) return { error: 'Enter your current password' }

    // Supabase exposes no "verify this password" call, so re-authenticating
    // is the supported way to prove it. Same user and same session, so this
    // refreshes the existing session rather than displacing it.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (reauthError) return { error: 'Current password is incorrect' }

    if (currentPassword === newPassword) {
      return { error: 'New password must be different from your current one' }
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) return { error: error.message }

  return { success: true, wasSet: !hasPassword }
}

// Supabase does not swap the address on request — it emails a confirmation
// link and only applies the change once that link is followed, so this
// reports "check your inbox" rather than "done". public.users.email is
// synced separately once the confirmation lands (see the auth callback
// route), since it can't be updated before the change actually takes.
export async function changeEmail(formData) {
  const newEmail = (formData.get('new_email') || '').trim().toLowerCase()
  const currentPassword = formData.get('current_password')

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { error: 'Enter a valid email address' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  if (newEmail === user.email?.toLowerCase()) {
    return { error: 'That is already your email address' }
  }

  const providers = (user.identities || []).map(i => i.provider)

  // Password holders re-authenticate first, for the same reason as above:
  // an open session alone shouldn't be enough to move the address that
  // controls account recovery.
  if (providers.includes('email')) {
    if (!currentPassword) return { error: 'Enter your password to confirm' }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (reauthError) return { error: 'Password is incorrect' }
  }

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=/settings` }
  )

  if (error) return { error: error.message }

  return { success: true, pendingEmail: newEmail }
}

export async function resetPasswordRequest(formData) {
  const email = formData.get('email')

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/reset-password',
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function resetPassword(formData) {
  const password = formData.get('password')

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback',
      // Without this, Google silently re-authenticates with whichever
      // account the browser already has an active session for instead
      // of showing the account chooser — fine for a returning user, but
      // means there's no way to deliberately pick a different Google
      // account without first signing out of Google itself.
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { url: data.url }
}

export async function checkUsernameAvailable(username) {
  const usernameRegex = /^[a-z0-9_]{3,20}$/

  if (
    !usernameRegex.test(username) ||
    username.startsWith('_') ||
    username.endsWith('_')
  ) {
    return { available: false, error: 'Invalid username format' }
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('users')
    .select('username')
    .eq('username', username)
    .maybeSingle()

  if (data) {
    const suggestions = [
      `${username}_${Math.floor(Math.random() * 90 + 10)}`,
      `${username}_${Math.floor(Math.random() * 9000 + 1000)}`,
      `${username}_${Math.floor(Math.random() * 9 + 1)}`,
    ]

    return { available: false, suggestions }
  }

  return { available: true }
}

export async function checkEmailExists(email) {
  const supabase = await createClient()

  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (data) {
    return { exists: true }
  }

  return { exists: false }
}
