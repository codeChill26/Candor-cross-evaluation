import { describe, it, expect } from 'vitest'
import { aggregateReport } from '@/lib/report/aggregate'

const questions = [
  { id: 'q1', type: 'rating' as const, prompt: 'Hợp tác?', options: null },
  { id: 'q2', type: 'multiple_choice' as const, prompt: 'Tiếp tục?', options: ['Có', 'Không'] },
  { id: 'q3', type: 'text' as const, prompt: 'Góp ý?', options: null },
]

const responses = [
  {
    id: 'r1',
    answers: [
      { question_id: 'q1', value: 4 },
      { question_id: 'q2', value: 'Có' },
      { question_id: 'q3', value: 'Tốt' },
    ],
  },
  {
    id: 'r2',
    answers: [
      { question_id: 'q1', value: 2 },
      { question_id: 'q2', value: 'Không' },
      { question_id: 'q3', value: 'Cần cải thiện' },
    ],
  },
]

describe('aggregateReport', () => {
  it('computes the average and count for a rating question', () => {
    const result = aggregateReport(questions, responses)
    const ratingResult = result.find((r) => r.prompt === 'Hợp tác?')
    expect(ratingResult).toMatchObject({ type: 'rating', average: 3, count: 2 })
  })

  it('computes option counts for a multiple_choice question', () => {
    const result = aggregateReport(questions, responses)
    const mcResult = result.find((r) => r.prompt === 'Tiếp tục?')
    expect(mcResult).toMatchObject({ type: 'multiple_choice', counts: { Có: 1, Không: 1 }, total: 2 })
  })

  it('collects all text answers for a text question', () => {
    const result = aggregateReport(questions, responses)
    const textResult = result.find((r) => r.prompt === 'Góp ý?')
    expect(textResult).toMatchObject({
      type: 'text',
      answers: expect.arrayContaining(['Tốt', 'Cần cải thiện']),
    })
  })

  it('returns a rating average of 0 and count 0 when there are no responses', () => {
    const result = aggregateReport(questions, [])
    const ratingResult = result.find((r) => r.prompt === 'Hợp tác?')
    expect(ratingResult).toMatchObject({ average: 0, count: 0 })
  })

  it('includes every multiple_choice option even with zero votes', () => {
    const result = aggregateReport(questions, [])
    const mcResult = result.find((r) => r.prompt === 'Tiếp tục?')
    expect(mcResult).toMatchObject({ counts: { Có: 0, Không: 0 }, total: 0 })
  })
})
