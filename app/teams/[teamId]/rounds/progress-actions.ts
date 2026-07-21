'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getRoundProgress(
  roundId: string,
  participantCount: number
): Promise<{ submitted: number; total: number }> {
  // Authorize BEFORE touching the admin client: this is a 'use server' action,
  // so any client could call it with an arbitrary roundId. The RLS-bound read
  // returns the round only if the caller may see it (team member for team
  // rounds, participant for open rounds); otherwise we leak nothing.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { submitted: 0, total: 0 }

  const { data: round } = await supabase.from('rounds').select('id').eq('id', roundId).maybeSingle()
  if (!round) return { submitted: 0, total: 0 }

  const admin = createAdminClient()
  const total = participantCount * (participantCount - 1)

  const { count } = await admin
    .from('submission_status')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)

  return { submitted: count ?? 0, total }
}
