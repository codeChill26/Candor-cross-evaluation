'use server'

import { createClient } from '@/lib/supabase/server'
import { createRoundSchema, type CreateRoundInput } from '@/lib/validations/round'

type CreateOpenRoundResult = { error: string } | { data: { id: string } }

export async function createOpenRound(
  displayName: string,
  input: CreateRoundInput
): Promise<CreateOpenRoundResult> {
  const parsed = createRoundSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously({
    options: { data: { full_name: displayName } },
  })
  if (signInError || !signInData.user) {
    return { error: signInError?.message ?? 'Không thể tạo phiên tham gia' }
  }
  const user = signInData.user

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      team_id: null,
      title: parsed.data.title,
      deadline: new Date(parsed.data.deadline).toISOString(),
      created_by: user.id,
      status: 'collecting',
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

  const { error: participantError } = await supabase
    .from('round_participants')
    .insert({ round_id: round.id, user_id: user.id })
  if (participantError) {
    return { error: participantError.message }
  }

  return { data: { id: round.id } }
}
