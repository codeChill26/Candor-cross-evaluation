import { describe, it, expect } from 'vitest'
import { createRoundSchema, buildAnswersSchema, displayNameSchema, createOpenRoundSchema } from '@/lib/validations/round'

describe('createRoundSchema', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const past = new Date(Date.now() - 1000).toISOString()

  it('accepts a valid round with one question of each type', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [
        { type: 'rating', prompt: 'Mức độ hợp tác?' },
        { type: 'multiple_choice', prompt: 'Bạn có muốn tiếp tục làm cùng?', options: ['Có', 'Không'] },
        { type: 'text', prompt: 'Góp ý thêm?' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a deadline in the past', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: past,
      questions: [{ type: 'text', prompt: 'Góp ý?' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero questions', () => {
    const result = createRoundSchema.safeParse({ title: 'Q3 Review', deadline: future, questions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a multiple_choice question with fewer than 2 options', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'multiple_choice', prompt: 'Chọn?', options: ['Chỉ một'] }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty question prompt', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'text', prompt: '' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('buildAnswersSchema', () => {
  const questions = [
    { id: 'q1', type: 'rating' as const, options: null },
    { id: 'q2', type: 'multiple_choice' as const, options: ['Có', 'Không'] },
    { id: 'q3', type: 'text' as const, options: null },
  ]

  it('accepts a fully valid answer set', () => {
    const schema = buildAnswersSchema(questions)
    const result = schema.safeParse({ q1: 4, q2: 'Có', q3: 'Làm việc tốt' })
    expect(result.success).toBe(true)
  })

  it('rejects a rating answer outside 1-5', () => {
    const schema = buildAnswersSchema(questions)
    expect(schema.safeParse({ q1: 6, q2: 'Có', q3: 'x' }).success).toBe(false)
  })

  it('rejects a multiple_choice answer not in the options list', () => {
    const schema = buildAnswersSchema(questions)
    expect(schema.safeParse({ q1: 3, q2: 'Không tồn tại', q3: 'x' }).success).toBe(false)
  })

  it('rejects an empty text answer', () => {
    const schema = buildAnswersSchema(questions)
    expect(schema.safeParse({ q1: 3, q2: 'Có', q3: '' }).success).toBe(false)
  })
})

describe('displayNameSchema', () => {
  it('accepts a normal name', () => {
    expect(displayNameSchema.safeParse('Nguyễn Văn A').success).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false)
  })

  it('rejects a name over 50 characters', () => {
    expect(displayNameSchema.safeParse('a'.repeat(51)).success).toBe(false)
  })
})

describe('createOpenRoundSchema', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  it('accepts round fields plus a display name', () => {
    const result = createOpenRoundSchema.safeParse({
      displayName: 'Nguyễn Văn A',
      title: 'Đánh giá dự án nhóm',
      deadline: future,
      questions: [{ type: 'text', prompt: 'Góp ý?' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing display name', () => {
    const result = createOpenRoundSchema.safeParse({
      title: 'Đánh giá dự án nhóm',
      deadline: future,
      questions: [{ type: 'text', prompt: 'Góp ý?' }],
    })
    expect(result.success).toBe(false)
  })
})
