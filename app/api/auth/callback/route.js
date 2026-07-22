import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/chat'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile?.username) {
          return NextResponse.redirect(`${origin}/setup-username`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}