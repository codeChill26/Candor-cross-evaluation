import { allowsOther, visibleOptions, type QuestionType } from '@/lib/validations/round'

export type ReportQuestion = {
  id: string
  type: QuestionType | 'text'
  prompt: string
  options: string[] | null
}

export type ReportAnswer = { question_id: string; value: number | string | string[] }
export type ReportResponse = { id: string; answers: ReportAnswer[] }

export type OptionCount = { option: string; count: number }

export type AggregateResult =
  | { type: 'text'; prompt: string; answers: string[] }
  | { type: 'rating'; prompt: string; average: number; count: number; distribution: number[] }
  | { type: 'choice'; prompt: string; counts: OptionCount[]; total: number; otherAnswers: string[] }
  | {
      type: 'checkbox'
      prompt: string
      counts: OptionCount[]
      respondents: number
      otherAnswers: string[]
    }
  | { type: 'nps'; prompt: string; average: number; count: number; score: number; distribution: number[] }

export function aggregateReport(
  questions: ReportQuestion[],
  responses: ReportResponse[]
): AggregateResult[] {
  return questions.map((q) => {
    const values = responses
      .map((r) => r.answers.find((a) => a.question_id === q.id)?.value)
      .filter((v): v is number | string | string[] => v !== undefined)

    if (q.type === 'rating') {
      const nums = values.filter((v): v is number => typeof v === 'number')
      const average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
      // distribution index 0 → score 1, … index 4 → score 5
      const distribution = [1, 2, 3, 4, 5].map((s) => nums.filter((n) => n === s).length)
      return { type: 'rating', prompt: q.prompt, average, count: nums.length, distribution }
    }

    if (q.type === 'nps') {
      const nums = values.filter((v): v is number => typeof v === 'number')
      const count = nums.length
      const average = count ? nums.reduce((a, b) => a + b, 0) / count : 0
      // distribution index 0 → score 0, … index 10 → score 10
      const distribution = Array.from({ length: 11 }, (_, s) => nums.filter((n) => n === s).length)
      const promoters = nums.filter((n) => n >= 9).length
      const detractors = nums.filter((n) => n <= 6).length
      const score = count ? Math.round(((promoters - detractors) / count) * 100) : 0
      return { type: 'nps', prompt: q.prompt, average, count, score, distribution }
    }

    // Anything a respondent typed into "Khác" is, by definition, a value that
    // isn't one of the predefined options — bucket those into a single "Khác"
    // bar and surface the texts themselves separately.
    const options = visibleOptions(q.options)

    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      const strings = values.filter((v): v is string => typeof v === 'string')
      const counts = options.map((option) => ({
        option,
        count: strings.filter((s) => s === option).length,
      }))
      const otherAnswers = allowsOther(q.options)
        ? strings.filter((s) => !options.includes(s))
        : []
      if (otherAnswers.length > 0) counts.push({ option: 'Khác', count: otherAnswers.length })
      return { type: 'choice', prompt: q.prompt, counts, total: strings.length, otherAnswers }
    }

    if (q.type === 'checkbox') {
      const arrays = values.filter((v): v is string[] => Array.isArray(v))
      const counts = options.map((option) => ({
        option,
        count: arrays.filter((arr) => arr.includes(option)).length,
      }))
      const otherAnswers = allowsOther(q.options)
        ? arrays.flatMap((arr) => arr.filter((x) => !options.includes(x)))
        : []
      if (otherAnswers.length > 0) counts.push({ option: 'Khác', count: otherAnswers.length })
      // respondents = number of responses that selected at least one option
      return { type: 'checkbox', prompt: q.prompt, counts, respondents: arrays.length, otherAnswers }
    }

    // paragraph / short_text / legacy text
    const answers = values.filter((v): v is string => typeof v === 'string')
    return { type: 'text', prompt: q.prompt, answers }
  })
}
