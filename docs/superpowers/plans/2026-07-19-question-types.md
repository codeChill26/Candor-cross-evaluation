# Question Types Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Candor rounds from 3 question types to 7 (paragraph, short text, rating 1–5, checkbox, multiple choice, dropdown, NPS 0–10), with a per-question "required" toggle, question reordering, dynamic options, and a per-question report view that renders custom bar charts for quantitative types and grouped answer cards for free-text.

**Architecture:** The question `type` union drives everything. A single new column (`required`) plus new allowed `type` values are the only DB changes; answers stay in the existing `answers_json` jsonb (checkbox stores an array). Aggregation collapses `multiple_choice`/`dropdown` into one "choice" shape and adds "checkbox"/"nps" shapes. Charts are hand-drawn with CSS/flex bars — no chart library. The type picker and the `dropdown` answer input use a native styled `<select>`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, react-hook-form + zod v4, Supabase (Postgres + RLS), Tailwind v4, Vitest.

## Global Constraints

- Next.js 16 — `proxy.ts` not `middleware.ts`; read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- zod v4, shadcn/Base UI (not Radix). No new npm dependencies (charts are hand-drawn; type picker is native `<select>`).
- Anonymity is structural: `responses` has NO reviewer column. Do not add one. Aggregation must never expose reviewer identity.
- UI copy is Vietnamese.
- Every question type must work in BOTH team rounds (`components/rounds/create-round-form.tsx`) and guest/demo rounds (`components/rounds/create-open-round-form.tsx`) — they share `QuestionBuilder`.
- Legacy `text` type stays valid and renders/aggregates identically to `paragraph`.

---

## Data Model (the contract every task depends on)

**`round_questions.type`** ∈ `paragraph | short_text | rating | checkbox | multiple_choice | dropdown | nps | text (legacy)`

| type | options_json | min_value / max_value | answer `value` in answers_json |
|---|---|---|---|
| `paragraph` | null | null | string |
| `short_text` | null | null | string |
| `rating` | null | 1 / 5 | number 1–5 |
| `checkbox` | string[] | null | string[] (chosen options) |
| `multiple_choice` | string[] | null | string (one option) |
| `dropdown` | string[] | null | string (one option) |
| `nps` | null | 0 / 10 | number 0–10 |
| `text` (legacy) | null | null | string |

**`round_questions.required`** — `boolean not null default true`.

**answers_json** — unchanged shape: `[{ question_id: string, value: string | number | string[] }]`. Unanswered OPTIONAL questions are omitted from the array entirely.

---

## File Structure

- **Modify** `supabase/schema.sql` — extend `type` CHECK, add `required` column (for fresh installs).
- **Create** `supabase/catchup-migration-questions.sql` — idempotent migration for the existing DB.
- **Modify** `lib/validations/round.ts` — 7-type discriminated union, `required` field, `buildAnswersSchema` per type.
- **Modify** `components/rounds/question-builder.tsx` — `<select>` type picker (emoji+name), required toggle, up/down reorder, dynamic options (2–10).
- **Modify** `components/rounds/response-form.tsx` — render input per type, respect `required`.
- **Modify** `lib/report/aggregate.ts` — `choice`/`checkbox`/`nps` aggregates; text grouping.
- **Create** `components/reports/bar-chart.tsx` — hand-drawn horizontal bars.
- **Create** `components/reports/question-report.tsx` — one section per question (chart or text cards).
- **Modify** `components/reports/report-summary.tsx` — render via `question-report`.
- **Modify** `app/rounds/[roundId]/report/page.tsx` — pass `required`/`options` through; group text answers per question.
- **Modify** `app/teams/[teamId]/rounds/actions.ts`, `app/rounds/new/actions.ts` — insert `required` + `options_json`/min/max for new types.
- **Modify** `app/rounds/[roundId]/review/[targetId]/actions.ts` — build answersArray skipping empty optional answers.
- **Tests** `tests/lib/round-validations.test.ts`, `tests/lib/aggregate.test.ts` — extend.

---

### Task 1: DB migration — new types + `required` column

**Files:**
- Modify: `supabase/schema.sql` (round_questions table + type CHECK)
- Create: `supabase/catchup-migration-questions.sql`

**Interfaces:**
- Produces: `round_questions.type` accepts the 7 new values + legacy `text`; `round_questions.required boolean not null default true`.

- [ ] **Step 1:** In `supabase/schema.sql`, change the `round_questions.type` CHECK to `check (type in ('paragraph','short_text','rating','checkbox','multiple_choice','dropdown','nps','text'))` and add `required boolean not null default true` after `order_index`.

- [ ] **Step 2:** Create `supabase/catchup-migration-questions.sql` (idempotent):

