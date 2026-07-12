'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isInviteExpired } from '@/lib/utils/invite-token'

type AcceptInviteResult = { error: string } | { data: { teamId: string } }

export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Bạn cần đăng nhập trước' }
  }

  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin
    .from('team_invites')
    .select('id, team_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (inviteError || !invite) {
    return { error: 'Link mời không hợp lệ' }
  }
  if (invite.used_at) {
    return { error: 'Link mời này đã được sử dụng' }
  }
  if (isInviteExpired(invite.expires_at)) {
    return { error: 'Link mời đã hết hạn' }
  }

  const { error: joinError } = await admin
    .from('team_members')
    .insert({ team_id: invite.team_id, user_id: user.id, role: 'member' })

  if (joinError) {
    if (joinError.code === '23505') {
      // unique(team_id, user_id) — already a member, treat as success
      return { data: { teamId: invite.team_id } }
    }
    return { error: joinError.message }
  }

  await admin.from('team_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id)

  return { data: { teamId: invite.team_id } }
}
