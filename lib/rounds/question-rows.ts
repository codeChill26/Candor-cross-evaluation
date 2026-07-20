import type { RoundQuestionInput } from '@/lib/validations/round'

// Maps validated builder questions into round_questions insert rows. Shared by
// the team-round and open-round create actions so the type→column mapping
// (options for choice types, min/max for rating & nps, required flag) lives in
// one place.
export function buildQuestionRows(roundId: string, questions: RoundQuestionInput[]) {
  return questions.map((q, index) => ({
    round_id: roundId,
    type: q.type,
    prompt: q.prompt,
    options_json: 'options' in q ? q.options : null,
    min_value: q.type === 'rating' ? 1 : q.type === 'nps' ? 0 : null,
    max_value: q.type === 'rating' ? 5 : q.type === 'nps' ? 10 : null,
    order_index: index,
    required: q.required,
  }))
}
