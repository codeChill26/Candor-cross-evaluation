'use server'

import { createClient } from '@/lib/supabase/server'
import { buildAnswersSchema } from '@/lib/validations/round'

type SubmitResponseResult = { error: string } | { data: true }

type QuestionForValidation = { id: string; type: 'rating' | 'multiple_choice' | 'text'; options: string[] | null }

export async function submitResponse(
  roundId: string,
  targetId: string,
  answers: Record<string, string | number>
): Promise<SubmitResponseResult> {
  const supabase = await createClient()

  const { data: questions, error: questionsError } = await supabase
    .from('round_questions')
    .select('id, type, options_json')
    .eq('round_id', roundId)

  if (questionsError || !questions) {
    return { error: 'Không tải được câu hỏi của vòng đánh giá' }
  }

  const questionsForValidation: QuestionForValidation[] = questions.map((q) => ({
    id: q.id,
    type: q.type,
    options: q.options_json,
  }))

  const schema = buildAnswersSchema(questionsForValidation)
  const parsed = schema.safeParse(answers)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const answersArray = questionsForValidation.map((q) => ({
    question_id: q.id,
    value: parsed.data[q.id as keyof typeof parsed.data],
  }))

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
