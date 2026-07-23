'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dbError } from '@/lib/utils/action-error'
import { getSubmissionProgress } from '@/lib/rounds/progress'

type CloseRoundResult = { error: string } | { data: true }

// `force` lets the creator close anyway when someone has gone silent — without
// it a single non-participant could hold the round open until its deadline.
export async function closeRound(roundId: string, force = false): Promise<CloseRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const { data: round } = await supabase.from('rounds').select('created_by').eq('id', roundId).maybeSingle()
  if (!round) {
    return { error: 'Không tìm thấy vòng đánh giá' }
  }
  if (round.created_by !== user.id) {
    return { error: 'Chỉ người tạo vòng mới có thể đóng vòng' }
  }

  // Enforced here, not just in the UI: everyone must have submitted at least one
  // review before a manual close.
  const progress = await getSubmissionProgress(roundId)
  if (progress.pending > 0 && !force) {
    return {
      error: `Còn ${progress.pending} người chưa nộp đánh giá nào. Chờ họ nộp, hoặc chọn "Vẫn đóng".`,
    }
  }

  const { error } = await supabase.from('rounds').update({ status: 'closed' }).eq('id', roundId)
  if (error) {
    return dbError('closeRound', error)
  }

  revalidatePath(`/rounds/${roundId}`)
  return { data: true }
}
