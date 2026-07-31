import { createBrowserClient } from '@supabase/ssr'

// Memoized so every 'use client' component sharing this module gets the
// SAME client instance instead of each effect spinning up its own realtime
// socket. Without this, a channel's .subscribe() could win the race against
// that particular fresh instance's session hydration from cookies, connect
// to Realtime as anon, and silently never receive another RLS-protected
// event for the rest of its life — a real, confirmed failure mode, not a
// hypothetical one (verified directly against the project's live
// realtime.subscription table). This file is only ever imported by client
// components, so the module-level singleton lives for the lifetime of the
// browser tab, same as the rest of the client-side app state.
let _client = null

export function createClient() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  return _client
}
