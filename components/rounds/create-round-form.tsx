'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRoundSchema, type CreateRoundInput } from '@/lib/validations/round'
import { createRound } from '@/app/teams/[teamId]/rounds/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { QuestionBuilder } from '@/components/rounds/question-builder'

export function CreateRoundForm({ teamId }: { teamId: string }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    control,
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoundInput>({
    resolver: zodResolver(createRoundSchema),
    defaultValues: { title: '', deadline: '', questions: [{ type: 'paragraph', prompt: '', required: true }] },
  })

  async function onSubmit(values: CreateRoundInput) {
    setServerError(null)
    // options are already trimmed/blank-dropped by the zod resolver transform.
    const result = await createRound(teamId, values)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    router.push(`/rounds/${result.data.id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="round-title">Tên vòng đánh giá</FieldLabel>
          <Input id="round-title" placeholder="VD: Đánh giá quý 3/2026" {...register('title')} />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field data-invalid={!!errors.deadline}>
          <FieldLabel htmlFor="round-deadline">Deadline</FieldLabel>
          <Input id="round-deadline" type="datetime-local" {...register('deadline')} />
          <FieldError errors={[errors.deadline]} />
        </Field>
      </FieldGroup>
      <QuestionBuilder control={control} register={register} setValue={setValue} errors={errors} />
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Đang tạo...' : 'Tạo vòng đánh giá'}
      </Button>
    </form>
  )
}
