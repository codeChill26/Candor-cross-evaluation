'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type JoinOpenRoundResult = { error: string } | { data: true }

export async function joinOpenRound(roundId: string, displayName: string): Promise<JoinOpenRoundResult> {
  const supabase = await createClient()
  let {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: displayName } },
    })
    if (signInError || !signInData.user) {
      return { error: signInError?.message ?? 'Không thể tham gia' }
    }
    user = signInData.user
  }

  // Admin client for the write: the round_participants insert policy has to
  // read the target round, but an open round is unreadable to someone who
  // isn't a participant yet — so a joiner can never satisfy it (RLS deadlock).
  // We enforce the same rule the policy did (open round, still collecting) in
  // code, then insert as admin.
  const admin = createAdminClient()

  const { data: round } = await admin
    .from('rounds')
    .select('team_id, status')
    .eq('id', roundId)
    .maybeSingle()

  if (!round || round.team_id !== null) {
    return { error: 'Vòng đánh giá không tồn tại' }
  }
  if (round.status !== 'collecting') {
    return { error: 'Vòng đánh giá này không còn nhận người tham gia mới' }
  }

  const { error: participantError } = await admin
    .from('round_participants')
    .insert({ round_id: roundId, user_id: user.id })

  if (participantError) {
    if (participantError.code === '23505') {
      // unique(round_id, user_id) — already joined, treat as success
      return { data: true }
    }
    return { error: participantError.message }
  }

  return { data: true }
}
