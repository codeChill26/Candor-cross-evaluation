'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getRoundProgress(
  roundId: string,
  participantCount: number
): Promise<{ submitted: number; total: number }> {
  const admin = createAdminClient()
  const total = participantCount * (participantCount - 1)

  const { count } = await admin
    .from('submission_status')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)

  return { submitted: count ?? 0, total }
}
