import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <PageShell
      title="Không gian đội nhóm"
      description="Tạo team, mời thành viên và theo dõi các vòng đánh giá trong một workspace thống nhất."
      eyebrow="Team console"
      homeHref="/"
      actions={
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Đăng xuất
          </Button>
        </form>
      }
    >
      <div className="animate-fade-up">{children}</div>
    </PageShell>
  )
}
