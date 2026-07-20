'use client'

import { useState } from 'react'
import {
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type FieldErrors,
} from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import {
  QUESTION_TYPES,
  CHOICE_TYPES,
  type QuestionType,
  type CreateRoundInput,
  type RoundQuestionInput,
} from '@/lib/validations/round'

type Props = {
  control: Control<CreateRoundInput>
  register: UseFormRegister<CreateRoundInput>
  setValue: UseFormSetValue<CreateRoundInput>
  errors: FieldErrors<CreateRoundInput>
}

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

function defaultsForType(type: QuestionType): RoundQuestionInput {
  const base = { type, prompt: '', required: true }
  return (CHOICE_TYPES.includes(type) ? { ...base, options: ['', ''] } : base) as RoundQuestionInput
}

export function QuestionBuilder({ control, register, setValue, errors }: Props) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'questions' })
  const [pendingType, setPendingType] = useState<QuestionType>('paragraph')

  return (
    <FieldGroup>
      <FieldLabel>Câu hỏi</FieldLabel>

      {fields.map((field, index) => {
        const type = field.type as QuestionType
        const meta = QUESTION_TYPES.find((t) => t.value === type)
        const questionErrors = errors.questions?.[index]
        return (
          <div key={field.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Câu {index + 1} — {meta ? `${meta.emoji} ${meta.label}` : type}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Di chuyển lên"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Di chuyển xuống"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  Xóa
                </Button>
              </div>
            </div>

            <Field data-invalid={!!questionErrors?.prompt}>
              <Input placeholder="Nội dung câu hỏi" {...register(`questions.${index}.prompt`)} />
              <FieldError errors={[questionErrors?.prompt]} />
            </Field>

            {CHOICE_TYPES.includes(type) && (
              <ChoiceOptions control={control} setValue={setValue} errors={errors} index={index} />
            )}

            <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" {...register(`questions.${index}.required`)} />
              Bắt buộc trả lời
            </label>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pendingType}
          onChange={(e) => setPendingType(e.target.value as QuestionType)}
          className={selectClass}
          aria-label="Loại câu hỏi"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.emoji} {t.label}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => append(defaultsForType(pendingType))}>
          + Thêm câu hỏi
        </Button>
      </div>

      <FieldError errors={[errors.questions?.root as { message?: string } | undefined]} />
    </FieldGroup>
  )
}

// Options are managed with useWatch (reactive read) + setValue (mutate) rather
// than a nested useFieldArray: a nested field array does NOT pick up the
// options provided when a new question is appended to the parent array, so the
// initial two boxes never render. useWatch reads the live value, so the two
// defaults from defaultsForType show immediately.
function ChoiceOptions({
  control,
  setValue,
  errors,
  index,
}: {
  control: Control<CreateRoundInput>
  setValue: UseFormSetValue<CreateRoundInput>
  errors: FieldErrors<CreateRoundInput>
  index: number
}) {
  const name = `questions.${index}.options` as `questions.0.options`
  const options = (useWatch({ control, name }) as string[] | undefined) ?? []

  const rawOptionErrors = (
    errors.questions?.[index] as { options?: { message?: string } | ({ message?: string } | undefined)[] } | undefined
  )?.options
  const optionErrors = Array.isArray(rawOptionErrors)
    ? rawOptionErrors
    : rawOptionErrors
      ? [rawOptionErrors]
      : undefined

  const updateOption = (i: number, value: string) => {
    const next = [...options]
    next[i] = value
    setValue(name, next)
  }
  const addOption = () => setValue(name, [...options, ''])
  const removeOption = (i: number) => setValue(name, options.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2 pl-4">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder={`Lựa chọn ${i + 1}`}
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Xóa lựa chọn"
            disabled={options.length <= 2}
            onClick={() => removeOption(i)}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={options.length >= 10}
        onClick={addOption}
      >
        + Thêm lựa chọn
      </Button>
      <FieldError errors={optionErrors} />
    </div>
  )
}
