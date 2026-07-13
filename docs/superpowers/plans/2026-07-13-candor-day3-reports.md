# Candor — Day 3 Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each participant see their own report once a round closes — an aggregate view (rating averages, multiple-choice breakdowns, all text comments) and an individual view (every response as its own anonymous card, reshuffled on every load) — with the DB itself, not just the UI, refusing to serve this data before closing or to anyone but the target.

**Architecture:** Two small pure functions (`shuffle`, `aggregateReport`) plus one new RLS policy that is the actual enforcement point for "reports only after closing, only your own": `responses` gets its first-ever SELECT policy, scoped to `target_id = auth.uid()` AND the round being closed. The report page trusts RLS completely (no app-level double-filtering) — this matches the codebase's existing pattern (e.g. `app/teams/page.tsx` already relies on RLS alone for `teams`).

**Tech Stack:** Same as Day 1/2. No new dependencies.

## Global Constraints

- Everything in the Day 1 and Day 2 plans' Global Constraints still applies.
- **Scope cut, per the spec's own stated fallback:** `candor-project.md` §1 Roadmap explicitly says if running behind schedule, cut bilingual UI first ("song ngữ (giữ 1 ngôn ngữ trước)") and *never* cut report-page or submission-page quality. This plan follows that instruction: it does **not** add the VI/EN i18n toggle. All UI stays Vietnamese, matching every page built in Day 1/2. Deployment (Vercel) also isn't executed by this plan — no GitHub remote, Vercel CLI, or `gh` CLI is available in this environment (verified) — it's documented as manual steps instead, same treatment as Supabase setup in `supabase/README.md`.
- Reports are visible only when a round's **effective** status is `closed` (`getEffectiveStatus` from Day 2 Task 2) — never based on the raw `status` column alone, so a round past its deadline but not yet manually closed still gates correctly.
- The `responses` table's anonymity guarantee is unchanged: this plan reads response content but the query and every component in it work with `target_id` and `answers_json` only — never a reviewer identity, because none exists to read.
- Per `candor-project.md` §2 Key Technical Decision 4: teams under 4 members get a visible warning on the report page that anonymity is weaker for small groups (the spec explicitly calls this "đáng ghi chú ngay từ v1" — worth noting starting from v1, even though full mitigation is v2 scope).
- Individual response cards are reshuffled **every time the page loads** (`Math.random()`-based, not a stored order) — per Key Technical Decision 3.

---

### Task 1: Shuffle utility (TDD)

**Files:**
- Create: `lib/utils/shuffle.ts`
- Test: `tests/lib/shuffle.test.ts`

**Interfaces:**
- Produces: `shuffle<T>(items: T[]): T[]` from `@/lib/utils/shuffle` — returns a new array (does not mutate the input), same elements, randomized order.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/shuffle.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shuffle } from '@/lib/utils/shuffle'

