import { z } from 'zod'

export type QuestionType =
  | 'paragraph'
  | 'short_text'
  | 'rating'
  | 'checkbox'
  | 'multiple_choice'
  | 'dropdown'
  | 'nps'

// Ordered list that drives the "add question" dropdown (emoji + Vietnamese label).
export const QUESTION_TYPES: { value: QuestionType; label: string; emoji: string }[] = [
  { value: 'paragraph', label: 'Đoạn văn', emoji: '📝' },
  { value: 'short_text', label: 'Trả lời ngắn', emoji: '✏️' },
  { value: 'rating', label: 'Chấm điểm 1–5', emoji: '⭐' },
  { value: 'checkbox', label: 'Checkbox (chọn nhiều)', emoji: '☑️' },
  { value: 'multiple_choice', label: 'Trắc nghiệm', emoji: '🔘' },
  { value: 'dropdown', label: 'Dropdown', emoji: '📋' },
  { value: 'nps', label: 'NPS 0–10', emoji: '🎯' },
]

// Types whose builder shows an editable option list.
export const CHOICE_TYPES: QuestionType[] = ['checkbox', 'multiple_choice', 'dropdown']

const promptField = z.string().min(1, 'Câu hỏi không được để trống').max(300)

// Trim and drop blank options, THEN count — so the "(tùy chọn)" boxes the UI
// shows really are optional. transform runs before the refine checks, and
// keeps the field's input type as string[] (unlike z.preprocess, whose unknown
// input type breaks the react-hook-form resolver typing).
const optionsField = z
  .array(z.string().max(100, 'Lựa chọn tối đa 100 ký tự'))
  .transform((arr) => arr.map((o) => o.trim()).filter((o) => o.length > 0))
  .refine((arr) => arr.length >= 2, 'Cần ít nhất 2 lựa chọn')
  .refine((arr) => arr.length <= 10, 'Tối đa 10 lựa chọn')

// Shared across every question type.
const base = { prompt: promptField, required: z.boolean() }

export const roundQuestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), ...base }),
  z.object({ type: z.literal('short_text'), ...base }),
  z.object({ type: z.literal('rating'), ...base }),
  z.object({ type: z.literal('nps'), ...base }),
  z.object({ type: z.literal('checkbox'), ...base, options: optionsField }),
  z.object({ type: z.literal('multiple_choice'), ...base, options: optionsField }),
  z.object({ type: z.literal('dropdown'), ...base, options: optionsField }),
])

export const createRoundSchema = z.object({
  title: z.string().min(2, 'Tên vòng phải có ít nhất 2 ký tự').max(100),
  deadline: z
    .string()
    .refine(
      (v) => !Number.isNaN(new Date(v).getTime()) && new Date(v).getTime() > Date.now(),
      'Deadline phải ở tương lai'
    ),
  questions: z.array(roundQuestionSchema).min(1, 'Cần ít nhất 1 câu hỏi'),
})

export type RoundQuestionInput = z.infer<typeof roundQuestionSchema>
export type CreateRoundInput = z.infer<typeof createRoundSchema>

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Nhập tên hiển thị')
  .max(50, 'Tối đa 50 ký tự')

export const createOpenRoundSchema = createRoundSchema.extend({
  displayName: displayNameSchema,
})

export type CreateOpenRoundInput = z.infer<typeof createOpenRoundSchema>

// `text` is the legacy free-text type — treated exactly like `paragraph`.
type AnswerQuestion = {
  id: string
  type: QuestionType | 'text'
  options: string[] | null
  required: boolean
}

// Builds a per-question answer schema keyed by question id. Required questions
// validate strictly; optional questions may be omitted (undefined).
export function buildAnswersSchema(questions: AnswerQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const q of questions) {
    let field: z.ZodTypeAny
    if (q.type === 'rating') {
      field = z.number().int().min(1).max(5)
    } else if (q.type === 'nps') {
      field = z.number().int().min(0).max(10)
    } else if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      const options = q.options ?? []
      field = z.enum(options as [string, ...string[]])
    } else if (q.type === 'checkbox') {
      const options = q.options ?? []
      field = z
        .array(z.enum(options as [string, ...string[]]))
        .min(q.required ? 1 : 0, 'Chọn ít nhất 1 lựa chọn')
    } else {
      // paragraph / short_text / legacy text
      field = z.string().min(1, 'Vui lòng nhập câu trả lời').max(2000)
    }
    shape[q.id] = q.required ? field : field.optional()
  }
  return z.object(shape)
}
