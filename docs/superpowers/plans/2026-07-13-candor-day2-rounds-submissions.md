# Candor — Day 2 Rounds & Submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any team member create a review round (title, deadline, rating/multiple-choice/text questions), have every other team member submit one review per teammate through a form, and let the creator (or the deadline) close the round — all while preserving the structural anonymity guarantee from Day 1 (the `responses` table still never gains a reviewer-linking column).

**Architecture:** Continues the Day 1 pattern — Next.js Server Actions colocated under `app/`, Supabase JS client directly (no ORM), RLS as the primary authorization layer. The one new primitive is a single Postgres `SECURITY DEFINER` RPC function (`submit_response`) that atomically validates and inserts into both `submission_status` and `responses` in one round-trip — this is what makes "insert into two tables that can never be joined, but both must succeed or neither should" safe without exposing a client-side INSERT policy on `responses`.

**Tech Stack:** Same as Day 1 — Next.js 16 (App Router, Server Actions, `proxy.ts`), Supabase (Postgres + Auth + RLS), zod v4, react-hook-form, shadcn/ui (Base UI-based — `Field`/`FieldGroup` pattern, `render` prop not `asChild`), Vitest.

## Global Constraints

- Everything in the Day 1 plan's Global Constraints still applies (see `docs/superpowers/plans/2026-07-12-candor-day1-foundation.md`).
- Anonymity is structural: `responses` NEVER gains a reviewer-linking column. All new code in this plan preserves that — the only place `reviewer_id` and response content ever exist in the same scope is transiently, inside the `submit_response` SQL function, and even there they go into two separate tables with no shared key.
- v1 round status has exactly two states a user sees in practice: `open` and effectively-closed. There is no scheduled job that flips `status` at the deadline — every read path computes **effective status** as `status = 'closed' OR now() > deadline`. `POST` "close round" just sets `status = 'closed'` early. This matches `candor-project.md` §1 Roadmap ("Logic đóng vòng (deadline hoặc thủ công)") without adding cron/Edge Function infrastructure the 3-day deadline can't afford.
- Every team member can create a round (not just the owner) — per `candor-project.md` §2 Key Technical Decision 6.
- Rating questions use a fixed 1–5 scale in v1 (no per-question configurable min/max in the builder UI) — the spec only requires "rating (thang điểm)", not configurable ranges; `min_value`/`max_value` columns already exist in the schema for future use.
- Dashboard/progress views show submission **counts only, never identities** — per `candor-project.md` §1 ("không hiện ai đã nộp gì, chỉ hiện số lượng"). Aggregate counts are computed server-side with the admin (service-role) client, never via a client-facing `submission_status` SELECT policy broad enough to count other people's rows.
- This plan does **not** include the report page (`GET /api/rounds/:id/report/me`) — that's Day 3 scope per the roadmap.
- `.env.local.example` must never contain real credentials — only `.env.local` (gitignored) does.

---

### Task 1: Round & submission validation schemas (TDD)

**Files:**
- Create: `lib/validations/round.ts`
- Test: `tests/lib/round-validations.test.ts`

**Interfaces:**
- Produces: `roundQuestionSchema`, `createRoundSchema`, `type CreateRoundInput` (from `@/lib/validations/round`); `buildAnswersSchema(questions: { id: string; type: 'rating' | 'multiple_choice' | 'text'; options: string[] | null }[])` returning a zod object schema keyed by question id.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/round-validations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createRoundSchema, buildAnswersSchema } from '@/lib/validations/round'