describe('shuffle', () => {
  it('preserves all elements (same multiset) for numbers', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect([...result].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b))
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3]
    const copy = [...input]
    shuffle(input)
    expect(input).toEqual(copy)
  })

  it('returns an array of the same length for objects', () => {
    const input = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const result = shuffle(input)
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('eventually produces a different order across repeated calls', () => {
    const input = Array.from({ length: 10 }, (_, i) => i)
    const orders = new Set<string>()
    for (let i = 0; i < 20; i++) {
      orders.add(shuffle(input).join(','))
    }
    expect(orders.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm run test`
Expected: FAIL — `Cannot find module '@/lib/utils/shuffle'`

- [ ] **Step 3: Implement (Fisher-Yates)**

Create `lib/utils/shuffle.ts`:

```ts
export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test`
Expected: PASS (4/4 new tests)

- [ ] **Step 5: Commit**

```bash
git add lib/utils/shuffle.ts tests/lib/shuffle.test.ts
git commit -m "feat: add Fisher-Yates shuffle utility with tests"
```

---

### Task 2: Report aggregation logic (TDD)

**Files:**
- Create: `lib/report/aggregate.ts`
- Test: `tests/lib/aggregate.test.ts`

**Interfaces:**
- Produces: `aggregateReport(questions: ReportQuestion[], responses: ReportResponse[]): AggregateResult[]` from `@/lib/report/aggregate`, where `AggregateResult` is a discriminated union on `type: 'rating' | 'multiple_choice' | 'text'`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/aggregate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aggregateReport } from '@/lib/report/aggregate'

const questions = [
  { id: 'q1', type: 'rating' as const, prompt: 'Hợp tác?', options: null },
  { id: 'q2', type: 'multiple_choice' as const, prompt: 'Tiếp tục?', options: ['Có', 'Không'] },
  { id: 'q3', type: 'text' as const, prompt: 'Góp ý?', options: null },
]

const responses = [
  {
    id: 'r1',
    answers: [
      { question_id: 'q1', value: 4 },
      { question_id: 'q2', value: 'Có' },
      { question_id: 'q3', value: 'Tốt' },
    ],
  },
  {
    id: 'r2',
    answers: [
      { question_id: 'q1', value: 2 },
      { question_id: 'q2', value: 'Không' },
      { question_id: 'q3', value: 'Cần cải thiện' },
    ],
  },
]

describe('aggregateReport', () => {
  it('computes the average and count for a rating question', () => {
    const result = aggregateReport(questions, responses)
    const ratingResult = result.find((r) => r.prompt === 'Hợp tác?')
    expect(ratingResult).toMatchObject({ type: 'rating', average: 3, count: 2 })
  })

  it('computes option counts for a multiple_choice question', () => {
    const result = aggregateReport(questions, responses)
    const mcResult = result.find((r) => r.prompt === 'Tiếp tục?')
    expect(mcResult).toMatchObject({ type: 'multiple_choice', counts: { Có: 1, Không: 1 }, total: 2 })
  })

  it('collects all text answers for a text question', () => {
    const result = aggregateReport(questions, responses)
    const textResult = result.find((r) => r.prompt === 'Góp ý?')
    expect(textResult).toMatchObject({
      type: 'text',
      answers: expect.arrayContaining(['Tốt', 'Cần cải thiện']),
    })
  })

  it('returns a rating average of 0 and count 0 when there are no responses', () => {
    const result = aggregateReport(questions, [])
    const ratingResult = result.find((r) => r.prompt === 'Hợp tác?')
    expect(ratingResult).toMatchObject({ average: 0, count: 0 })
  })

  it('includes every multiple_choice option even with zero votes', () => {
    const result = aggregateReport(questions, [])
    const mcResult = result.find((r) => r.prompt === 'Tiếp tục?')
    expect(mcResult).toMatchObject({ counts: { Có: 0, Không: 0 }, total: 0 })
  })
})
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm run test`
Expected: FAIL — `Cannot find module '@/lib/report/aggregate'`

- [ ] **Step 3: Implement**

Create `lib/report/aggregate.ts`:

```ts
export type ReportQuestion = {
  id: string
  type: 'rating' | 'multiple_choice' | 'text'
  prompt: string
  options: string[] | null
}

export type ReportAnswer = { question_id: string; value: number | string }
export type ReportResponse = { id: string; answers: ReportAnswer[] }

export type AggregateResult =
  | { type: 'rating'; prompt: string; average: number; count: number }
  | { type: 'multiple_choice'; prompt: string; counts: Record<string, number>; total: number }
  | { type: 'text'; prompt: string; answers: string[] }

export function aggregateReport(
  questions: ReportQuestion[],
  responses: ReportResponse[]
): AggregateResult[] {
  return questions.map((q) => {
    const values = responses
      .map((r) => r.answers.find((a) => a.question_id === q.id)?.value)
      .filter((v): v is number | string => v !== undefined)

    if (q.type === 'rating') {
      const nums = values as number[]
      const average = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
      return { type: 'rating', prompt: q.prompt, average, count: nums.length }
    }

    if (q.type === 'multiple_choice') {
      const counts: Record<string, number> = {}
      for (const option of q.options ?? []) counts[option] = 0
      for (const v of values as string[]) counts[v] = (counts[v] ?? 0) + 1
      return { type: 'multiple_choice', prompt: q.prompt, counts, total: values.length }
    }

    return { type: 'text', prompt: q.prompt, answers: values as string[] }
  })
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test`
Expected: PASS (5/5 new tests)

- [ ] **Step 5: Commit**

```bash
git add lib/report/aggregate.ts tests/lib/aggregate.test.ts
git commit -m "feat: add report aggregation logic with tests"
```

---

### Task 3: Database — responses SELECT policy (own + closed only)

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `supabase/README.md`

**Interfaces:**
- Produces: an RLS policy making `responses` readable to a user only for rows where `target_id = auth.uid()` and the parent round is closed (by status or by deadline).

- [ ] **Step 1: Append the policy to `supabase/schema.sql`**

Add this section right after the `submission_status` section (which ends with the "No client-side INSERT policy..." comment) and before "-- ============================================================\n-- 3. Triggers":

```sql
-- ---------- responses ----------
-- This is the enforcement point for "reports only after the round
-- closes, and only your own" — not just a UI check. A user can only ever
-- read responses where they are the target, and only once the round is
-- closed (by status or by deadline). There is still no way to filter by
-- reviewer — that column doesn't exist — so this policy controls *when*
-- you see feedback about yourself, not *who* wrote it.

create policy "responses_select_own_when_closed"
  on public.responses for select
  to authenticated
  using (
    target_id = auth.uid()
    and exists (
      select 1 from public.rounds
      where rounds.id = responses.round_id
        and (rounds.status = 'closed' or rounds.deadline < now())
    )
  );

-- No client-side INSERT policy on responses: see the submit_response()
-- notes above — all writes go through that function only.
```

- [ ] **Step 2: Add a verification step to `supabase/README.md`**

Add step 8:

```markdown
8. Verify the `responses` SELECT policy exists and is scoped correctly:

   ```sql
   select policyname, cmd, qual
   from pg_policies
   where schemaname = 'public' and tablename = 'responses';
   ```

   Expected: one row, `cmd = 'SELECT'`, `policyname = 'responses_select_own_when_closed'`.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql supabase/README.md
git commit -m "feat: add responses SELECT policy scoped to own-and-closed"
```

(No automated test — SQL for a project the user runs manually. Task 4's report page is what actually exercises this policy once the schema is live.)

---

### Task 4: Report page (summary + individual cards + small-team warning)

**Files:**
- Create: `app/rounds/[roundId]/report/page.tsx`
- Create: `components/reports/report-summary.tsx`
- Create: `components/reports/response-card.tsx`

**Interfaces:**
- Consumes: `getEffectiveStatus` (Day 2 Task 2), `aggregateReport`, `type ReportQuestion`, `type AggregateResult` (Task 2), `shuffle` (Task 1), `createClient()` server (Day 1 Task 5).
- Produces: route `/rounds/[roundId]/report`.

- [ ] **Step 1: Report summary component**

Create `components/reports/report-summary.tsx`:

```tsx
import type { AggregateResult } from '@/lib/report/aggregate'

export function ReportSummary({ summary }: { summary: AggregateResult[] }) {
  return (
    <div className="space-y-4">
      {summary.map((item, index) => (
        <div key={index} className="rounded-lg border p-4">
          <p className="font-medium">{item.prompt}</p>
          {item.type === 'rating' && (
            <p className="mt-2 text-sm text-muted-foreground">
              Điểm trung bình:{' '}
              <span className="font-semibold text-foreground">{item.average.toFixed(1)}/5</span>{' '}
              ({item.count} đánh giá)
            </p>
          )}
          {item.type === 'multiple_choice' && (
            <div className="mt-2 space-y-1">
              {Object.entries(item.counts).map(([option, count]) => (
                <div key={option} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{option}</span>
                  <span>
                    {count}/{item.total}
                  </span>
                </div>
              ))}
            </div>
          )}
          {item.type === 'text' && (
            <ul className="mt-2 space-y-2">
              {item.answers.length === 0 && (
                <li className="text-sm text-muted-foreground">Chưa có góp ý nào.</li>
              )}
              {item.answers.map((answer, answerIndex) => (
                <li key={answerIndex} className="rounded-md bg-muted p-2 text-sm">
                  {answer}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Individual response card component**

Create `components/reports/response-card.tsx`:

```tsx
import { Card, CardContent } from '@/components/ui/card'
import type { ReportQuestion, ReportAnswer } from '@/lib/report/aggregate'

export function ResponseCard({ questions, answers }: { questions: ReportQuestion[]; answers: ReportAnswer[] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {questions.map((q) => {
          const answer = answers.find((a) => a.question_id === q.id)
          if (!answer) return null
          return (
            <div key={q.id}>
              <p className="text-sm font-medium text-muted-foreground">{q.prompt}</p>
              <p className="text-sm">{q.type === 'rating' ? `${answer.value}/5` : answer.value}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Report page**

Create `app/rounds/[roundId]/report/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveStatus } from '@/lib/utils/round-status'
import { aggregateReport, type ReportQuestion, type ReportResponse } from '@/lib/report/aggregate'
import { shuffle } from '@/lib/utils/shuffle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportSummary } from '@/components/reports/report-summary'
import { ResponseCard } from '@/components/reports/response-card'

export default async function ReportPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase
    .from('rounds')
    .select('id, title, status, deadline')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) notFound()

  const effective = getEffectiveStatus(round.status, round.deadline)
  if (effective !== 'closed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo chưa khả dụng</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Báo cáo chỉ hiển thị sau khi vòng đánh giá đóng.
          </p>
        </CardContent>
      </Card>
    )
  }

  const { data: questions } = await supabase
    .from('round_questions')
    .select('id, type, prompt, options_json')
    .eq('round_id', roundId)
    .order('order_index', { ascending: true })

  // RLS (responses_select_own_when_closed) already restricts this to the
  // caller's own responses in this closed round — no extra filter needed,
  // matching how app/teams/page.tsx trusts RLS alone for `teams`.
  const { data: responses } = await supabase.from('responses').select('id, answers_json').eq('round_id', roundId)

  const { count: participantCount } = await supabase
    .from('round_participants')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)

  const questionsForAggregate: ReportQuestion[] = (questions ?? []).map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options_json,
  }))
  const responsesForAggregate: ReportResponse[] = (responses ?? []).map((r) => ({
    id: r.id,
    answers: r.answers_json,
  }))

  const summary = aggregateReport(questionsForAggregate, responsesForAggregate)
  const shuffledResponses = shuffle(responsesForAggregate)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Báo cáo: {round.title}</h1>
      {(participantCount ?? 0) < 4 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Team này có ít hơn 4 thành viên — với nhóm nhỏ, danh tính người đánh giá có thể bị suy
          đoán qua văn phong hoặc loại trừ, dù hệ thống không lưu bất kỳ liên kết kỹ thuật nào tới
          người viết.
        </p>
      )}
      <ReportSummary summary={summary} />
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Từng phản hồi riêng lẻ</h2>
        {shuffledResponses.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {shuffledResponses.map((r) => (
              <ResponseCard key={r.id} questions={questionsForAggregate} answers={r.answers} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có ai đánh giá bạn trong vòng này.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds; `/rounds/[roundId]/report` listed in route output.

Run: `npm run test`
Expected: all 42 tests (33 from Day 1/2 + 9 from Day 3 Tasks 1-2) still pass.

- [ ] **Step 5: Commit**

```bash
git add app/rounds/[roundId]/report components/reports/report-summary.tsx components/reports/response-card.tsx
git commit -m "feat: add report page with summary, individual cards, and small-team warning"
```

---

### Task 5: Link round detail → report; project README

**Files:**
- Modify: `app/rounds/[roundId]/page.tsx`
- Modify: `README.md` (currently unedited `create-next-app` boilerplate)

**Interfaces:**
- No new exports — this task wires existing pieces together and replaces placeholder documentation.

- [ ] **Step 1: Replace the "Vòng đã đóng" placeholder with a link to the report**

Edit `app/rounds/[roundId]/page.tsx` — add the import:

```tsx
import Link from 'next/link'
```

Replace:

```tsx
      {effective === 'open' ? (
        <TargetList roundId={roundId} targets={targets} />
      ) : (
        <p className="text-muted-foreground">
          Vòng đã đóng. Báo cáo sẽ khả dụng sớm.
        </p>
      )}
```

with:

```tsx
      {effective === 'open' ? (
        <TargetList roundId={roundId} targets={targets} />
      ) : (
        <Link href={`/rounds/${roundId}/report`} className="text-primary underline underline-offset-4">
          Xem báo cáo của bạn
        </Link>
      )}
```

- [ ] **Step 2: Replace the root README**

Overwrite `README.md`:

```markdown
# Candor

Nền tảng đánh giá chéo ẩn danh cho team. Xem `candor-project.md` cho spec đầy đủ (ý tưởng, kiến trúc, quyết định kỹ thuật).

## Setup

1. `npm install`
2. Tạo project Supabase và điền `.env.local` — xem `supabase/README.md` (bao gồm chạy `supabase/schema.sql` và các bước xác minh).
3. `npm run dev` → http://localhost:3000

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run test` — chạy toàn bộ unit test (Vitest)
- `npm run lint` — ESLint

## Deploy

Xem `candor-project.md` → mục 3 "Hướng Dẫn Triển Khai" (Vercel + Supabase Cloud, biến môi trường cần thiết, cấu hình domain/HTTPS).

## Ghi chú kỹ thuật quan trọng

- Ẩn danh được đảm bảo ở tầng cấu trúc dữ liệu: bảng `responses` không có cột liên kết tới người đánh giá — xem `candor-project.md` → mục 2 "Key Technical Decisions".
- Dự án dùng Next.js 16 (`proxy.ts` thay `middleware.ts`), shadcn/ui bản Base UI (không phải Radix), zod v4 — các phiên bản này mới hơn dữ liệu huấn luyện thông thường, nên kiểm tra `node_modules/next/dist/docs/` và code thực tế trước khi giả định API.
- Giao diện hiện chỉ có tiếng Việt — song ngữ VN/EN bị cắt khỏi phạm vi theo đúng ưu tiên đã ghi trong `candor-project.md` → mục 1 "Roadmap & Milestones".
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds, no route changes (README isn't part of the app build, but this confirms Step 1's edit didn't break anything).

- [ ] **Step 4: Commit**

```bash
git add "app/rounds/[roundId]/page.tsx" README.md
git commit -m "feat: link closed rounds to their report; write project README"
```

---

## End of Day 3

At this point: `npm run build` succeeds, `npm run test` passes (42 tests), and every Day 3 roadmap item that wasn't explicitly cut is done — report page (summary + shuffled individual cards, closed-and-own enforced at the RLS layer, small-team warning) and a real project README. Explicitly not done, by design: the VI/EN toggle (cut per the spec's own fallback priority) and actual deployment execution (no GitHub remote / Vercel CLI / `gh` CLI available in this environment — `candor-project.md` §3 and `supabase/README.md` cover the manual steps). Before Wed 2026-07-15: run `supabase/schema.sql` against the live project (still not run as of Day 2's end), test the full flow with a real team, then deploy per `candor-project.md` §3.