```sql
-- Question-types expansion: extend type CHECK + add required column.
-- Run once in the Supabase SQL Editor. Safe to re-run.
alter table public.round_questions
  drop constraint if exists round_questions_type_check;
alter table public.round_questions
  add constraint round_questions_type_check
  check (type in ('paragraph','short_text','rating','checkbox','multiple_choice','dropdown','nps','text'));
alter table public.round_questions
  add column if not exists required boolean not null default true;
```

- [ ] **Step 3:** Verify locally against the live DB with the service-role probe (PostgREST OpenAPI) that `round_questions` now lists `required`. (Manual: user runs the SQL; agent probes.)

- [ ] **Step 4:** Commit: `git add supabase/schema.sql supabase/catchup-migration-questions.sql && git commit -m "feat(db): allow 7 question types + required column"`

---

### Task 2: Validation schema (`lib/validations/round.ts`)

**Files:**
- Modify: `lib/validations/round.ts`
- Test: `tests/lib/round-validations.test.ts`

**Interfaces:**
- Produces:
  - `roundQuestionSchema` — discriminated union over the 7 types; every member has `prompt: string` and `required: boolean`. Choice members (`checkbox`/`multiple_choice`/`dropdown`) have `options: string[]` (transform-trimmed, 2–10). `rating`/`nps`/`paragraph`/`short_text` have no options.
  - `QUESTION_TYPES: { value: QuestionType; label: string; emoji: string }[]` — ordered list for the picker.
  - `buildAnswersSchema(questions)` where `questions: { id; type; options: string[] | null; required: boolean }[]` → `z.object` keyed by question id. Required questions validate strictly; optional questions are `.optional()`.

- [ ] **Step 1:** Add the type list constant:

```ts
export type QuestionType =
  | 'paragraph' | 'short_text' | 'rating' | 'checkbox'
  | 'multiple_choice' | 'dropdown' | 'nps'

export const QUESTION_TYPES: { value: QuestionType; label: string; emoji: string }[] = [
  { value: 'paragraph', label: 'Đoạn văn', emoji: '📝' },
  { value: 'short_text', label: 'Trả lời ngắn', emoji: '✏️' },
  { value: 'rating', label: 'Chấm điểm 1–5', emoji: '⭐' },
  { value: 'checkbox', label: 'Checkbox (chọn nhiều)', emoji: '☑️' },
  { value: 'multiple_choice', label: 'Trắc nghiệm', emoji: '🔘' },
  { value: 'dropdown', label: 'Dropdown', emoji: '📋' },
  { value: 'nps', label: 'NPS 0–10', emoji: '🎯' },
]
```

- [ ] **Step 2:** Write the discriminated union. Shared: `prompt: z.string().min(1,'Câu hỏi không được để trống').max(300)`, `required: z.boolean()`. Reusable options schema (2–10, trim + drop blanks via `.transform().refine()` — the pattern already proven in this repo):

```ts
const optionsSchema = z
  .array(z.string().max(100, 'Lựa chọn tối đa 100 ký tự'))
  .transform((arr) => arr.map((o) => o.trim()).filter((o) => o.length > 0))
  .refine((a) => a.length >= 2, 'Cần ít nhất 2 lựa chọn')
  .refine((a) => a.length <= 10, 'Tối đa 10 lựa chọn')

const base = { prompt: z.string().min(1,'Câu hỏi không được để trống').max(300), required: z.boolean() }

export const roundQuestionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), ...base }),
  z.object({ type: z.literal('short_text'), ...base }),
  z.object({ type: z.literal('rating'), ...base }),
  z.object({ type: z.literal('nps'), ...base }),
  z.object({ type: z.literal('checkbox'), ...base, options: optionsSchema }),
  z.object({ type: z.literal('multiple_choice'), ...base, options: optionsSchema }),
  z.object({ type: z.literal('dropdown'), ...base, options: optionsSchema }),
])
```

- [ ] **Step 3:** Rewrite `buildAnswersSchema` to key by type + required:

```ts
type AnswerQuestion = { id: string; type: QuestionType | 'text'; options: string[] | null; required: boolean }

export function buildAnswersSchema(questions: AnswerQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const q of questions) {
    let s: z.ZodTypeAny
    if (q.type === 'rating') s = z.number().int().min(1).max(5)
    else if (q.type === 'nps') s = z.number().int().min(0).max(10)
    else if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      const opts = q.options ?? []
      s = z.enum(opts as [string, ...string[]])
    } else if (q.type === 'checkbox') {
      const opts = q.options ?? []
      s = z.array(z.enum(opts as [string, ...string[]])).min(q.required ? 1 : 0)
    } else s = z.string().min(1, 'Vui lòng nhập câu trả lời').max(2000) // paragraph/short_text/text
    shape[q.id] = q.required ? s : s.optional()
  }
  return z.object(shape)
}
```

