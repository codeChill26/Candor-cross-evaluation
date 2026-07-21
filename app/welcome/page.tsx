import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DisplayNameForm } from '@/components/auth/display-name-form'

// Shown right after login when the account has no display name yet. Users who
// already have one never see it (bounced to /teams).
export default async function WelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.full_name?.trim()) redirect('/teams')

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Chào mừng đến với Candor</CardTitle>
          <CardDescription>Đặt tên hiển thị để mọi người trong team nhận ra bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          <DisplayNameForm />
        </CardContent>
      </Card>
    </div>
  )
}
