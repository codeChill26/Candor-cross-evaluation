import { describe, it, expect } from 'vitest'
import { createRoundSchema, buildAnswersSchema, displayNameSchema, createOpenRoundSchema } from '@/lib/validations/round'

describe('createRoundSchema', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const past = new Date(Date.now() - 1000).toISOString()

  it('accepts a valid round with all seven question types', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [
        { type: 'paragraph', prompt: 'Nhận xét chung?', required: true },
        { type: 'short_text', prompt: 'Một từ mô tả?', required: false },
        { type: 'rating', prompt: 'Mức độ hợp tác?', required: true },
        { type: 'checkbox', prompt: 'Kỹ năng nổi bật?', required: true, options: ['Giao tiếp', 'Kỹ thuật'] },
        { type: 'multiple_choice', prompt: 'Tiếp tục làm cùng?', required: true, options: ['Có', 'Không'] },
        { type: 'dropdown', prompt: 'Vai trò phù hợp?', required: false, options: ['Lead', 'Member'] },
        { type: 'nps', prompt: 'Sẵn sàng giới thiệu?', required: true },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('keeps the legacy text type valid', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'text', prompt: 'Góp ý?', required: true }],
    })
    // legacy `text` is intentionally NOT in the builder union anymore, but old
    // data uses it — only buildAnswersSchema/aggregate need to accept it, not
    // the creation schema. So the creation schema rejects it.
    expect(result.success).toBe(false)
  })

  it('rejects a deadline in the past', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: past,
      questions: [{ type: 'paragraph', prompt: 'Góp ý?', required: true }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero questions', () => {
    const result = createRoundSchema.safeParse({ title: 'Q3 Review', deadline: future, questions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a choice question with fewer than 2 non-blank options', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'multiple_choice', prompt: 'Chọn?', required: true, options: ['Chỉ một', '  '] }],
    })
    expect(result.success).toBe(false)
  })

  it('drops blank trailing options and passes with 2 real ones', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'dropdown', prompt: 'Chọn?', required: true, options: ['A', 'B', '', ''] }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects more than 10 options', () => {
    const options = Array.from({ length: 11 }, (_, i) => `Lựa chọn ${i + 1}`)
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'checkbox', prompt: 'Chọn?', required: true, options }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty question prompt', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'paragraph', prompt: '', required: true }],
    })
    expect(result.success).toBe(false)
  })
})

describe('buildAnswersSchema', () => {
  const questions = [
    { id: 'q_rating', type: 'rating' as const, options: null, required: true },
    { id: 'q_nps', type: 'nps' as const, options: null, required: true },
    { id: 'q_mc', type: 'multiple_choice' as const, options: ['Có', 'Không'], required: true },
    { id: 'q_drop', type: 'dropdown' as const, options: ['Lead', 'Member'], required: true },
    { id: 'q_check', type: 'checkbox' as const, options: ['A', 'B', 'C'], required: true },
    { id: 'q_text', type: 'paragraph' as const, options: null, required: true },
  ]

  const valid = { q_rating: 4, q_nps: 9, q_mc: 'Có', q_drop: 'Lead', q_check: ['A', 'C'], q_text: 'Tốt' }

  it('accepts a fully valid answer set', () => {
    expect(buildAnswersSchema(questions).safeParse(valid).success).toBe(true)
  })

  it('rejects a rating outside 1-5', () => {
    expect(buildAnswersSchema(questions).safeParse({ ...valid, q_rating: 6 }).success).toBe(false)
  })

  it('rejects an nps outside 0-10', () => {
    expect(buildAnswersSchema(questions).safeParse({ ...valid, q_nps: 11 }).success).toBe(false)
    expect(buildAnswersSchema(questions).safeParse({ ...valid, q_nps: 0 }).success).toBe(true)
  })

  it('rejects a dropdown value not in options', () => {
    expect(buildAnswersSchema(questions).safeParse({ ...valid, q_drop: 'Ghost' }).success).toBe(false)
  })

  it('rejects a checkbox value not in options', () => {
    expect(buildAnswersSchema(questions).safeParse({ ...valid, q_check: ['A', 'Z'] }).success).toBe(false)
  })

  it('requires at least one checkbox selection when required', () => {
    expect(buildAnswersSchema(questions).safeParse({ ...valid, q_check: [] }).success).toBe(false)
  })

  it('allows an optional checkbox to be empty', () => {
    const optionalCheck = [{ id: 'q_check', type: 'checkbox' as const, options: ['A', 'B'], required: false }]
    expect(buildAnswersSchema(optionalCheck).safeParse({ q_check: [] }).success).toBe(true)
  })

  it('allows an optional text answer to be omitted', () => {
    const optionalText = [{ id: 'q_text', type: 'short_text' as const, options: null, required: false }]
    expect(buildAnswersSchema(optionalText).safeParse({}).success).toBe(true)
  })

  it('rejects an omitted required answer', () => {
    const { q_text, ...missing } = valid
    void q_text
    expect(buildAnswersSchema(questions).safeParse(missing).success).toBe(false)
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
      questions: [{ type: 'paragraph', prompt: 'Góp ý?', required: true }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing display name', () => {
    const result = createOpenRoundSchema.safeParse({
      title: 'Đánh giá dự án nhóm',
      deadline: future,
      questions: [{ type: 'paragraph', prompt: 'Góp ý?', required: true }],
    })
    expect(result.success).toBe(false)
  })
})
