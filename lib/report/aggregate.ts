export type ReportQuestion = {
  id: string
  type: 'rating' | 'multiple_choice' | 'text'
  prompt: string
  options: string[] | null
}

export type ReportAnswer = { question_id: string; value: number | string }
export type ReportResponse = { id: string; answers: ReportAnswer[] }

export type AggregateResult =
  | { type: 'rating'; prompt: string; average: number; count: number }
  | { type: 'multiple_choice'; prompt: string; counts: Record<string, number>; total: number }
  | { type: 'text'; prompt: string; answers: string[] }

export function aggregateReport(
  questions: ReportQuestion[],
  responses: ReportResponse[]
): AggregateResult[] {
  return questions.map((q) => {
    const values = responses
      .map((r) => r.answers.find((a) => a.question_id === q.id)?.value)
      .filter((v): v is number | string => v !== undefined)

    if (q.type === 'rating') {
      const nums = values as number[]
      const average = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
      return { type: 'rating', prompt: q.prompt, average, count: nums.length }
    }

    if (q.type === 'multiple_choice') {
      const counts: Record<string, number> = {}
      for (const option of q.options ?? []) counts[option] = 0
      for (const v of values as string[]) counts[v] = (counts[v] ?? 0) + 1
      return { type: 'multiple_choice', prompt: q.prompt, counts, total: values.length }
    }

    return { type: 'text', prompt: q.prompt, answers: values as string[] }
  })
}
