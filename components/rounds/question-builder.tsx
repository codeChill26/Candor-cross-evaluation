'use client'

import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import type { CreateRoundInput } from '@/lib/validations/round'

type Props = {
  control: Control<CreateRoundInput>
  register: UseFormRegister<CreateRoundInput>
  errors: FieldErrors<CreateRoundInput>
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  rating: 'Thang điểm (1-5)',
  multiple_choice: 'Trắc nghiệm',
  text: 'Tự luận',
}

export function QuestionBuilder({ control, register, errors }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'questions' })

  return (
    <FieldGroup>
      <FieldLabel>Câu hỏi</FieldLabel>
      {fields.map((field, index) => {
        const questionErrors = errors.questions?.[index]
        return (
          <div key={field.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Câu {index + 1} — {QUESTION_TYPE_LABEL[field.type]}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                Xóa
              </Button>
            </div>
            <Field data-invalid={!!questionErrors?.prompt}>
              <Input placeholder="Nội dung câu hỏi" {...register(`questions.${index}.prompt`)} />
              <FieldError errors={[questionErrors?.prompt]} />
            </Field>
            {field.type === 'multiple_choice' && (
              <MultipleChoiceOptions index={index} register={register} errors={errors} />
            )}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ type: 'rating', prompt: '' })}
        >
          + Câu hỏi thang điểm
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ type: 'multiple_choice', prompt: '', options: ['', ''] })}
        >
          + Câu hỏi trắc nghiệm
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ type: 'text', prompt: '' })}
        >
          + Câu hỏi tự luận
        </Button>
      </div>
      <FieldError errors={[errors.questions?.root as { message?: string } | undefined]} />
    </FieldGroup>
  )
}

function MultipleChoiceOptions({
  index,
  register,
  errors,
}: {
  index: number
  register: UseFormRegister<CreateRoundInput>
  errors: FieldErrors<CreateRoundInput>
}) {
  const optionErrors = (errors.questions?.[index] as { options?: { message?: string }[] } | undefined)
    ?.options

  return (
    <div className="space-y-2 pl-4">
      {[0, 1, 2, 3].map((optionIndex) => (
        <Input
          key={optionIndex}
          placeholder={`Lựa chọn ${optionIndex + 1}${optionIndex >= 2 ? ' (tùy chọn)' : ''}`}
          {...register(`questions.${index}.options.${optionIndex}`)}
        />
      ))}
      <FieldError errors={optionErrors} />
    </div>
  )
}
