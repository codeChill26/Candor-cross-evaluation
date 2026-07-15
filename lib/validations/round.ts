import { z } from 'zod'

export const roundQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rating'),
    prompt: z.string().min(1, 'Câu hỏi không được để trống').max(300),
  }),
  z.object({
    type: z.literal('multiple_choice'),
    prompt: z.string().min(1, 'Câu hỏi không được để trống').max(300),
    options: z
      .array(z.string().min(1, 'Lựa chọn không được để trống').max(100))
      .min(2, 'Cần ít nhất 2 lựa chọn')
      .max(8, 'Tối đa 8 lựa chọn'),
  }),
  z.object({
    type: z.literal('text'),
    prompt: z.string().min(1, 'Câu hỏi không được để trống').max(300),
  }),
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

type AnswerQuestion = {
  id: string
  type: 'rating' | 'multiple_choice' | 'text'
  options: string[] | null
}

export function buildAnswersSchema(questions: AnswerQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const q of questions) {
    if (q.type === 'rating') {
      shape[q.id] = z.number().int().min(1).max(5)
    } else if (q.type === 'multiple_choice') {
      const options = q.options ?? []
      shape[q.id] = z.enum(options as [string, ...string[]])
    } else {
      shape[q.id] = z.string().min(1, 'Vui lòng nhập câu trả lời').max(2000)
    }
  }
  return z.object(shape)
}