describe('createRoundSchema', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const past = new Date(Date.now() - 1000).toISOString()

  it('accepts a valid round with one question of each type', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [
        { type: 'rating', prompt: 'Mức độ hợp tác?' },
        { type: 'multiple_choice', prompt: 'Bạn có muốn tiếp tục làm cùng?', options: ['Có', 'Không'] },
        { type: 'text', prompt: 'Góp ý thêm?' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a deadline in the past', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: past,
      questions: [{ type: 'text', prompt: 'Góp ý?' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero questions', () => {
    const result = createRoundSchema.safeParse({ title: 'Q3 Review', deadline: future, questions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a multiple_choice question with fewer than 2 options', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'multiple_choice', prompt: 'Chọn?', options: ['Chỉ một'] }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty question prompt', () => {
    const result = createRoundSchema.safeParse({
      title: 'Q3 Review',
      deadline: future,
      questions: [{ type: 'text', prompt: '' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('buildAnswersSchema', () => {
  const questions = [
    { id: 'q1', type: 'rating' as const, options: null },
    { id: 'q2', type: 'multiple_choice' as const, options: ['Có', 'Không'] },
    { id: 'q3', type: 'text' as const, options: null },
  ]

  it('accepts a fully valid answer set', () => {
    const schema = buildAnswersSchema(questions)
    const result = schema.safeParse({ q1: 4, q2: 'Có', q3: 'Làm việc tốt' })
    expect(result.success).toBe(true)
  })

  it('rejects a rating answer outside 1-5', () => {
    const schema = buildAnswersSchema(questions)
    expect(schema.safeParse({ q1: 6, q2: 'Có', q3: 'x' }).success).toBe(false)
  })

  it('rejects a multiple_choice answer not in the options list', () => {
    const schema = buildAnswersSchema(questions)
    expect(schema.safeParse({ q1: 3, q2: 'Không tồn tại', q3: 'x' }).success).toBe(false)
  })

  it('rejects an empty text answer', () => {
    const schema = buildAnswersSchema(questions)
    expect(schema.safeParse({ q1: 3, q2: 'Có', q3: '' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm run test`
Expected: FAIL — `Cannot find module '@/lib/validations/round'`

- [ ] **Step 3: Implement the schemas**

Create `lib/validations/round.ts`:

```ts
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test`
Expected: PASS (9/9 new tests)

- [ ] **Step 5: Commit**

```bash
git add lib/validations/round.ts tests/lib/round-validations.test.ts
git commit -m "feat: add round and answer validation schemas with tests"
```

---

### Task 2: Round effective-status helper (TDD)

**Files:**
- Create: `lib/utils/round-status.ts`
- Test: `tests/lib/round-status.test.ts`

**Interfaces:**
- Produces: `getEffectiveStatus(status: 'draft' | 'open' | 'closed', deadline: string): 'draft' | 'open' | 'closed'` from `@/lib/utils/round-status`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/round-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getEffectiveStatus } from '@/lib/utils/round-status'

describe('getEffectiveStatus', () => {
  const future = new Date(Date.now() + 60_000).toISOString()
  const past = new Date(Date.now() - 60_000).toISOString()

  it('returns "open" for an open round with a future deadline', () => {
    expect(getEffectiveStatus('open', future)).toBe('open')
  })

  it('returns "closed" for an open round whose deadline has passed', () => {
    expect(getEffectiveStatus('open', past)).toBe('closed')
  })

  it('returns "closed" for a round manually closed before its deadline', () => {
    expect(getEffectiveStatus('closed', future)).toBe('closed')
  })

  it('returns "draft" for a draft round regardless of deadline', () => {
    expect(getEffectiveStatus('draft', past)).toBe('draft')
  })
})
```

- [ ] **Step 2: Run tests, verify failure**

Run: `npm run test`
Expected: FAIL — `Cannot find module '@/lib/utils/round-status'`

- [ ] **Step 3: Implement**

Create `lib/utils/round-status.ts`:

```ts
export type RoundStatus = 'draft' | 'open' | 'closed'

export function getEffectiveStatus(status: RoundStatus, deadline: string): RoundStatus {
  if (status === 'open' && new Date(deadline).getTime() < Date.now()) {
    return 'closed'
  }
  return status
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test`
Expected: PASS (4/4 new tests)

- [ ] **Step 5: Commit**

```bash
git add lib/utils/round-status.ts tests/lib/round-status.test.ts
git commit -m "feat: add round effective-status helper with tests"
```

---

### Task 3: Database — RLS for rounds/questions/participants + submit_response RPC

**Files:**
- Modify: `supabase/schema.sql` (append a new section — the file has not been run against the live project yet, so it stays a single paste-and-run script)
- Modify: `supabase/README.md`

**Interfaces:**
- Produces: RLS policies making `rounds`, `round_questions`, `round_participants` readable/writable by team members per the rules below; a `public.submit_response(p_round_id uuid, p_target_id uuid, p_answers_json jsonb) returns void` RPC callable via `supabase.rpc('submit_response', {...})`; a `submission_status` SELECT policy scoped to the caller's own rows.

- [ ] **Step 1: Append RLS policies to `supabase/schema.sql`**

Add this section at the end of the "2. Row Level Security" section (after the existing `team_invites` policies, before "3. Triggers"):

```sql
-- ---------- rounds ----------

create policy "rounds_select_team_member"
  on public.rounds for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = rounds.team_id and team_members.user_id = auth.uid()
    )
  );

create policy "rounds_insert_team_member"
  on public.rounds for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.team_members
      where team_members.team_id = rounds.team_id and team_members.user_id = auth.uid()
    )
  );

create policy "rounds_update_creator"
  on public.rounds for update
  to authenticated
  using (created_by = auth.uid());

-- ---------- round_questions ----------

create policy "round_questions_select_team_member"
  on public.round_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.rounds
      join public.team_members on team_members.team_id = rounds.team_id
      where rounds.id = round_questions.round_id and team_members.user_id = auth.uid()
    )
  );

create policy "round_questions_insert_round_creator"
  on public.round_questions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.rounds
      where rounds.id = round_questions.round_id and rounds.created_by = auth.uid()
    )
  );

-- ---------- round_participants ----------

create policy "round_participants_select_team_member"
  on public.round_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.rounds
      join public.team_members on team_members.team_id = rounds.team_id
      where rounds.id = round_participants.round_id and team_members.user_id = auth.uid()
    )
  );

create policy "round_participants_insert_round_creator"
  on public.round_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.rounds
      where rounds.id = round_participants.round_id and rounds.created_by = auth.uid()
    )
  );

-- ---------- submission_status ----------
-- A user may only ever see their OWN reviewer rows — never who else has
-- submitted. Team-wide submission counts are computed server-side with
-- the admin client (see getRoundProgress), which bypasses RLS and returns
-- only a count, never these rows, to the client.

create policy "submission_status_select_own"
  on public.submission_status for select
  to authenticated
  using (reviewer_id = auth.uid());

-- No client-side INSERT policy on submission_status or responses: both
-- are written together, atomically, only through submit_response()
-- below, which runs as SECURITY DEFINER and enforces every business rule
-- itself. This is what keeps "insert into two unlinkable tables, both-or-
-- neither" safe without ever granting a broad client INSERT policy on
-- `responses`.
```

- [ ] **Step 2: Append the `submit_response` RPC function**

Add this section at the end of `supabase/schema.sql` (after the existing "3. Triggers" section):

```sql
-- ============================================================
-- 4. Submission RPC
-- ============================================================

-- Atomically records a review: one row in submission_status (progress
-- tracking, linked to the reviewer) and one row in responses (content,
-- NEVER linked to the reviewer). Both inserts succeed or neither does.
-- All business rules are enforced here so a client can't bypass them by
-- calling the tables directly (which it can't anyway — see the RLS notes
-- above — but this is the single source of truth for the rules).
create function public.submit_response(
  p_round_id uuid,
  p_target_id uuid,
  p_answers_json jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_status text;
  v_deadline timestamptz;
begin
  if v_reviewer_id is null then
    raise exception 'not authenticated';
  end if;

  if v_reviewer_id = p_target_id then
    raise exception 'cannot review yourself';
  end if;

  select status, deadline into v_status, v_deadline
  from public.rounds
  where id = p_round_id;

  if v_status is null then
    raise exception 'round not found';
  end if;

  if v_status = 'closed' or v_deadline < now() then
    raise exception 'round is closed';
  end if;

  if not exists (
    select 1 from public.round_participants
    where round_id = p_round_id and user_id = v_reviewer_id
  ) then
    raise exception 'not a participant in this round';
  end if;

  if not exists (
    select 1 from public.round_participants
    where round_id = p_round_id and user_id = p_target_id
  ) then
    raise exception 'target is not a participant in this round';
  end if;

  if exists (
    select 1 from public.submission_status
    where round_id = p_round_id and reviewer_id = v_reviewer_id and target_id = p_target_id
  ) then
    raise exception 'already submitted a review for this target';
  end if;

  insert into public.responses (round_id, target_id, answers_json)
  values (p_round_id, p_target_id, p_answers_json);

  insert into public.submission_status (round_id, reviewer_id, target_id)
  values (p_round_id, v_reviewer_id, p_target_id);
end;
$$;

grant execute on function public.submit_response(uuid, uuid, jsonb) to authenticated;
```

- [ ] **Step 3: Update the verification checklist**

Edit `supabase/README.md` — replace step 5's expectation and add a new step 7:

```markdown
5. Verify tables and RLS with this query (run in SQL Editor):

   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public'
   order by tablename;
   ```

   Expected: all 9 tables listed, `rowsecurity = true` for every row.

6. Verify the `responses` table has no reviewer-linking column:

   ```sql
   select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'responses';
   ```

   Expected columns: `id, round_id, target_id, answers_json, submitted_at` —
   no `reviewer_id` and no other column that could identify the reviewer.

7. Verify the `submit_response` function exists and is callable by
   `authenticated`:

   ```sql
   select routine_name, security_type
   from information_schema.routines
   where routine_schema = 'public' and routine_name = 'submit_response';
   ```

   Expected: one row, `security_type = 'DEFINER'`.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql supabase/README.md
git commit -m "feat: add RLS for rounds/questions/participants and submit_response RPC"
```

(No automated test — this is SQL for a project the user runs manually per `supabase/README.md`. Task 7 below exercises `submit_response` for real once the schema is live.)

---

### Task 4: Create round + question builder

**Files:**
- Create: `app/teams/[teamId]/rounds/actions.ts`
- Create: `app/teams/[teamId]/rounds/new/page.tsx`
- Create: `components/rounds/question-builder.tsx`
- Create: `components/rounds/create-round-form.tsx`
- Modify: `app/teams/[teamId]/page.tsx` (add a link to the rounds list)

**Interfaces:**
- Consumes: `createRoundSchema`, `type CreateRoundInput` (Task 1), `createClient()` server (Day 1 Task 5).
- Produces: server action `createRound(teamId: string, input: CreateRoundInput): Promise<{ error: string } | { data: { id: string } }>` from `@/app/teams/[teamId]/rounds/actions`; route `/teams/[teamId]/rounds/new`.

- [ ] **Step 1: `createRound` server action**

Create `app/teams/[teamId]/rounds/actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createRoundSchema, type CreateRoundInput } from '@/lib/validations/round'

type CreateRoundResult = { error: string } | { data: { id: string } }

export async function createRound(teamId: string, input: CreateRoundInput): Promise<CreateRoundResult> {
  const parsed = createRoundSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)

  if (membersError) {
    return { error: membersError.message }
  }
  if (!members || members.length < 2) {
    return { error: 'Team cần ít nhất 2 thành viên để tạo vòng đánh giá' }
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      team_id: teamId,
      title: parsed.data.title,
      deadline: new Date(parsed.data.deadline).toISOString(),
      created_by: user.id,
      status: 'open',
    })
    .select('id')
    .single()

  if (roundError) {
    return { error: roundError.message }
  }

  const questionRows = parsed.data.questions.map((q, index) => ({
    round_id: round.id,
    type: q.type,
    prompt: q.prompt,
    options_json: q.type === 'multiple_choice' ? q.options : null,
    min_value: q.type === 'rating' ? 1 : null,
    max_value: q.type === 'rating' ? 5 : null,
    order_index: index,
  }))

  const { error: questionsError } = await supabase.from('round_questions').insert(questionRows)
  if (questionsError) {
    return { error: questionsError.message }
  }

  const participantRows = members.map((m) => ({ round_id: round.id, user_id: m.user_id }))
  const { error: participantsError } = await supabase.from('round_participants').insert(participantRows)
  if (participantsError) {
    return { error: participantsError.message }
  }

  return { data: { id: round.id } }
}
```

- [ ] **Step 2: Question builder (dynamic add/remove, 3 types)**

Create `components/rounds/question-builder.tsx`:

```tsx
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
```

> **Note:** the "+4th option" fields are declared eagerly (2 required, 2 optional) rather than fully dynamic add/remove-per-option — this keeps the form's field-array typing simple. Empty trailing option strings are filtered out in `create-round-form.tsx` before submission. This is a deliberate MVP simplification: most teams' multiple-choice questions are 2-4 options (e.g. yes/no, satisfaction levels).

- [ ] **Step 3: Create-round form**

Create `components/rounds/create-round-form.tsx`:

```tsx
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
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoundInput>({
    resolver: zodResolver(createRoundSchema),
    defaultValues: { title: '', deadline: '', questions: [{ type: 'text', prompt: '' }] },
  })

  async function onSubmit(values: CreateRoundInput) {
    setServerError(null)
    const cleaned: CreateRoundInput = {
      ...values,
      questions: values.questions.map((q) =>
        q.type === 'multiple_choice'
          ? { ...q, options: q.options.map((o) => o.trim()).filter((o) => o.length > 0) }
          : q
      ),
    }
    const result = await createRound(teamId, cleaned)
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
      <QuestionBuilder control={control} register={register} errors={errors} />
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Đang tạo...' : 'Tạo vòng đánh giá'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: New-round page**

Create `app/teams/[teamId]/rounds/new/page.tsx`:

```tsx
import { CreateRoundForm } from '@/components/rounds/create-round-form'

export default async function NewRoundPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tạo vòng đánh giá mới</h1>
      <CreateRoundForm teamId={teamId} />
    </div>
  )
}
```

- [ ] **Step 5: Link to it from the team detail page**

Edit `app/teams/[teamId]/page.tsx` — add an import and a link next to `InviteDialog`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
```

Change the header `div` to:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <div className="flex gap-2">
          <Link href={`/teams/${team.id}/rounds`}>
            <Button variant="outline">Vòng đánh giá</Button>
          </Link>
          <InviteDialog teamId={team.id} />
        </div>
      </div>
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds; `/teams/[teamId]/rounds/new` listed in route output.

- [ ] **Step 7: Commit**

```bash
git add app/teams/[teamId]/rounds app/teams/[teamId]/page.tsx components/rounds/question-builder.tsx components/rounds/create-round-form.tsx
git commit -m "feat: add round creation with dynamic question builder"
```

---

### Task 5: Rounds list page with anonymous progress counts

**Files:**
- Create: `app/teams/[teamId]/rounds/page.tsx`
- Create: `app/teams/[teamId]/rounds/progress-actions.ts`
- Create: `components/rounds/round-card.tsx`

**Interfaces:**
- Consumes: `getEffectiveStatus` (Task 2), `createAdminClient()` (Day 1 Task 5).
- Produces: server action `getRoundProgress(roundId: string, participantCount: number): Promise<{ submitted: number; total: number }>` from `@/app/teams/[teamId]/rounds/progress-actions`; route `/teams/[teamId]/rounds`.

- [ ] **Step 1: Progress-count server action (admin client, count only)**

Create `app/teams/[teamId]/rounds/progress-actions.ts`:

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getRoundProgress(
  roundId: string,
  participantCount: number
): Promise<{ submitted: number; total: number }> {
  const admin = createAdminClient()
  const total = participantCount * (participantCount - 1)

  const { count } = await admin
    .from('submission_status')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)

  return { submitted: count ?? 0, total }
}
```

- [ ] **Step 2: Round card (status badge + progress, no identities)**

Create `components/rounds/round-card.tsx`:

```tsx
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getEffectiveStatus } from '@/lib/utils/round-status'

type Round = { id: string; title: string; status: 'draft' | 'open' | 'closed'; deadline: string }

export function RoundCard({ round, progress }: { round: Round; progress: { submitted: number; total: number } }) {
  const effective = getEffectiveStatus(round.status, round.deadline)

  return (
    <Link href={`/rounds/${round.id}`}>
      <Card className="transition-colors hover:border-primary">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{round.title}</CardTitle>
            <Badge variant={effective === 'open' ? 'default' : 'secondary'}>
              {effective === 'open' ? 'Đang mở' : 'Đã đóng'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {progress.submitted}/{progress.total} đã nộp
          </p>
        </CardHeader>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 3: Rounds list page**

Create `app/teams/[teamId]/rounds/page.tsx`:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { RoundCard } from '@/components/rounds/round-card'
import { getRoundProgress } from './progress-actions'

export default async function RoundsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const supabase = await createClient()

  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, title, status, deadline')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  const { count: participantCount } = await supabase
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)

  const roundsWithProgress = await Promise.all(
    (rounds ?? []).map(async (round) => ({
      round,
      progress: await getRoundProgress(round.id, participantCount ?? 0),
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vòng đánh giá</h1>
        <Link href={`/teams/${teamId}/rounds/new`}>
          <Button>Tạo vòng mới</Button>
        </Link>
      </div>
      {roundsWithProgress.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {roundsWithProgress.map(({ round, progress }) => (
            <RoundCard key={round.id} round={round} progress={progress} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Chưa có vòng đánh giá nào. Tạo vòng đầu tiên.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds; `/teams/[teamId]/rounds` listed in route output.

- [ ] **Step 5: Commit**

```bash
git add app/teams/[teamId]/rounds/page.tsx app/teams/[teamId]/rounds/progress-actions.ts components/rounds/round-card.tsx
git commit -m "feat: add rounds list with anonymous progress counts"
```

---

### Task 6: Round detail page + close action

**Files:**
- Create: `app/rounds/[roundId]/page.tsx`
- Create: `app/rounds/[roundId]/actions.ts`
- Create: `components/rounds/target-list.tsx`

**Interfaces:**
- Consumes: `getEffectiveStatus` (Task 2), `createClient()` server (Day 1 Task 5). Unlike the Task 5 rounds-list page, this page shows the current user their *own* per-teammate review status (from `submission_status` rows scoped to `reviewer_id = auth.uid()`, which the RLS policy in Task 3 already allows) — it does not need the aggregate `getRoundProgress` count.
- Produces: server action `closeRound(roundId: string): Promise<{ error: string } | { data: true }>` from `@/app/rounds/[roundId]/actions`; route `/rounds/[roundId]`.

- [ ] **Step 1: `closeRound` server action**

Create `app/rounds/[roundId]/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type CloseRoundResult = { error: string } | { data: true }

export async function closeRound(roundId: string): Promise<CloseRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const { data: round } = await supabase.from('rounds').select('created_by').eq('id', roundId).maybeSingle()
  if (!round) {
    return { error: 'Không tìm thấy vòng đánh giá' }
  }
  if (round.created_by !== user.id) {
    return { error: 'Chỉ người tạo vòng mới có thể đóng vòng' }
  }

  const { error } = await supabase.from('rounds').update({ status: 'closed' }).eq('id', roundId)
  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/rounds/${roundId}`)
  return { data: true }
}
```

- [ ] **Step 2: Target list (per-teammate review status, own progress only)**

Create `components/rounds/target-list.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Target = { userId: string; fullName: string | null; email: string; reviewed: boolean }

export function TargetList({ roundId, targets }: { roundId: string; targets: Target[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {targets.map((t) => (
        <li key={t.userId} className="flex items-center justify-between p-4">
          <span>{t.fullName ?? t.email}</span>
          {t.reviewed ? (
            <Badge variant="secondary">Đã đánh giá</Badge>
          ) : (
            <Link href={`/rounds/${roundId}/review/${t.userId}`}>
              <Button size="sm">Đánh giá</Button>
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Round detail page**

Create `app/rounds/[roundId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveStatus } from '@/lib/utils/round-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TargetList } from '@/components/rounds/target-list'
import { closeRound } from './actions'

export default async function RoundDetailPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase
    .from('rounds')
    .select('id, title, status, deadline, created_by')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: participants } = await supabase
    .from('round_participants')
    .select('user_id, profiles(full_name, email)')
    .eq('round_id', roundId)

  const { data: mySubmissions } = await supabase
    .from('submission_status')
    .select('target_id')
    .eq('round_id', roundId)
    .eq('reviewer_id', user?.id ?? '')

  const reviewedTargetIds = new Set((mySubmissions ?? []).map((s) => s.target_id))

  // Cast: without generated Database types, the embedded `profiles` is
  // typed as an array even though round_participants.user_id -> profiles.id
  // is many-to-one at runtime (same reasoning as the team members page).
  const targets = ((participants ?? []) as unknown as {
    user_id: string
    profiles: { full_name: string | null; email: string }
  }[])
    .filter((p) => p.user_id !== user?.id)
    .map((p) => ({
      userId: p.user_id,
      fullName: p.profiles.full_name,
      email: p.profiles.email,
      reviewed: reviewedTargetIds.has(p.user_id),
    }))

  const effective = getEffectiveStatus(round.status, round.deadline)
  const isCreator = round.created_by === user?.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{round.title}</h1>
          <p className="text-sm text-muted-foreground">
            Deadline: {new Date(round.deadline).toLocaleString('vi-VN')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={effective === 'open' ? 'default' : 'secondary'}>
            {effective === 'open' ? 'Đang mở' : 'Đã đóng'}
          </Badge>
          {isCreator && effective === 'open' && (
            <form action={async () => { 'use server'; await closeRound(roundId) }}>
              <Button type="submit" variant="outline" size="sm">
                Đóng vòng
              </Button>
            </form>
          )}
        </div>
      </div>
      {effective === 'open' ? (
        <TargetList roundId={roundId} targets={targets} />
      ) : (
        <p className="text-muted-foreground">
          Vòng đã đóng. Báo cáo sẽ khả dụng sớm.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds; `/rounds/[roundId]` listed in route output.

- [ ] **Step 5: Commit**

```bash
git add app/rounds/[roundId]/page.tsx app/rounds/[roundId]/actions.ts components/rounds/target-list.tsx
git commit -m "feat: add round detail page with target list and close action"
```

---

### Task 7: Submission review form (calls submit_response RPC)

**Files:**
- Create: `app/rounds/[roundId]/review/[targetId]/page.tsx`
- Create: `app/rounds/[roundId]/review/[targetId]/actions.ts`
- Create: `components/rounds/response-form.tsx`

**Interfaces:**
- Consumes: `buildAnswersSchema` (Task 1), `submit_response` RPC (Task 3).
- Produces: server action `submitResponse(roundId: string, targetId: string, answers: Record<string, string | number>): Promise<{ error: string } | { data: true }>` from `@/app/rounds/[roundId]/review/[targetId]/actions`; route `/rounds/[roundId]/review/[targetId]`.

- [ ] **Step 1: `submitResponse` server action**

Create `app/rounds/[roundId]/review/[targetId]/actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { buildAnswersSchema } from '@/lib/validations/round'

type SubmitResponseResult = { error: string } | { data: true }

type QuestionForValidation = { id: string; type: 'rating' | 'multiple_choice' | 'text'; options: string[] | null }

export async function submitResponse(
  roundId: string,
  targetId: string,
  answers: Record<string, string | number>
): Promise<SubmitResponseResult> {
  const supabase = await createClient()

  const { data: questions, error: questionsError } = await supabase
    .from('round_questions')
    .select('id, type, options_json')
    .eq('round_id', roundId)

  if (questionsError || !questions) {
    return { error: 'Không tải được câu hỏi của vòng đánh giá' }
  }

  const questionsForValidation: QuestionForValidation[] = questions.map((q) => ({
    id: q.id,
    type: q.type,
    options: q.options_json,
  }))

  const schema = buildAnswersSchema(questionsForValidation)
  const parsed = schema.safeParse(answers)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const answersArray = questionsForValidation.map((q) => ({
    question_id: q.id,
    value: parsed.data[q.id as keyof typeof parsed.data],
  }))

  const { error } = await supabase.rpc('submit_response', {
    p_round_id: roundId,
    p_target_id: targetId,
    p_answers_json: answersArray,
  })

  if (error) {
    return { error: error.message }
  }

  return { data: true }
}
```

- [ ] **Step 2: Response form (renders rating/multiple_choice/text per question)**

Create `components/rounds/response-form.tsx`:

```tsx
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
```

- [ ] **Step 3: Add the shadcn `textarea` component**

Run: `npx shadcn@latest add textarea --yes`
Expected: creates `components/ui/textarea.tsx`.

- [ ] **Step 4: Review page**

Create `app/rounds/[roundId]/review/[targetId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResponseForm } from '@/components/rounds/response-form'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ roundId: string; targetId: string }>
}) {
  const { roundId, targetId } = await params
  const supabase = await createClient()

  const { data: round } = await supabase.from('rounds').select('id, title').eq('id', roundId).maybeSingle()
  if (!round) notFound()

  const { data: questions } = await supabase
    .from('round_questions')
    .select('id, type, prompt, options_json')
    .eq('round_id', roundId)
    .order('order_index', { ascending: true })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{round.title}</h1>
      <ResponseForm roundId={roundId} targetId={targetId} questions={questions ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds; `/rounds/[roundId]/review/[targetId]` listed in route output.

Run: `npm run test`
Expected: all 33 tests (20 from Day 1 + 13 from Day 2 Tasks 1-2) still pass.

- [ ] **Step 6: Commit**

```bash
git add app/rounds/[roundId]/review components/rounds/response-form.tsx components/ui/textarea.tsx
git commit -m "feat: add submission review form calling submit_response RPC"
```

---

## End of Day 2

At this point: `npm run build` succeeds, `npm run test` passes (33 tests), and every Day 2 roadmap item in `candor-project.md` (§1 Roadmap → "Ngày 2") has corresponding routes/actions: round + question creation, the submission flow (atomic, structurally anonymous via `submit_response`), and close logic (manual + deadline-based, computed via `getEffectiveStatus`). Day 3 (report page, dashboard progress polish, i18n, deploy) is a separate plan — write it once Day 2 is verified end-to-end against a live Supabase project (run `supabase/schema.sql` first; see `supabase/README.md`).