- [ ] **Step 4:** Extend `tests/lib/round-validations.test.ts` — cases: optional MC blank options passes; required checkbox with 0 selected fails; optional checkbox with 0 passes; nps 11 fails, 10 passes; rating 6 fails; dropdown value not in options fails; 11 options fails, 10 passes. Run `npx vitest run tests/lib/round-validations.test.ts` → PASS.

- [ ] **Step 5:** `npx tsc --noEmit` → exit 0. Commit: `git commit -m "feat(validation): 7 question types + required + per-type answer schema"`

---

### Task 3: Question builder UI (`components/rounds/question-builder.tsx`)

**Files:**
- Modify: `components/rounds/question-builder.tsx`

**Interfaces:**
- Consumes: `QUESTION_TYPES`, `QuestionType` from Task 2. `useFieldArray` from react-hook-form (already used).
- Produces: builder that appends `{ type, prompt: '', required: true, ...(choice ? { options: ['',''] } : {}) }`, supports `move(from,to)` for reorder, `remove(i)`, a `required` checkbox per question, and dynamic options (add/remove, 2–10) for choice types.

- [ ] **Step 1:** Replace the three "+ Câu hỏi …" buttons with a native `<select>` (styled with the same classes as `Input`) bound to local state `pendingType`, plus a "+ Thêm câu hỏi" button that calls `append(defaultsFor(pendingType))`. `defaultsFor` returns options `['', '']` only for `checkbox|multiple_choice|dropdown`.

- [ ] **Step 2:** In each question card header show `Câu {i+1} — {emoji} {label}`, and add up/down buttons (`useFieldArray().move(i, i-1)` / `move(i, i+1)`, disabled at ends) + the existing Xóa.

- [ ] **Step 3:** Add a `required` toggle per card: a checkbox `{...register(\`questions.${i}.required\`)}` labelled "Bắt buộc trả lời" (default checked).

- [ ] **Step 4:** Replace the fixed 4-input `MultipleChoiceOptions` with a dynamic list driven by a nested `useFieldArray({ name: \`questions.${index}.options\` })`: render each option `Input` with a remove "×" (disabled when ≤2), and a "+ Thêm lựa chọn" button (disabled at 10). Use for `checkbox|multiple_choice|dropdown`.

- [ ] **Step 5:** Browser-verify on `http://localhost:3005/rounds/new`: add one of each type, set some optional, reorder, add/remove options, submit → round created (check via service-role probe that types + required persisted). No console errors.

- [ ] **Step 6:** Commit: `git commit -m "feat(ui): question-type dropdown, required toggle, reorder, dynamic options"`

---

### Task 4: Response form (`components/rounds/response-form.tsx`)

**Files:**
- Modify: `components/rounds/response-form.tsx`

**Interfaces:**
- Consumes: questions `{ id; type; prompt; options_json; required }`.
- Produces: `answers` record → `value` per Data Model; optional-unanswered keys left unset.

- [ ] **Step 1:** Render per type: `paragraph`→Textarea; `short_text`→Input; `rating`→1–5 buttons (existing); `nps`→0–10 buttons (same pattern, wrap on mobile); `multiple_choice`→single-select buttons (existing); `dropdown`→native `<select>`; `checkbox`→multi-toggle buttons (clicking toggles membership in a `string[]`). Show "*(không bắt buộc)*" hint when `!required`.

- [ ] **Step 2:** Validate on submit with `buildAnswersSchema` (client-side mirror) or rely on server; keep the current server-RPC path. Ensure checkbox value is `string[]`.

- [ ] **Step 3:** Browser-verify: answer a round with all 7 types (leave optional blank) → submit succeeds; leaving a REQUIRED one blank → blocked with message.

- [ ] **Step 4:** Commit: `git commit -m "feat(ui): response inputs for all 7 question types"`

---

### Task 5: Aggregation (`lib/report/aggregate.ts`)

**Files:**
- Modify: `lib/report/aggregate.ts`
- Test: `tests/lib/aggregate.test.ts`

**Interfaces:**
- Produces `AggregateResult` union:
  - `{ type:'text', prompt, answers: string[] }` (paragraph/short_text/text)
  - `{ type:'rating', prompt, average, count, distribution: number[] }` (index 0→score1 … 4→score5)
  - `{ type:'choice', prompt, counts: { option: string; count: number }[], total }` (multiple_choice + dropdown)
  - `{ type:'checkbox', prompt, counts: { option: string; count: number }[], respondents }`
  - `{ type:'nps', prompt, average, count, score, distribution: number[] }` (distribution index 0→0 … 10→10; `score` = round(%promoters(9–10) − %detractors(0–6)))

- [ ] **Step 1:** Update `ReportQuestion.type` to `QuestionType | 'text'` and `ReportAnswer.value` to `number | string | string[]`.

