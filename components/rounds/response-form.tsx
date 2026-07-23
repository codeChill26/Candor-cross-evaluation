'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { allowsOther, visibleOptions, type QuestionType } from '@/lib/validations/round'
import { clearDraft, loadDraft, pruneAnswers, saveDraft } from '@/lib/rounds/draft'
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
  // Start from the saved draft so re-opening a target shows what you had.
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(
    () => loadDraft(roundId, targetId) ?? {}
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Which "Khác" boxes are ticked. The typed text itself lives in `answers`
  // (that's what gets submitted), so drafts restore it for free — this state
  // only tracks the ticked-but-still-empty case. Seeded from the saved draft:
  // a stored value that isn't one of the predefined options came from "Khác".
  const [otherMode, setOtherMode] = useState<Record<string, boolean>>(() => {
    const draft = loadDraft(roundId, targetId) ?? {}
    const mode: Record<string, boolean> = {}
    for (const q of questions) {
      if (!allowsOther(q.options_json)) continue
      const opts = visibleOptions(q.options_json)
      const v = draft[q.id]
      if (typeof v === 'string' ? v !== '' && !opts.includes(v) : Array.isArray(v) && v.some((x) => !opts.includes(x))) {
        mode[q.id] = true
      }
    }
    return mode
  })

  // The free-text part of an answer = whatever isn't a predefined option.
  function otherTextOf(q: Question): string {
    const opts = visibleOptions(q.options_json)
    const v = answers[q.id]
    if (q.type === 'checkbox') {
      return (Array.isArray(v) ? v : []).find((x) => !opts.includes(x)) ?? ''
    }
    return typeof v === 'string' && v !== '' && !opts.includes(v) ? v : ''
  }

  function toggleOther(q: Question) {
    const on = !(otherMode[q.id] ?? false)
    setOtherMode((prev) => ({ ...prev, [q.id]: on }))
    if (on) return
    // Unticking drops the free-text entry.
    const opts = visibleOptions(q.options_json)
    setAnswers((prev) => {
      if (q.type === 'checkbox') {
        const arr = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : []
        return { ...prev, [q.id]: arr.filter((x) => opts.includes(x)) }
      }
      return { ...prev, [q.id]: '' }
    })
  }

  function setOtherText(q: Question, text: string) {
    if (q.type !== 'checkbox') {
      set(q.id, text)
      return
    }
    const opts = visibleOptions(q.options_json)
    setAnswers((prev) => {
      const arr = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : []
      const predefined = arr.filter((x) => opts.includes(x))
      return { ...prev, [q.id]: text ? [...predefined, text] : predefined }
    })
  }

  // Persist every edit locally (browser only — never the DB) so the reviewer
  // can leave and come back to edit until they finalize.
  useEffect(() => {
    saveDraft(roundId, targetId, answers)
  }, [answers, roundId, targetId])

  function set(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function handleSaveDraft() {
    saveDraft(roundId, targetId, answers)
    router.push(`/rounds/${roundId}`)
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
    // First "Nộp" (or an accidental Enter) only opens the confirmation — you
    // can't edit after submitting, so the finality has to be explicit.
    if (!confirming) {
      setConfirming(true)
      return
    }
    setPending(true)
    setError(null)
    // pruneAnswers drops blank/empty answers so optional questions can be
    // skipped and the server schema doesn't reject empty strings.
    const result = await submitResponse(roundId, targetId, pruneAnswers(answers))
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    clearDraft(roundId, targetId)
    router.push(`/rounds/${roundId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup>
        {questions.map((q) => {
          const options = visibleOptions(q.options_json)
          const value = answers[q.id]
          const hasOther = allowsOther(q.options_json)
          const isOther = otherMode[q.id] ?? false
          const otherText = otherTextOf(q)
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
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {options.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={!isOther && value === option ? 'default' : 'outline'}
                        onClick={() => {
                          setOtherMode((prev) => ({ ...prev, [q.id]: false }))
                          set(q.id, option)
                        }}
                      >
                        {option}
                      </Button>
                    ))}
                    {hasOther && (
                      <Button
                        type="button"
                        variant={isOther ? 'default' : 'outline'}
                        onClick={() => toggleOther(q)}
                      >
                        Khác…
                      </Button>
                    )}
                  </div>
                  {hasOther && isOther && (
                    <Input
                      value={otherText}
                      onChange={(e) => setOtherText(q, e.target.value)}
                      placeholder="Nhập câu trả lời của bạn..."
                    />
                  )}
                </div>
              )}

              {q.type === 'checkbox' && (
                <div className="space-y-2">
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
                    {hasOther && (
                      <Button
                        type="button"
                        variant={isOther ? 'default' : 'outline'}
                        onClick={() => toggleOther(q)}
                      >
                        {isOther ? '☑ ' : '☐ '}
                        Khác…
                      </Button>
                    )}
                  </div>
                  {hasOther && isOther && (
                    <Input
                      value={otherText}
                      onChange={(e) => setOtherText(q, e.target.value)}
                      placeholder="Nhập lựa chọn của bạn..."
                    />
                  )}
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
      {confirming ? (
        <div className="space-y-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Sau khi nộp, đánh giá sẽ được ẩn danh và <strong>không thể sửa lại</strong>. Bạn chắc chưa?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang nộp...' : 'Xác nhận nộp'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Quay lại
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Nộp đánh giá</Button>
          <Button type="button" variant="outline" onClick={handleSaveDraft}>
            Lưu nháp
          </Button>
        </div>
      )}
    </form>
  )
}
