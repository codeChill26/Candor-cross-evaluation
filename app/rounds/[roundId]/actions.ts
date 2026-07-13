'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type CloseRoundResult = { error: string } | { data: true }

export async function closeRound(roundId: string): Promise<CloseRoundResult> {
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

  const { error } = await supabase.from('rounds').update({ status: 'closed' }).eq('id', roundId)
  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/rounds/${roundId}`)
  return { data: true }
}
