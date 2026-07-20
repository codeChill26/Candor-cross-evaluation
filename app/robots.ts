import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth-gated / per-user areas: nothing indexable there, crawlers just get
      // bounced to /login. /rounds stays crawlable so /rounds/new (the public
      // "quick eval" entry point) can be indexed.
      disallow: ['/teams/', '/join/', '/auth/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
