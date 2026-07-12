'use server'

import { createClient } from '@/lib/supabase/server'
import { inviteMemberSchema } from '@/lib/validations/team'
import { generateInviteToken, inviteExpiryTimestamp } from '@/lib/utils/invite-token'

type CreateInviteResult =
  | { error: string }
  | { data: { token: string; email: string | null } }

export async function createInvite(teamId: string, formData: FormData): Promise<CreateInviteResult> {
  const rawEmail = formData.get('email')
  const parsed = inviteMemberSchema.safeParse({
    email: rawEmail && rawEmail !== '' ? rawEmail : undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const token = generateInviteToken()

  const { data, error } = await supabase
    .from('team_invites')
    .insert({
      team_id: teamId,
      token,
      email: parsed.data.email ?? null,
      created_by: user.id,
      expires_at: inviteExpiryTimestamp(),
    })
    .select('token, email')
    .single()

  if (error) {
    return { error: error.message }
  }

  return { data }
}
