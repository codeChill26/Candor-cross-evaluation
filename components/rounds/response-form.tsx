'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { QuestionType } from '@/lib/validations/round'
import { submitResponse } from '@/app/rounds/[roundId]/review/[targetId]/actions'

type Question = {
  id: string
  type: QuestionType | 'text'
  prompt: string
  options_json: string[] | null
  required: boolean
}

type AnswerValue = string | number | string[]

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function set(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function toggleCheckbox(id: string, option: string) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : []
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      return { ...prev, [id]: next }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    // Drop blank/empty answers so optional questions can be skipped and the
    // server schema doesn't reject empty strings.
    const cleaned = Object.fromEntries(
      Object.entries(answers).filter(
        ([, v]) => v !== '' && !(Array.isArray(v) && v.length === 0)
      )
    )
    const result = await submitResponse(roundId, targetId, cleaned)
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
        {questions.map((q) => {
          const options = q.options_json ?? []
          const value = answers[q.id]
          return (
            <Field key={q.id}>
              <FieldLabel>
                {q.prompt}
                {!q.required && <span className="ml-1 text-muted-foreground">(không bắt buộc)</span>}
              </FieldLabel>

              {(q.type === 'paragraph' || q.type === 'text') && (
                <Textarea
                  value={(value as string) ?? ''}
                  onChange={(e) => set(q.id, e.target.value)}
                  placeholder="Nhập câu trả lời..."
                />
              )}

              {q.type === 'short_text' && (
                <Input
                  value={(value as string) ?? ''}
                  onChange={(e) => set(q.id, e.target.value)}
                  placeholder="Nhập câu trả lời ngắn..."
                />
              )}

              {q.type === 'rating' && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={value === n ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => set(q.id, n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              )}

              {q.type === 'nps' && (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 11 }, (_, n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={value === n ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => set(q.id, n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              )}

              {q.type === 'multiple_choice' && (
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={value === option ? 'default' : 'outline'}
                      onClick={() => set(q.id, option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}

              {q.type === 'checkbox' && (
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => {
                    const selected = Array.isArray(value) && value.includes(option)
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        onClick={() => toggleCheckbox(q.id, option)}
                      >
                        {selected ? '☑ ' : '☐ '}
                        {option}
                      </Button>
                    )
                  })}
                </div>
              )}

              {q.type === 'dropdown' && (
                <select
                  value={(value as string) ?? ''}
                  onChange={(e) => set(q.id, e.target.value)}
                  className={selectClass}
                >
                  <option value="" disabled>
                    — Chọn —
                  </option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )
        })}
      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang nộp...' : 'Nộp đánh giá'}
      </Button>
    </form>
  )
}
