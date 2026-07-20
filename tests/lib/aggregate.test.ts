import { describe, it, expect } from 'vitest'
import { aggregateReport, type ReportQuestion, type ReportResponse } from '@/lib/report/aggregate'

const questions: ReportQuestion[] = [
  { id: 'q_rating', type: 'rating', prompt: 'Hợp tác?', options: null },
  { id: 'q_mc', type: 'multiple_choice', prompt: 'Tiếp tục?', options: ['Có', 'Không'] },
  { id: 'q_drop', type: 'dropdown', prompt: 'Vai trò?', options: ['Lead', 'Member'] },
  { id: 'q_check', type: 'checkbox', prompt: 'Kỹ năng?', options: ['Giao tiếp', 'Kỹ thuật', 'Lãnh đạo'] },
  { id: 'q_nps', type: 'nps', prompt: 'Giới thiệu?', options: null },
  { id: 'q_text', type: 'text', prompt: 'Góp ý?', options: null },
]

const responses: ReportResponse[] = [
  {
    id: 'r1',
    answers: [
      { question_id: 'q_rating', value: 4 },
      { question_id: 'q_mc', value: 'Có' },
      { question_id: 'q_drop', value: 'Lead' },
      { question_id: 'q_check', value: ['Giao tiếp', 'Kỹ thuật'] },
      { question_id: 'q_nps', value: 10 },
      { question_id: 'q_text', value: 'Tốt' },
    ],
  },
  {
    id: 'r2',
    answers: [
      { question_id: 'q_rating', value: 2 },
      { question_id: 'q_mc', value: 'Không' },
      { question_id: 'q_drop', value: 'Lead' },
      { question_id: 'q_check', value: ['Giao tiếp'] },
      { question_id: 'q_nps', value: 6 },
      { question_id: 'q_text', value: 'Cần cải thiện' },
    ],
  },
]

const find = (prompt: string) => aggregateReport(questions, responses).find((r) => r.prompt === prompt)

describe('aggregateReport', () => {
  it('rating: average, count, distribution', () => {
    expect(find('Hợp tác?')).toMatchObject({
      type: 'rating',
      average: 3,
      count: 2,
      distribution: [0, 1, 0, 1, 0], // one 2, one 4
    })
  })

  it('multiple_choice → choice with ordered option counts', () => {
    expect(find('Tiếp tục?')).toMatchObject({
      type: 'choice',
      counts: [
        { option: 'Có', count: 1 },
        { option: 'Không', count: 1 },
      ],
      total: 2,
    })
  })

  it('dropdown aggregates the same as choice', () => {
    expect(find('Vai trò?')).toMatchObject({
      type: 'choice',
      counts: [
        { option: 'Lead', count: 2 },
        { option: 'Member', count: 0 },
      ],
      total: 2,
    })
  })

  it('checkbox: counts across arrays, respondents = answerers', () => {
    expect(find('Kỹ năng?')).toMatchObject({
      type: 'checkbox',
      counts: [
        { option: 'Giao tiếp', count: 2 },
        { option: 'Kỹ thuật', count: 1 },
        { option: 'Lãnh đạo', count: 0 },
      ],
      respondents: 2,
    })
  })

  it('nps: average + standard score (%promoters − %detractors)', () => {
    // values [10, 6] → promoter 1 (≥9), detractor 1 (≤6), count 2 → score 0
    expect(find('Giới thiệu?')).toMatchObject({ type: 'nps', average: 8, count: 2, score: 0 })
  })

  it('nps score is +100 when everyone is a promoter', () => {
    const q: ReportQuestion[] = [{ id: 'n', type: 'nps', prompt: 'X', options: null }]
    const r: ReportResponse[] = [
      { id: 'a', answers: [{ question_id: 'n', value: 9 }] },
      { id: 'b', answers: [{ question_id: 'n', value: 10 }] },
    ]
    expect(aggregateReport(q, r)[0]).toMatchObject({ type: 'nps', score: 100 })
  })

  it('text: collects all answers', () => {
    expect(find('Góp ý?')).toMatchObject({
      type: 'text',
      answers: expect.arrayContaining(['Tốt', 'Cần cải thiện']),
    })
  })

  it('empty responses: rating 0/0, choice options preserved at 0', () => {
    const empty = aggregateReport(questions, [])
    expect(empty.find((r) => r.prompt === 'Hợp tác?')).toMatchObject({ average: 0, count: 0 })
    expect(empty.find((r) => r.prompt === 'Tiếp tục?')).toMatchObject({
      type: 'choice',
      counts: [
        { option: 'Có', count: 0 },
        { option: 'Không', count: 0 },
      ],
      total: 0,
    })
  })
})
