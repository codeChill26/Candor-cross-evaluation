'use server'

import { createClient } from '@/lib/supabase/server'
import { createRoundSchema, type CreateRoundInput } from '@/lib/validations/round'
import { buildQuestionRows } from '@/lib/rounds/question-rows'
import { dbError } from '@/lib/utils/action-error'
import { MIN_PARTICIPANTS } from '@/lib/rounds/constants'

type CreateRoundResult = { error: string } | { data: { id: string } }

export async function createRound(teamId: string, input: CreateRoundInput): Promise<CreateRoundResult> {
  const parsed = createRoundSchema.safeParse(input)
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

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('user_id, role')
    .eq('team_id', teamId)

  if (membersError) {
    return dbError('createRound.members', membersError)
  }
  if (!members || members.length < MIN_PARTICIPANTS) {
    return { error: `Team cần ít nhất ${MIN_PARTICIPANTS} thành viên để đảm bảo ẩn danh` }
  }
  if (!members.some((m) => m.user_id === user.id && m.role === 'owner')) {
    return { error: 'Chỉ chủ team mới có thể tạo vòng đánh giá' }
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      team_id: teamId,
      title: parsed.data.title,
      deadline: new Date(parsed.data.deadline).toISOString(),
      created_by: user.id,
      status: 'open',
    })
    .select('id')
    .single()

  if (roundError) {
    return dbError('createRound.round', roundError)
  }

  const questionRows = buildQuestionRows(round.id, parsed.data.questions)

  const { error: questionsError } = await supabase.from('round_questions').insert(questionRows)
  if (questionsError) {
    return dbError('createRound.questions', questionsError)
  }

  const participantRows = members.map((m) => ({ round_id: round.id, user_id: m.user_id }))
  const { error: participantsError } = await supabase.from('round_participants').insert(participantRows)
  if (participantsError) {
    return dbError('createRound.participants', participantsError)
  }

  return { data: { id: round.id } }
}
