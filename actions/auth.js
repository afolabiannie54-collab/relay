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
    return { error }
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
    return { error }
  }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error }
  }
}

export async function resetPasswordRequest(formData) {
  const email = formData.get('email')

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/reset-password',
  })

  if (error) {
    return { error }
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
    return { error }
  }

  return { success: true }
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/api/auth/callback',
    },
  })

  if (error) {
    return { error }
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
