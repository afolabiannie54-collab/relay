import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Hit two ways from presence-context.js: via navigator.sendBeacon() on
// the beforeunload/hidden exit paths (sendBeacon can't attach an
// Authorization header, but it does send cookies on same-origin requests,
// so this reads the session from cookies — the normal SSR client — rather
// than trusting a client-supplied user id, which would let anyone mark
// any user "offline" on request), and via a plain fetch() from a
// recurring heartbeat while the tab is open and visible. Both just record
// "this user was here as of now" — the name is a holdover from when only
// the exit path existed.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  await supabase
    .from('users')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}
