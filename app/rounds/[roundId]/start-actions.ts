'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dbError } from '@/lib/utils/action-error'
import { MIN_PARTICIPANTS } from '@/lib/rounds/constants'

type StartRoundResult = { error: string } | { data: true }

export async function startRound(roundId: string): Promise<StartRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, status')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) {
    return { error: 'Không tìm thấy vòng đánh giá' }
  }
  if (round.created_by !== user.id) {
    return { error: 'Chỉ người tạo vòng mới có thể bắt đầu đánh giá' }
  }
  if (round.status !== 'collecting') {
    return { error: 'Vòng này không ở trạng thái chờ tham gia' }
  }

  const { count } = await supabase
    .from('round_participants')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)
  if ((count ?? 0) < MIN_PARTICIPANTS) {
    return { error: `Cần ít nhất ${MIN_PARTICIPANTS} người tham gia để đảm bảo ẩn danh` }
  }

  const { error } = await supabase.from('rounds').update({ status: 'open' }).eq('id', roundId)
  if (error) {
    return dbError('startRound', error)
  }

  revalidatePath(`/rounds/${roundId}`)
  return { data: true }
}
