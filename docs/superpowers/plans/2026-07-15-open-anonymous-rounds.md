# Open (Guest) Evaluation Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone start an evaluation round and share a link — participants (including the creator) join by typing a display name only, no account. Minimum 2 participants to start review; no maximum.

**Architecture:** Guests are real Supabase Auth users created via `signInAnonymously()` — invisible to them, but a real `auth.uid()` — so the existing rounds/review/report/anonymity machinery works almost unchanged. `rounds.team_id` becomes nullable (null = open round, same convention as `team_invites.email` null = open invite). A new `collecting` status is the join-by-name waiting phase before the creator locks the roster and starts review.

**Tech Stack:** Next.js 16.2.10 (App Router, Server Actions, Server Components), `@supabase/supabase-js` (`signInAnonymously`), `@supabase/ssr`, zod v4, react-hook-form, Vitest, Vietnamese UI copy.

## Global Constraints

- No parallel guest-identity system — every guest is a real (anonymous) Supabase Auth user. Never build custom session tokens for this feature.
- `rounds.team_id` nullable; `team_id is null` means "open round" everywhere in the codebase (queries, RLS, routing).
- New `collecting` status sits between round creation and `open`; only open rounds ever use it (team rounds are still created directly as `open`, unchanged).
- Every new RLS policy is additive — no existing policy in `schema.sql` is modified or dropped.
- Minimum 2 `round_participants` required before a creator can start review; no maximum enforced anywhere.
- The creator is a normal participant (reviews and is reviewed) — never given a bypass from `submit_response()`'s rules.
- No recovery path if a guest loses their browser session — this is an accepted limitation of the tier, not a bug to fix.
- All new imports use the `@/` path alias. All user-facing copy is Vietnamese, matching existing tone (see `components/marketing/landing-page.tsx`, `components/teams/join-confirm.tsx`).
- New unit tests live under `tests/lib/`, extending existing files where the source file already has one (`tests/lib/round-status.test.ts`, `tests/lib/round-validations.test.ts`) rather than creating parallel files.
- No unit tests for server actions or components in this plan — this repo has none for the equivalent team-mode files (`app/teams/[teamId]/rounds/actions.ts`, `components/rounds/create-round-form.tsx`, etc.) since they need a live Supabase connection or a browser; Task 9 covers this feature end-to-end manually instead.
- This repo runs `schema.sql` by hand in the Supabase SQL Editor (no migration tool) — Task 1 must be run against the live project before any other task can be manually verified.

---

### Task 1: Schema migration — nullable columns, `collecting` status, new RLS policies

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: `rounds.team_id` (nullable), `rounds.status` accepting `'collecting'`, `profiles.email` (nullable), and six new RLS policies — every later task's queries and inserts depend on these existing in the live database.

- [ ] **Step 1: Append the migration to `supabase/schema.sql`**

Add this new section at the end of the file (after the `submit_response` grant), keeping every existing line above untouched:

```sql

-- ============================================================
-- 5. Open (guest) evaluation rounds
-- ============================================================
-- Guests are real Supabase Auth users created via signInAnonymously() —
-- invisible to them, but a real auth.uid() — so every rule below is
-- additive to the existing policies, never a replacement. team_id is
-- null means "open round" everywhere (same convention as
-- team_invites.email null = open invite link).

alter table public.rounds
  alter column team_id drop not null;

alter table public.rounds
  drop constraint rounds_status_check,
  add constraint rounds_status_check
    check (status in ('draft', 'collecting', 'open', 'closed'));

alter table public.profiles
  alter column email drop not null;

-- A guest can see an open round once they've joined it as a participant.
create policy "rounds_select_open_participant"
  on public.rounds for select
  to authenticated
  using (
    team_id is null
    and exists (
      select 1 from public.round_participants
      where round_participants.round_id = rounds.id
        and round_participants.user_id = auth.uid()
    )
  );

-- Anyone authenticated (incl. anonymous) can create an open round for themselves.
create policy "rounds_insert_open"
  on public.rounds for insert
  to authenticated
  with check (created_by = auth.uid() and team_id is null);

-- Self-service join: insert your own row while the round is still collecting.
create policy "round_participants_insert_self_when_collecting"
  on public.round_participants for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.rounds
      where rounds.id = round_participants.round_id
        and rounds.team_id is null
        and rounds.status = 'collecting'
    )
  );

-- Open-round participants can see the rest of the roster (needed to build
-- their own reviewer/target list, same purpose as the team-mode policy).
create policy "round_participants_select_open_participant"
  on public.round_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.rounds
      where rounds.id = round_participants.round_id and rounds.team_id is null
    )
    and exists (
      select 1 from public.round_participants rp2
      where rp2.round_id = round_participants.round_id and rp2.user_id = auth.uid()
    )
  );

-- Open-round participants can see the question set once they're in the roster.
create policy "round_questions_select_open_participant"
  on public.round_questions for select
  to authenticated
  using (
    exists (
      select 1 from public.rounds
      join public.round_participants on round_participants.round_id = rounds.id
      where rounds.id = round_questions.round_id
        and rounds.team_id is null
        and round_participants.user_id = auth.uid()
    )
  );

-- Fellow open-round participants can resolve each other's display names
-- (team-mode equivalent is profiles_select_self_or_teammate, which requires
-- a shared team_members row — guests have none).
create policy "profiles_select_open_round_co_participant"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.round_participants rp1
      join public.round_participants rp2 on rp1.round_id = rp2.round_id
      join public.rounds on rounds.id = rp1.round_id
      where rp1.user_id = auth.uid()
        and rp2.user_id = profiles.id
        and rounds.team_id is null
    )
  );
```

