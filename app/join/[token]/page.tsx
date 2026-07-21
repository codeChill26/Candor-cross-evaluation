import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isInviteExpired } from '@/lib/utils/invite-token'
import { AutoAcceptInvite } from '@/components/teams/auto-accept-invite'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('team_invites')
    .select('expires_at, used_at, teams(name)')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return <InvalidInvite message="Link mời không tồn tại." />
  }
  if (invite.used_at) {
    return <InvalidInvite message="Link mời này đã được sử dụng." />
  }
  if (isInviteExpired(invite.expires_at)) {
    return <InvalidInvite message="Link mời đã hết hạn." />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/join/${token}`)
  }

  // Cast: without generated Database types, supabase-js can't infer that
  // team_invites.team_id -> teams.id is many-to-one, so it types the
  // embedded `teams` as an array even though the FK guarantees one row.
  const teamName = (invite.teams as unknown as { name: string }).name

  return <AutoAcceptInvite teamName={teamName} token={token} />
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <Card className="mx-auto mt-24 max-w-sm">
      <CardHeader>
        <CardTitle>Không thể tham gia</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
