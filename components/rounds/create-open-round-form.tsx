'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createOpenRoundSchema, type CreateOpenRoundInput, type CreateRoundInput } from '@/lib/validations/round'
import { createOpenRound } from '@/app/rounds/new/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { QuestionBuilder } from '@/components/rounds/question-builder'

export function CreateOpenRoundForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    control,
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOpenRoundInput>({
    resolver: zodResolver(createOpenRoundSchema),
    defaultValues: {
      displayName: '',
      title: '',
      deadline: '',
      questions: [{ type: 'paragraph', prompt: '', required: true }],
    },
  })

  async function onSubmit(values: CreateOpenRoundInput) {
    setServerError(null)
    const { displayName, ...roundInput } = values
    // options are already trimmed/blank-dropped by the zod resolver transform.
    const result = await createOpenRound(displayName, roundInput)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    router.push(`/rounds/${result.data.id}`)
  }

  // QuestionBuilder is typed against CreateRoundInput (title/deadline/questions).
  // CreateOpenRoundInput is that same shape plus displayName — useFieldArray only
  // ever touches the 'questions' path, so this cast is safe at runtime.
  const roundControl = control as unknown as Control<CreateRoundInput>
  const roundRegister = register as unknown as UseFormRegister<CreateRoundInput>
  const roundSetValue = setValue as unknown as UseFormSetValue<CreateRoundInput>
  const roundErrors = errors as unknown as FieldErrors<CreateRoundInput>

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FieldGroup>
        <Field data-invalid={!!errors.displayName}>
          <FieldLabel htmlFor="display-name">Tên hiển thị của bạn</FieldLabel>
          <Input id="display-name" placeholder="Nguyễn Văn A" {...register('displayName')} />
          <FieldError errors={[errors.displayName]} />
        </Field>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="round-title">Tên vòng đánh giá</FieldLabel>
          <Input id="round-title" placeholder="VD: Đánh giá dự án nhóm" {...register('title')} />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field data-invalid={!!errors.deadline}>
          <FieldLabel htmlFor="round-deadline">Deadline</FieldLabel>
          <Input id="round-deadline" type="datetime-local" {...register('deadline')} />
          <FieldError errors={[errors.deadline]} />
        </Field>
      </FieldGroup>
      <QuestionBuilder control={roundControl} register={roundRegister} setValue={roundSetValue} errors={roundErrors} />
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Đang tạo...' : 'Tạo vòng đánh giá'}
      </Button>
    </form>
  )
}
