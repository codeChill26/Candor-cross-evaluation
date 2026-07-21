import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageShell } from '@/components/layout/page-shell'
import { UserMenu } from '@/components/layout/user-menu'

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Force a display name before entering the app — accounts created without one
  // (some OAuth cases) get sent to /welcome to pick one.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const displayName = profile?.full_name?.trim()
  if (!displayName) redirect('/welcome')

  return (
    <PageShell
      title="Không gian đội nhóm"
      description="Tạo team, mời thành viên và theo dõi các vòng đánh giá trong một workspace thống nhất."
      eyebrow="Team console"
      homeHref="/"
      actions={<UserMenu name={displayName} email={user.email ?? ''} />}
    >
      <div className="animate-fade-up">{children}</div>
    </PageShell>
  )
}
