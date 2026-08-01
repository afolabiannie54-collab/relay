import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Hit via navigator.sendBeacon() from presence-context.js's beforeunload
// handler — sendBeacon can't attach an Authorization header, but it does
// send cookies on same-origin requests, so this reads the session from
// cookies (the normal SSR client) rather than trusting a client-supplied
// user id, which would let anyone mark any user "offline" on request.
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
