'use server'

import { createClient } from '@/lib/supabase/server'
import { buildAnswersSchema, type QuestionType } from '@/lib/validations/round'

type SubmitResponseResult = { error: string } | { data: true }

type QuestionForValidation = {
  id: string
  type: QuestionType | 'text'
  options: string[] | null
  required: boolean
}

export async function submitResponse(
  roundId: string,
  targetId: string,
  answers: Record<string, string | number | string[]>
): Promise<SubmitResponseResult> {
  const supabase = await createClient()

  const { data: questions, error: questionsError } = await supabase
    .from('round_questions')
    .select('id, type, options_json, required')
    .eq('round_id', roundId)

  if (questionsError || !questions) {
    return { error: 'Không tải được câu hỏi của vòng đánh giá' }
  }

  const questionsForValidation: QuestionForValidation[] = questions.map((q) => ({
    id: q.id,
    type: q.type,
    options: q.options_json,
    required: q.required,
  }))

  const schema = buildAnswersSchema(questionsForValidation)
  const parsed = schema.safeParse(answers)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Skip optional questions the reviewer left unanswered (undefined) so we
  // don't store empty entries.
  const answersArray = questionsForValidation
    .map((q) => ({
      question_id: q.id,
      value: parsed.data[q.id as keyof typeof parsed.data],
    }))
    .filter((a) => a.value !== undefined)

  const { error } = await supabase.rpc('submit_response', {
    p_round_id: roundId,
    p_target_id: targetId,
    p_answers_json: answersArray,
  })

  if (error) {
    return { error: error.message }
  }

  return { data: true }
}
