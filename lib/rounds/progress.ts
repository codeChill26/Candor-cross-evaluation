import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type RoundProgress = {
  participants: number
  /** Review pairs submitted so far. */
  submitted: number
  /** Review pairs expected if everyone reviews everyone else. */
  totalPairs: number
  /** Participants who haven't submitted a single review yet. */
  pending: number
}

// Computed with the admin client because submission_status is readable only by
// its own reviewer under RLS, so no client can aggregate this itself.
//
// Deliberately returns COUNTS ONLY — never who reviewed whom. Exposing the
// per-pair map to the round creator would let them line a single report entry
// up against a specific reviewer and break anonymity.
export async function getSubmissionProgress(roundId: string): Promise<RoundProgress> {
  const admin = createAdminClient()

  const [{ data: participants }, { data: submissions }] = await Promise.all([
    admin.from('round_participants').select('user_id').eq('round_id', roundId),
    admin.from('submission_status').select('reviewer_id').eq('round_id', roundId),
  ])

  const participantIds = (participants ?? []).map((p) => p.user_id as string)
  const reviewers = new Set((submissions ?? []).map((s) => s.reviewer_id as string))
  const n = participantIds.length

  return {
    participants: n,
    submitted: (submissions ?? []).length,
    totalPairs: n * (n - 1),
    pending: participantIds.filter((id) => !reviewers.has(id)).length,
  }
}
