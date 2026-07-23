import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/marketing/landing-page'
import { siteUrl, siteName, siteDescription } from '@/lib/site'

// Structured data so search engines (and AI answer engines) can classify what
// Candor is, in Vietnamese, and show it as a free web app.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: siteName,
  url: siteUrl,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'vi',
  description: siteDescription,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
}

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Logged-in visitors are no longer bounced to /teams — they can browse the
  // landing page, and the header shows their account menu instead of the
  // sign-in buttons. Anonymous (quick-round guest) sessions don't count as an
  // account, so they still see the normal marketing header.
  let account: { name: string; email: string } | null = null
  if (user && !user.is_anonymous) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    account = {
      name: profile?.full_name?.trim() || user.email || 'Tài khoản',
      email: user.email ?? '',
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage account={account} />
    </>
  )
}
