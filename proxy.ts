import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // robots.txt / sitemap.xml / opengraph-image must stay OUT of the auth proxy:
  // they were being redirected to /login, so crawlers couldn't read the robots
  // file or sitemap and link previews had no image.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
