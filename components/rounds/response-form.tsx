'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { submitResponse } from '@/app/rounds/[roundId]/review/[targetId]/actions'

type Question = {
  id: string
  type: 'rating' | 'multiple_choice' | 'text'
  prompt: string
  options_json: string[] | null
}

export function ResponseForm({
  roundId,
  targetId,
  questions,
}: {
  roundId: string
  targetId: string
  questions: Question[]
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const result = await submitResponse(roundId, targetId, answers)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(`/rounds/${roundId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup>
        {questions.map((q) => (
          <Field key={q.id}>
            <FieldLabel>{q.prompt}</FieldLabel>
            {q.type === 'rating' && (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={answers[q.id] === value ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            )}
            {q.type === 'multiple_choice' && (
              <div className="flex flex-wrap gap-2">
                {(q.options_json ?? []).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={answers[q.id] === option ? 'default' : 'outline'}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: option }))}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            )}
            {q.type === 'text' && (
              <Textarea
                value={(answers[q.id] as string) ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Nhập câu trả lời..."
              />
            )}
          </Field>
        ))}
      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang nộp...' : 'Nộp đánh giá'}
      </Button>
    </form>
  )
}
