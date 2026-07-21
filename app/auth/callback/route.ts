import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only allow same-site relative paths — reject absolute URLs and
  // protocol-relative `//evil.com` to prevent open redirects.
  const rawNext = searchParams.get('next') ?? '/teams'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/teams'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