- [ ] **Step 2: Run this migration against the live Supabase project**

Supabase Dashboard → SQL Editor → paste just the new section from Step 1 (not the whole file) → Run.
Expected: no errors. If `rounds_status_check` doesn't exist under that exact name (Postgres auto-names check constraints unless named explicitly — this one was created inline in the original `create table`), run this first to find its real name, then substitute it into the `drop constraint` line:

```sql
select conname from pg_constraint
where conrelid = 'public.rounds'::regclass and contype = 'c';
```

- [ ] **Step 3: Verify with a read-only check**

Run in the SQL Editor:

```sql
select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'rounds' and column_name = 'team_id';
```

Expected: `is_nullable = 'YES'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add schema support for open (guest) evaluation rounds"
```

---

### Task 2: `collecting` status in `RoundStatus` (TDD)

**Files:**
- Modify: `lib/utils/round-status.ts`
- Modify: `tests/lib/round-status.test.ts`

**Interfaces:**
- Produces: `RoundStatus` now includes `'collecting'` — every later task that reads `rounds.status` types against this union.

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/round-status.test.ts`, inside the existing `describe('getEffectiveStatus', ...)` block:

```ts
  it('returns "collecting" regardless of deadline', () => {
    expect(getEffectiveStatus('collecting', past)).toBe('collecting')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/round-status.test.ts`
Expected: FAIL — TypeScript error, `'collecting'` is not assignable to `RoundStatus`.

- [ ] **Step 3: Update `lib/utils/round-status.ts`**

```ts
export type RoundStatus = 'draft' | 'collecting' | 'open' | 'closed'

export function getEffectiveStatus(status: RoundStatus, deadline: string): RoundStatus {
  if (status === 'open' && new Date(deadline).getTime() < Date.now()) {
    return 'closed'
  }
  return status
}
```

(No logic change — `collecting` simply isn't `'open'`, so it passes through unchanged, same as `'draft'` does today.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/round-status.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/utils/round-status.ts tests/lib/round-status.test.ts
git commit -m "feat: add collecting status to RoundStatus"
```

---

### Task 3: Display name + open-round validation schemas (TDD)

**Files:**
- Modify: `lib/validations/round.ts`
- Modify: `tests/lib/round-validations.test.ts`

**Interfaces:**
- Consumes: `createRoundSchema` (existing, same file).
- Produces: `export const displayNameSchema: z.ZodString`, `export const createOpenRoundSchema: ReturnType<typeof createRoundSchema.extend>`, `export type CreateOpenRoundInput = z.infer<typeof createOpenRoundSchema>` — Task 5's form and Task 4's action both import these.

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/round-validations.test.ts`:

```ts
import { displayNameSchema, createOpenRoundSchema } from '@/lib/validations/round'

describe('displayNameSchema', () => {
  it('accepts a normal name', () => {
    expect(displayNameSchema.safeParse('Nguyễn Văn A').success).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false)
  })

  it('rejects a name over 50 characters', () => {
    expect(displayNameSchema.safeParse('a'.repeat(51)).success).toBe(false)
  })
})

describe('createOpenRoundSchema', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  it('accepts round fields plus a display name', () => {
    const result = createOpenRoundSchema.safeParse({
      displayName: 'Nguyễn Văn A',
      title: 'Đánh giá dự án nhóm',
      deadline: future,
      questions: [{ type: 'text', prompt: 'Góp ý?' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing display name', () => {
    const result = createOpenRoundSchema.safeParse({
      title: 'Đánh giá dự án nhóm',
      deadline: future,
      questions: [{ type: 'text', prompt: 'Góp ý?' }],
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/round-validations.test.ts`
Expected: FAIL — `displayNameSchema`/`createOpenRoundSchema` are not exported.

- [ ] **Step 3: Add the schemas to `lib/validations/round.ts`**

Append to the end of the file:

```ts
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Nhập tên hiển thị')
  .max(50, 'Tối đa 50 ký tự')

export const createOpenRoundSchema = createRoundSchema.extend({
  displayName: displayNameSchema,
})

export type CreateOpenRoundInput = z.infer<typeof createOpenRoundSchema>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/round-validations.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/validations/round.ts tests/lib/round-validations.test.ts
git commit -m "feat: add display name and open-round validation schemas"
```

---

### Task 4: Let unauthenticated visitors reach the two new open-round routes

**Files:**
- Modify: `lib/supabase/proxy.ts`

**Interfaces:**
- Produces: `/rounds/new` and `/rounds/<any-id>/join` no longer redirect an unauthenticated visitor to `/login` — Task 5 and Task 6's pages depend on this (both must render for a visitor with no session at all).

- [ ] **Step 1: Add the open-round path check**

Replace the full contents of `lib/supabase/proxy.ts` with:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATH_PREFIXES = ['/login', '/register', '/auth', '/join']

function isPublicOpenRoundPath(pathname: string): boolean {
  return pathname === '/rounds/new' || /^\/rounds\/[^/]+\/join$/.test(pathname)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicPath =
    pathname === '/' ||
    PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p)) ||
    isPublicOpenRoundPath(pathname)

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `lib/supabase/proxy.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/proxy.ts
git commit -m "feat: allow unauthenticated visitors to reach open-round create/join routes"
```

---

### Task 5: Creator flow — `createOpenRound` action, form, page

**Files:**
- Create: `app/rounds/new/actions.ts`
- Create: `components/rounds/create-open-round-form.tsx`
- Create: `app/rounds/new/page.tsx`

**Interfaces:**
- Consumes: `createRoundSchema`, `type CreateRoundInput` (existing), `createOpenRoundSchema`, `type CreateOpenRoundInput`, `displayNameSchema` (Task 3), `QuestionBuilder` (existing, `components/rounds/question-builder.tsx`).
- Produces: `export async function createOpenRound(displayName: string, input: CreateRoundInput): Promise<{ error: string } | { data: { id: string } }>` — Task 7's flow eventually lands participants on the round this creates; `export function CreateOpenRoundForm(): JSX.Element`.

- [ ] **Step 1: Create `app/rounds/new/actions.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createRoundSchema, type CreateRoundInput } from '@/lib/validations/round'

type CreateOpenRoundResult = { error: string } | { data: { id: string } }

export async function createOpenRound(
  displayName: string,
  input: CreateRoundInput
): Promise<CreateOpenRoundResult> {
  const parsed = createRoundSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously({
    options: { data: { full_name: displayName } },
  })
  if (signInError || !signInData.user) {
    return { error: signInError?.message ?? 'Không thể tạo phiên tham gia' }
  }
  const user = signInData.user

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      team_id: null,
      title: parsed.data.title,
      deadline: new Date(parsed.data.deadline).toISOString(),
      created_by: user.id,
      status: 'collecting',
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

  const { error: participantError } = await supabase
    .from('round_participants')
    .insert({ round_id: round.id, user_id: user.id })
  if (participantError) {
    return { error: participantError.message }
  }

  return { data: { id: round.id } }
}
```

- [ ] **Step 2: Create `components/rounds/create-open-round-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
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
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOpenRoundInput>({
    resolver: zodResolver(createOpenRoundSchema),
    defaultValues: {
      displayName: '',
      title: '',
      deadline: '',
      questions: [{ type: 'text', prompt: '' }],
    },
  })

  async function onSubmit(values: CreateOpenRoundInput) {
    setServerError(null)
    const { displayName, ...roundInput } = values
    const cleaned = {
      ...roundInput,
      questions: roundInput.questions.map((q) =>
        q.type === 'multiple_choice'
          ? { ...q, options: q.options.map((o) => o.trim()).filter((o) => o.length > 0) }
          : q
      ),
    }
    const result = await createOpenRound(displayName, cleaned)
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
      <QuestionBuilder control={roundControl} register={roundRegister} errors={roundErrors} />
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Đang tạo...' : 'Tạo vòng đánh giá'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/rounds/new/page.tsx`**

```tsx
import { CreateOpenRoundForm } from '@/components/rounds/create-open-round-form'

export default function NewOpenRoundPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Tạo đánh giá nhanh</h1>
        <p className="text-sm text-muted-foreground">
          Không cần tài khoản. Bạn cũng sẽ tham gia đánh giá cùng mọi người bạn mời.
        </p>
      </div>
      <CreateOpenRoundForm />
    </div>
  )
}
```

- [ ] **Step 4: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning any file from this task.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 5: Commit**

```bash
git add "app/rounds/new/actions.ts" "app/rounds/new/page.tsx" components/rounds/create-open-round-form.tsx
git commit -m "feat: add open round creator flow (anonymous sign-in + create form)"
```

---

### Task 6: Join flow — `joinOpenRound` action, form, page

**Files:**
- Create: `app/rounds/[roundId]/join/actions.ts`
- Create: `components/rounds/join-open-round-form.tsx`
- Create: `app/rounds/[roundId]/join/page.tsx`

**Interfaces:**
- Consumes: `createAdminClient` (existing, `lib/supabase/admin.ts`), `createClient` (existing, `lib/supabase/server.ts`).
- Produces: `export async function joinOpenRound(roundId: string, displayName: string): Promise<{ error: string } | { data: true }>` — Task 7's `CollectingPanel` links here.

- [ ] **Step 1: Create `app/rounds/[roundId]/join/actions.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

type JoinOpenRoundResult = { error: string } | { data: true }

export async function joinOpenRound(roundId: string, displayName: string): Promise<JoinOpenRoundResult> {
  const supabase = await createClient()
  let {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: displayName } },
    })
    if (signInError || !signInData.user) {
      return { error: signInError?.message ?? 'Không thể tham gia' }
    }
    user = signInData.user
  }

  const { error: participantError } = await supabase
    .from('round_participants')
    .insert({ round_id: roundId, user_id: user.id })

  if (participantError) {
    if (participantError.code === '23505') {
      // unique(round_id, user_id) — already joined, treat as success
      return { data: true }
    }
    return { error: participantError.message }
  }

  return { data: true }
}
```

- [ ] **Step 2: Create `components/rounds/join-open-round-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { joinOpenRound } from '@/app/rounds/[roundId]/join/actions'

export function JoinOpenRoundForm({
  roundId,
  existingName,
}: {
  roundId: string
  existingName: string | null
}) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!existingName && displayName.trim().length === 0) {
      setError('Nhập tên hiển thị')
      return
    }
    setPending(true)
    setError(null)
    const result = await joinOpenRound(roundId, displayName.trim())
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(`/rounds/${roundId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {existingName ? (
        <p className="text-sm">
          Bạn sẽ tham gia với tên: <strong>{existingName}</strong>
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="join-display-name">Tên hiển thị của bạn</Label>
          <Input
            id="join-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang tham gia...' : 'Tham gia'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/rounds/[roundId]/join/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { JoinOpenRoundForm } from '@/components/rounds/join-open-round-form'

export default async function JoinOpenRoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  const admin = createAdminClient()

  const { data: round } = await admin
    .from('rounds')
    .select('title, status, team_id')
    .eq('id', roundId)
    .maybeSingle()

  if (!round || round.team_id !== null) {
    notFound()
  }
  if (round.status !== 'collecting') {
    return (
      <p className="mx-auto mt-24 max-w-sm text-sm text-muted-foreground">
        Vòng đánh giá này không còn nhận người tham gia mới.
      </p>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let existingName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    existingName = profile?.full_name ?? null
  }

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Tham gia: {round.title}</h1>
      <JoinOpenRoundForm roundId={roundId} existingName={existingName} />
    </div>
  )
}
```

- [ ] **Step 4: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning any file from this task.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 5: Commit**

```bash
git add "app/rounds/[roundId]/join/actions.ts" "app/rounds/[roundId]/join/page.tsx" components/rounds/join-open-round-form.tsx
git commit -m "feat: add open round join flow (display name only)"
```

---

### Task 7: Start flow, collecting-phase UI, and the nullable-email display fix

**Files:**
- Create: `app/rounds/[roundId]/start-actions.ts`
- Create: `components/rounds/collecting-panel.tsx`
- Modify: `app/rounds/[roundId]/page.tsx`
- Modify: `components/rounds/target-list.tsx`

**Interfaces:**
- Consumes: `getEffectiveStatus` (existing, now typed with `collecting`, Task 2).
- Produces: `export async function startRound(roundId: string): Promise<{ error: string } | { data: true }>`; `export function CollectingPanel(props): JSX.Element`.

- [ ] **Step 1: Create `app/rounds/[roundId]/start-actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type StartRoundResult = { error: string } | { data: true }

export async function startRound(roundId: string): Promise<StartRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('created_by, status')
    .eq('id', roundId)
    .maybeSingle()
  if (!round) {
    return { error: 'Không tìm thấy vòng đánh giá' }
  }
  if (round.created_by !== user.id) {
    return { error: 'Chỉ người tạo vòng mới có thể bắt đầu đánh giá' }
  }
  if (round.status !== 'collecting') {
    return { error: 'Vòng này không ở trạng thái chờ tham gia' }
  }

  const { count } = await supabase
    .from('round_participants')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)
  if ((count ?? 0) < 2) {
    return { error: 'Cần ít nhất 2 người tham gia để bắt đầu' }
  }

  const { error } = await supabase.from('rounds').update({ status: 'open' }).eq('id', roundId)
  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/rounds/${roundId}`)
  return { data: true }
}
```

- [ ] **Step 2: Create `components/rounds/collecting-panel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { startRound } from '@/app/rounds/[roundId]/start-actions'

export function CollectingPanel({
  roundId,
  title,
  participantNames,
  isCreator,
  joinUrl,
}: {
  roundId: string
  title: string
  participantNames: string[]
  isCreator: boolean
  joinUrl: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleStart() {
    setPending(true)
    setError(null)
    const result = await startRound(roundId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Đang chờ người tham gia — chia sẻ link này cho mọi người:
      </p>
      <Input readOnly value={joinUrl} onFocus={(e) => e.currentTarget.select()} />
      <div className="space-y-2">
        <p className="text-sm font-medium">Đã tham gia ({participantNames.length}):</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {participantNames.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {isCreator && (
        <Button onClick={handleStart} disabled={pending || participantNames.length < 2}>
          {pending
            ? 'Đang bắt đầu...'
            : participantNames.length < 2
              ? 'Cần ít nhất 2 người tham gia'
              : 'Bắt đầu đánh giá'}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the `collecting` branch to `app/rounds/[roundId]/page.tsx`**

Replace the full contents of `app/rounds/[roundId]/page.tsx` with:

```tsx
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveStatus } from '@/lib/utils/round-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TargetList } from '@/components/rounds/target-list'
import { CollectingPanel } from '@/components/rounds/collecting-panel'
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

  const isCreator = round.created_by === user?.id

  // Cast: without generated Database types, the embedded `profiles` is
  // typed as an array even though round_participants.user_id -> profiles.id
  // is many-to-one at runtime (same reasoning as the team members page).
  const typedParticipants = (participants ?? []) as unknown as {
    user_id: string
    profiles: { full_name: string | null; email: string | null }
  }[]

  if (round.status === 'collecting') {
    const headersList = await headers()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    const joinUrl = `${protocol}://${host}/rounds/${roundId}/join`

    const names = typedParticipants.map((p) => p.profiles.full_name ?? p.profiles.email ?? 'Ẩn danh')

    return (
      <CollectingPanel
        roundId={roundId}
        title={round.title}
        participantNames={names}
        isCreator={isCreator}
        joinUrl={joinUrl}
      />
    )
  }

  const { data: mySubmissions } = await supabase
    .from('submission_status')
    .select('target_id')
    .eq('round_id', roundId)
    .eq('reviewer_id', user?.id ?? '')

  const reviewedTargetIds = new Set((mySubmissions ?? []).map((s) => s.target_id))

  const targets = typedParticipants
    .filter((p) => p.user_id !== user?.id)
    .map((p) => ({
      userId: p.user_id,
      fullName: p.profiles.full_name,
      email: p.profiles.email,
      reviewed: reviewedTargetIds.has(p.user_id),
    }))

  const effective = getEffectiveStatus(round.status, round.deadline)

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
        <Link href={`/rounds/${roundId}/report`} className="text-primary underline underline-offset-4">
          Xem báo cáo của bạn
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `components/rounds/target-list.tsx` for nullable email**

Replace the full contents of `components/rounds/target-list.tsx` with:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Target = { userId: string; fullName: string | null; email: string | null; reviewed: boolean }

export function TargetList({ roundId, targets }: { roundId: string; targets: Target[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {targets.map((t) => (
        <li key={t.userId} className="flex items-center justify-between p-4">
          <span>{t.fullName ?? t.email ?? 'Ẩn danh'}</span>
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

- [ ] **Step 5: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning any file from this task.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 6: Commit**

```bash
git add "app/rounds/[roundId]/start-actions.ts" "app/rounds/[roundId]/page.tsx" components/rounds/collecting-panel.tsx components/rounds/target-list.tsx
git commit -m "feat: add collecting-phase UI and start-round action"
```

---

### Task 8: Homepage entry point

**Files:**
- Modify: `components/marketing/landing-page.tsx`

- [ ] **Step 1: Add a guest-tier CTA next to the existing hero buttons**

In `components/marketing/landing-page.tsx`, change:

```tsx
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg">Bắt đầu miễn phí</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Đăng nhập
              </Button>
            </Link>
          </div>
```

to:

```tsx
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg">Bắt đầu miễn phí</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Đăng nhập
              </Button>
            </Link>
            <Link href="/rounds/new">
              <Button size="lg" variant="ghost">
                Tạo đánh giá nhanh — không cần tài khoản
              </Button>
            </Link>
          </div>
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `landing-page.tsx`.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 3: Commit**

```bash
git add components/marketing/landing-page.tsx
git commit -m "feat: add homepage entry point for open evaluation rounds"
```

---

### Task 9: Manual end-to-end verification

This task has no new code — it confirms Tasks 1–8 work together as a full guest flow. **Requires Task 1 to have already been run against the live Supabase project.**

**Files:** none.

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: all tests pass, including the new tests from Tasks 2 and 3.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Create an open round (Browser A, no prior session — use a private/incognito window)**

Open `http://localhost:3000/`, click "Tạo đánh giá nhanh — không cần tài khoản". Fill in display name "An", title "Test đánh giá mở", a deadline a few hours out, and one question of each type. Submit.

Expected: lands on `/rounds/<id>` showing the collecting-phase panel with "An" already listed and a join link, "Bắt đầu đánh giá" disabled (only 1 participant).

- [ ] **Step 4: Join from a second identity (Browser B — a different incognito window, not just a new tab)**

Copy the join link from Browser A, open it in Browser B. Enter display name "Bình", submit.

Expected: redirected to `/rounds/<id>`, sees the same collecting panel (no start button — not the creator) listing both "An" and "Bình".

- [ ] **Step 5: Start the round (Browser A)**

Reload Browser A's tab. "Bắt đầu đánh giá" should now be enabled. Click it.

Expected: page now shows the normal open-round target list (one target: the other participant) in both browsers after reload.

- [ ] **Step 6: Submit reviews from both sides**

In Browser A, click "Đánh giá" next to "Bình", fill and submit. In Browser B, do the same for "An".

Expected: both succeed, target list shows "Đã đánh giá" for the reviewed party.

- [ ] **Step 7: Close the round and check reports**

In Browser A (the creator), click "Đóng vòng". Reload both browsers, follow "Xem báo cáo của bạn" in each.

Expected: each side sees a report containing the other's response, with no way to identify who wrote it (matches the existing team-mode report — same components, same anonymity guarantee).

- [ ] **Step 8: Confirm a late join is rejected**

Open a third incognito window, visit the same join link used in Step 4.

Expected: "Vòng đánh giá này không còn nhận người tham gia mới." (round is no longer `collecting`).

No commit for this task (no files changed).