- [ ] **Step 2:** Implement each branch. Choice: tally string values into ordered `counts` seeded from `q.options`. Checkbox: for each response whose value is an array, increment each chosen option; `respondents` = count of responses that answered. NPS: `average` = mean; `score` = `Math.round(((prom - det) / count) * 100)` with prom = values ≥9, det = values ≤6.

- [ ] **Step 3:** Extend `tests/lib/aggregate.test.ts`: checkbox counts across arrays; nps score (e.g. values [10,9,6,0] → prom 2, det 2, count 4 → 0); dropdown aggregates like choice; rating distribution. Run → PASS.

- [ ] **Step 4:** `npx tsc --noEmit` → 0. Commit: `git commit -m "feat(report): aggregate choice/checkbox/nps + text grouping"`

---

### Task 6: Report UI + charts

**Files:**
- Create: `components/reports/bar-chart.tsx`
- Create: `components/reports/question-report.tsx`
- Modify: `components/reports/report-summary.tsx`
- Modify: `app/rounds/[roundId]/report/page.tsx`

**Interfaces:**
- Consumes: `AggregateResult` from Task 5.
- `BarChart({ rows }: { rows: { label: string; value: number; max: number; caption?: string }[] })` → horizontal flex bars using `bg-primary` fill at `width: value/max*100%`.

- [ ] **Step 1:** Build `BarChart` (pure CSS/flex; no deps): each row = label + track + fill + `caption` (e.g. `3 (60%)`).

- [ ] **Step 2:** Build `QuestionReport` switching on `result.type`: `rating`→average badge + distribution BarChart(1–5); `choice`/`checkbox`→BarChart of option counts (%) + "N người trả lời"; `nps`→big average + NPS score + distribution BarChart(0–10); `text`→each answer in its own bordered card (`ResponseCard`-style), shuffled.

- [ ] **Step 3:** Update `report-summary.tsx` to map aggregates → `QuestionReport`. Update `report/page.tsx` to pass `options_json`/`required`, and remove the old separate "từng phản hồi riêng lẻ" section (text answers now live under their own question). Keep the "<4 người" anonymity warning.

- [ ] **Step 4:** Browser-verify a closed round end-to-end: charts render for quantitative, text shows per-question boxes. No console errors.

- [ ] **Step 5:** Commit: `git commit -m "feat(report): per-question view with hand-drawn charts"`

---

### Task 7: Wire server actions

**Files:**
- Modify: `app/teams/[teamId]/rounds/actions.ts`, `app/rounds/new/actions.ts`
- Modify: `app/rounds/[roundId]/review/[targetId]/actions.ts`

**Interfaces:**
- Consumes: parsed question with `required` + typed options.

- [ ] **Step 1:** In both create actions, build `questionRows` with `required: q.required`, `options_json` for `checkbox|multiple_choice|dropdown` (else null), `min_value/max_value` = 1/5 for rating, 0/10 for nps (else null).

- [ ] **Step 2:** In `submitResponse`, load questions with `required`; build `answersArray` including ONLY questions whose parsed value is defined (skip omitted optional). Keep the `submit_response` RPC call unchanged.

- [ ] **Step 3:** `npx tsc --noEmit` → 0; `npx vitest run` → all pass. Commit: `git commit -m "feat: wire required + typed options through create/submit"`

---

### Task 8: Migration run + full verification

- [ ] **Step 1:** Ask the user to run `supabase/catchup-migration-questions.sql` in the SQL Editor; probe the live DB to confirm `required` column + new type accepted.
- [ ] **Step 2:** Drive the full flow in the browser (guest demo, all 7 types, some optional): create → join (2nd guest) → start → review → close → report. Confirm charts + per-question text boxes.
- [ ] **Step 3:** Final `npx tsc --noEmit` + `npx vitest run`. Commit any fixups.

---

## Self-Review Notes

- **Coverage:** 7 types ✓ (Task 2/3/4/5/6); required toggle ✓ (Task 1 col, 2 schema, 3 UI, 5/7 wiring); reorder ✓ (Task 3); dynamic options 2–10 ✓ (Task 2/3); charts ✓ (Task 6); per-question text boxes ✓ (Task 6); NPS score ✓ (Task 5); applies to team+guest ✓ (shared QuestionBuilder). Migration ✓ (Task 1/8).
- **Type consistency:** `QuestionType` (Task 2) reused in aggregate (Task 5) and UI. Aggregate variant names `text|rating|choice|checkbox|nps` are the switch keys in `QuestionReport` (Task 6). `multiple_choice`+`dropdown` both map to `choice`.
- **Legacy `text`:** allowed in CHECK (Task 1), treated as paragraph in `buildAnswersSchema` (Task 2) and aggregates to `text` (Task 5).
- **Anonymity:** no reviewer column touched; text cards shuffled (Task 6).
