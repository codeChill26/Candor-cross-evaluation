'use server'

import { createClient } from '@/lib/supabase/server'

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

  const { error: participantError } = await supabase
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
