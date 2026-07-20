'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRoundSchema, type CreateRoundInput } from '@/lib/validations/round'
import { buildQuestionRows } from '@/lib/rounds/question-rows'

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

  // Writes go through the admin client (service role), not the RLS client.
  // An open round is unreadable to its own creator until they have a
  // round_participants row, but that row can't be inserted until the round is
  // readable — a deadlock in the RLS write path. The creator's identity is
  // already established above (signInAnonymously), so we insert as admin and
  // set every id ourselves. Reads afterwards still go through RLS normally.
  const admin = createAdminClient()
  const roundId = crypto.randomUUID()

  const { error: roundError } = await admin.from('rounds').insert({
    id: roundId,
    team_id: null,
    title: parsed.data.title,
    deadline: new Date(parsed.data.deadline).toISOString(),
    created_by: user.id,
    status: 'collecting',
  })

  if (roundError) {
    return { error: roundError.message }
  }

  const questionRows = buildQuestionRows(roundId, parsed.data.questions)

  const { error: questionsError } = await admin.from('round_questions').insert(questionRows)
  if (questionsError) {
    return { error: questionsError.message }
  }

  const { error: participantError } = await admin
    .from('round_participants')
    .insert({ round_id: roundId, user_id: user.id })
  if (participantError) {
    return { error: participantError.message }
  }

  return { data: { id: roundId } }
}
