'use server'

import { createClient } from '@/lib/supabase/server'
import { createRoundSchema, type CreateRoundInput } from '@/lib/validations/round'

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
    .select('user_id')
    .eq('team_id', teamId)

  if (membersError) {
    return { error: membersError.message }
  }
  if (!members || members.length < 2) {
    return { error: 'Team cần ít nhất 2 thành viên để tạo vòng đánh giá' }
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
    return { error: roundError.message }
  }

  const questionRows = parsed.data.questions.map((q, index) => ({
    round_id: round.id,
    type: q.type,
    prompt: q.prompt,
    options_json: q.type === 'multiple_choice' ? q.options : null,
    min_value: q.type === 'rating' ? 1 : null,
    max_value: q.type === 'rating' ? 5 : null,
    order_index: index,
  }))

  const { error: questionsError } = await supabase.from('round_questions').insert(questionRows)
  if (questionsError) {
    return { error: questionsError.message }
  }

  const participantRows = members.map((m) => ({ round_id: round.id, user_id: m.user_id }))
  const { error: participantsError } = await supabase.from('round_participants').insert(participantRows)
  if (participantsError) {
    return { error: participantsError.message }
  }

  return { data: { id: round.id } }
}
