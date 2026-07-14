# Bulk Email Invite (Resend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a team member invite many people at once by pasting/uploading a list of emails; each valid, eligible address gets a real email (via Resend) containing its own invite link, alongside the existing single-link invite flow.

**Architecture:** A new server action `createBulkInvites` classifies each submitted address (invalid format / already a member / already has a pending invite / eligible), inserts one `team_invites` row per eligible address (same shape the existing `createInvite` already writes), and sends all of them in a single `resend.batch.send` call. The existing `team_invites` schema, RLS policies, and single-link flow are untouched — this is a second, additive path through the same table.

**Tech Stack:** Next.js 16.2.10 (App Router, Server Actions), `resend` (new dependency), `@supabase/supabase-js`, zod v4 (`z.email()`), Vitest, Vietnamese UI copy.

## Global Constraints

- Sender address is `onboarding@resend.dev` (no domain verified yet). Resend blocks this address from sending to anyone but the Resend account's own inbox — this is expected until a domain is verified, not a bug to fix.
- Cap one submit at 100 recipients (`resend.batch.send`'s hard limit) — enforced both client-side (before calling the action) and server-side (defense in depth).
- Best-effort processing: invalid-format, already-member, and already-invited addresses are skipped and reported by category — never block the whole batch.
- No `schema.sql` or RLS changes — existing `team_invites`/`team_members`/`profiles` policies already let any team member read what this feature needs.
- If `resend.batch.send` itself errors, the already-inserted `team_invites` rows are kept (not rolled back) and reported as a distinct "email delivery failed, links still work" case.
- All new imports use the `@/` path alias. All user-facing copy is Vietnamese.
- New unit tests live under `tests/lib/`, mirroring `tests/lib/invite-token.test.ts`.
- `createBulkInvites`'s classification rules are tested as a pure function (`classifyEmails`, Task 3) rather than by mocking the Supabase client — this repo's existing server actions (`createInvite`, `acceptInvite`) have no unit tests at all, since they need a live Supabase connection; the parts of `createBulkInvites` that just wire that pure function to Supabase/Resend calls are covered by manual verification in Task 7 instead.
- `RESEND_API_KEY` is already present in `.env.local` and documented in `.env.local.example`.

---

### Task 1: Resend dependency + client singleton

**Files:**
- Create: `lib/email/resend.ts`
- Modify: `package.json` (via `npm install`)

**Interfaces:**
- Produces: `export const resend: import('resend').Resend` — Task 4's server action imports this to call `resend.batch.send(...)`.

- [ ] **Step 1: Install the `resend` package**

Run: `npm install resend`
Expected: `package.json` and `package-lock.json` gain a `resend` entry.

- [ ] **Step 2: Create `lib/email/resend.ts`**

```ts
import 'server-only'
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY!)
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `lib/email/resend.ts`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/email/resend.ts
git commit -m "feat: add Resend client singleton"
```

---

### Task 2: Invite email content builder (TDD)

**Files:**
- Create: `lib/email/invite-email.ts`
- Test: `tests/lib/invite-email.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export type InviteEmailInput = { teamName: string; inviterName: string; joinUrl: string }`, `export function buildInviteEmailSubject(input: InviteEmailInput): string`, `export function buildInviteEmailHtml(input: InviteEmailInput): string` — Task 4's server action calls both per recipient.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/invite-email.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildInviteEmailSubject, buildInviteEmailHtml } from '@/lib/email/invite-email'

const input = { teamName: 'Marketing', inviterName: 'An', joinUrl: 'https://x.test/join/abc123' }

describe('buildInviteEmailSubject', () => {
  it('includes the team name', () => {
    expect(buildInviteEmailSubject(input)).toBe('Bạn được mời tham gia team Marketing trên Candor')
  })
})

describe('buildInviteEmailHtml', () => {
  it('includes the join link', () => {
    expect(buildInviteEmailHtml(input)).toContain('https://x.test/join/abc123')
  })

  it('includes the inviter name and team name', () => {
    const html = buildInviteEmailHtml(input)
    expect(html).toContain('An')
    expect(html).toContain('Marketing')
  })

  it('escapes HTML special characters instead of injecting them raw', () => {
    const html = buildInviteEmailHtml({ ...input, teamName: '<b>Evil</b>' })
    expect(html).not.toContain('<b>Evil</b>')
    expect(html).toContain('&lt;b&gt;Evil&lt;/b&gt;')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/invite-email.test.ts`
Expected: FAIL — `Cannot find module '@/lib/email/invite-email'`.

- [ ] **Step 3: Implement `lib/email/invite-email.ts`**

```ts
export type InviteEmailInput = {
  teamName: string
  inviterName: string
  joinUrl: string
}

export function buildInviteEmailSubject({ teamName }: InviteEmailInput): string {
  return `Bạn được mời tham gia team ${teamName} trên Candor`
}

export function buildInviteEmailHtml({ teamName, inviterName, joinUrl }: InviteEmailInput): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #111;">Bạn được mời tham gia team ${escapeHtml(teamName)}</h2>
      <p>${escapeHtml(inviterName)} đã mời bạn tham gia team <strong>${escapeHtml(teamName)}</strong> trên Candor — nền tảng đánh giá chéo ẩn danh cho team.</p>
      <p>
        <a href="${joinUrl}" style="display: inline-block; padding: 10px 20px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Tham gia team
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">Link này hết hạn sau 7 ngày. Nếu bạn không mong đợi email này, có thể bỏ qua.</p>
    </div>
  `.trim()
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/invite-email.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/email/invite-email.ts tests/lib/invite-email.test.ts
git commit -m "feat: add invite email subject/HTML builder"
```

---

### Task 3: Email list parsing + validation utilities (TDD)

**Files:**
- Create: `lib/utils/parse-email-list.ts`
- Test: `tests/lib/parse-email-list.test.ts`

**Interfaces:**
- Consumes: `z` from `zod` (already a project dependency).
- Produces: `export const MAX_EMAILS_PER_SUBMIT = 100`, `export function parseEmailList(raw: string): string[]`, `export function isValidEmail(value: string): boolean`, `export type EmailClassification = { alreadyMember: string[]; alreadyInvited: string[]; toInvite: string[] }`, `export function classifyEmails(emails: string[], memberEmails: Set<string>, pendingInviteEmails: Set<string>): EmailClassification` — Task 4's server action imports all of these; Task 5's form imports `parseEmailList` and `MAX_EMAILS_PER_SUBMIT`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/parse-email-list.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseEmailList, isValidEmail } from '@/lib/utils/parse-email-list'

describe('parseEmailList', () => {
  it('splits on commas and newlines', () => {
    expect(parseEmailList('a@x.com, b@y.com\nc@z.com')).toEqual(['a@x.com', 'b@y.com', 'c@z.com'])
  })

  it('trims whitespace around each entry', () => {
    expect(parseEmailList('  a@x.com  ,  b@y.com  ')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('drops empty entries from blank lines or trailing commas', () => {
    expect(parseEmailList('a@x.com,,\n\nb@y.com,')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('dedupes case-insensitively, keeping the first occurrence', () => {
    expect(parseEmailList('A@x.com\na@X.com')).toEqual(['a@x.com'])
  })
})

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('a@x.com')).toBe(true)
  })

  it('rejects a malformed value', () => {
    expect(isValidEmail('not-an-email')).toBe(false)
  })
})

describe('classifyEmails', () => {
  it('separates already-member, already-invited, and eligible emails', () => {
    const result = classifyEmails(
      ['a@x.com', 'b@x.com', 'c@x.com'],
      new Set(['a@x.com']),
      new Set(['b@x.com'])
    )
    expect(result).toEqual({
      alreadyMember: ['a@x.com'],
      alreadyInvited: ['b@x.com'],
      toInvite: ['c@x.com'],
    })
  })

  it('treats already-member as taking priority over already-invited', () => {
    const result = classifyEmails(['a@x.com'], new Set(['a@x.com']), new Set(['a@x.com']))
    expect(result.alreadyMember).toEqual(['a@x.com'])
    expect(result.alreadyInvited).toEqual([])
  })

  it('returns empty buckets for an empty input list', () => {
    expect(classifyEmails([], new Set(), new Set())).toEqual({
      alreadyMember: [],
      alreadyInvited: [],
      toInvite: [],
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/parse-email-list.test.ts`
Expected: FAIL — `Cannot find module '@/lib/utils/parse-email-list'`.

- [ ] **Step 3: Implement `lib/utils/parse-email-list.ts`**

```ts
import { z } from 'zod'

export const MAX_EMAILS_PER_SUBMIT = 100

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const part of raw.split(/[,\n]/)) {
    const value = part.trim().toLowerCase()
    if (value && !seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }
  return result
}

export function isValidEmail(value: string): boolean {
  return z.email().safeParse(value).success
}

export type EmailClassification = {
  alreadyMember: string[]
  alreadyInvited: string[]
  toInvite: string[]
}

export function classifyEmails(
  emails: string[],
  memberEmails: Set<string>,
  pendingInviteEmails: Set<string>
): EmailClassification {
  const alreadyMember: string[] = []
  const alreadyInvited: string[] = []
  const toInvite: string[] = []
  for (const email of emails) {
    if (memberEmails.has(email)) {
      alreadyMember.push(email)
    } else if (pendingInviteEmails.has(email)) {
      alreadyInvited.push(email)
    } else {
      toInvite.push(email)
    }
  }
  return { alreadyMember, alreadyInvited, toInvite }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/parse-email-list.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/utils/parse-email-list.ts tests/lib/parse-email-list.test.ts
git commit -m "feat: add email list parsing/validation utilities"
```

---

### Task 4: `createBulkInvites` server action

**Files:**
- Modify: `app/teams/[teamId]/actions.ts`

**Interfaces:**
- Consumes: `generateInviteToken`, `inviteExpiryTimestamp`, `isInviteExpired` from `@/lib/utils/invite-token` (existing), `resend` from `@/lib/email/resend` (Task 1), `buildInviteEmailSubject`/`buildInviteEmailHtml` from `@/lib/email/invite-email` (Task 2), `MAX_EMAILS_PER_SUBMIT`/`classifyEmails` from `@/lib/utils/parse-email-list` (Task 3), `headers` from `next/headers`, `z` from `zod`.
- Produces: `export type BulkInviteSummary = { sent: string[]; invalidFormat: string[]; alreadyMember: string[]; alreadyInvited: string[]; emailDeliveryFailed: boolean }`, `export async function createBulkInvites(teamId: string, teamName: string, emails: string[]): Promise<{ error: string } | { data: BulkInviteSummary }>` — Task 5's form calls this directly.

- [ ] **Step 1: Add the imports**

In `app/teams/[teamId]/actions.ts`, add below the existing imports:

```ts
import { headers } from 'next/headers'
import { z } from 'zod'
import { isInviteExpired } from '@/lib/utils/invite-token'
import { MAX_EMAILS_PER_SUBMIT, classifyEmails } from '@/lib/utils/parse-email-list'
import { resend } from '@/lib/email/resend'
import { buildInviteEmailSubject, buildInviteEmailHtml } from '@/lib/email/invite-email'
```

(`generateInviteToken` and `inviteExpiryTimestamp` are already imported in this file.)

- [ ] **Step 2: Append `createBulkInvites` to the end of the file**

```ts
export type BulkInviteSummary = {
  sent: string[]
  invalidFormat: string[]
  alreadyMember: string[]
  alreadyInvited: string[]
  emailDeliveryFailed: boolean
}

type CreateBulkInvitesResult = { error: string } | { data: BulkInviteSummary }

export async function createBulkInvites(
  teamId: string,
  teamName: string,
  emails: string[]
): Promise<CreateBulkInvitesResult> {
  if (emails.length > MAX_EMAILS_PER_SUBMIT) {
    return { error: `Tối đa ${MAX_EMAILS_PER_SUBMIT} email mỗi lượt gửi` }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Không xác thực được người dùng' }
  }

  const invalidFormat: string[] = []
  const validEmails: string[] = []
  for (const email of emails) {
    if (z.email().safeParse(email).success) {
      validEmails.push(email)
    } else {
      invalidFormat.push(email)
    }
  }

  if (validEmails.length === 0) {
    return {
      data: { sent: [], invalidFormat, alreadyMember: [], alreadyInvited: [], emailDeliveryFailed: false },
    }
  }

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('profiles(email)')
    .eq('team_id', teamId)
  if (membersError) {
    return { error: membersError.message }
  }
  const memberEmails = new Set(
    ((members ?? []) as unknown as { profiles: { email: string } }[]).map((m) =>
      m.profiles.email.toLowerCase()
    )
  )

  const { data: existingInvites, error: invitesError } = await supabase
    .from('team_invites')
    .select('email, expires_at, used_at')
    .eq('team_id', teamId)
    .in('email', validEmails)
  if (invitesError) {
    return { error: invitesError.message }
  }
  const pendingInviteEmails = new Set(
    (existingInvites ?? [])
      .filter((invite) => invite.email && !invite.used_at && !isInviteExpired(invite.expires_at))
      .map((invite) => (invite.email as string).toLowerCase())
  )

  const { alreadyMember, alreadyInvited, toInvite } = classifyEmails(
    validEmails,
    memberEmails,
    pendingInviteEmails
  )

  if (toInvite.length === 0) {
    return { data: { sent: [], invalidFormat, alreadyMember, alreadyInvited, emailDeliveryFailed: false } }
  }

  const rows = toInvite.map((email) => ({
    team_id: teamId,
    token: generateInviteToken(),
    email,
    created_by: user.id,
    expires_at: inviteExpiryTimestamp(),
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('team_invites')
    .insert(rows)
    .select('token, email')
  if (insertError) {
    return { error: insertError.message }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${protocol}://${host}`

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()
  const inviterName = inviterProfile?.full_name ?? inviterProfile?.email ?? 'Một thành viên'

  const { error: sendError } = await resend.batch.send(
    (inserted ?? []).map((invite) => {
      const joinUrl = `${origin}/join/${invite.token}`
      const emailInput = { teamName, inviterName, joinUrl }
      return {
        from: 'Candor <onboarding@resend.dev>',
        to: [invite.email as string],
        subject: buildInviteEmailSubject(emailInput),
        html: buildInviteEmailHtml(emailInput),
      }
    })
  )

  return {
    data: {
      sent: sendError ? [] : toInvite,
      invalidFormat,
      alreadyMember,
      alreadyInvited,
      emailDeliveryFailed: Boolean(sendError),
    },
  }
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `app/teams/[teamId]/actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add "app/teams/[teamId]/actions.ts"
git commit -m "feat: add createBulkInvites server action"
```

---

### Task 5: `BulkInviteForm` component

**Files:**
- Create: `components/teams/bulk-invite-form.tsx`

**Interfaces:**
- Consumes: `parseEmailList`, `MAX_EMAILS_PER_SUBMIT` from `@/lib/utils/parse-email-list` (Task 3), `createBulkInvites`, `type BulkInviteSummary` from `@/app/teams/[teamId]/actions` (Task 4), `Button` from `@/components/ui/button`, `Textarea` from `@/components/ui/textarea`, `Label` from `@/components/ui/label` (all existing).
- Produces: `export function BulkInviteForm({ teamId, teamName }: { teamId: string; teamName: string }): JSX.Element` — Task 6 renders this inside `InviteDialog`.

- [ ] **Step 1: Create `components/teams/bulk-invite-form.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { parseEmailList, MAX_EMAILS_PER_SUBMIT } from '@/lib/utils/parse-email-list'
import { createBulkInvites, type BulkInviteSummary } from '@/app/teams/[teamId]/actions'

export function BulkInviteForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [summary, setSummary] = useState<BulkInviteSummary | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setRaw((prev) => (prev.trim() ? `${prev}\n${text}` : text))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const emails = parseEmailList(raw)
    if (emails.length === 0) {
      setError('Nhập ít nhất 1 email')
      return
    }
    if (emails.length > MAX_EMAILS_PER_SUBMIT) {
      setError(`Tối đa ${MAX_EMAILS_PER_SUBMIT} email mỗi lượt gửi — hiện có ${emails.length}`)
      return
    }
    setPending(true)
    const result = await createBulkInvites(teamId, teamName, emails)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSummary(result.data)
  }

  if (summary) {
    const total =
      summary.sent.length + summary.invalidFormat.length + summary.alreadyMember.length + summary.alreadyInvited.length
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Đã gửi {summary.sent.length}/{total}
        </p>
        {summary.invalidFormat.length > 0 && (
          <p className="text-sm text-destructive">Sai định dạng: {summary.invalidFormat.join(', ')}</p>
        )}
        {summary.alreadyMember.length > 0 && (
          <p className="text-sm text-muted-foreground">Đã là thành viên: {summary.alreadyMember.join(', ')}</p>
        )}
        {summary.alreadyInvited.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Đã có lời mời còn hạn: {summary.alreadyInvited.join(', ')}
          </p>
        )}
        {summary.emailDeliveryFailed && (
          <p className="text-sm text-destructive">
            Gửi email thất bại, nhưng link mời đã được tạo — dùng tab &quot;Link mời&quot; để lấy lại.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSummary(null)
            setRaw('')
          }}
        >
          Mời thêm
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bulk-emails">Danh sách email (phân cách bằng dấu phẩy hoặc xuống dòng)</Label>
        <Textarea
          id="bulk-emails"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'a@congty.com, b@congty.com\nc@congty.com'}
          rows={6}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bulk-emails-file">Hoặc tải lên file .csv/.txt (mỗi dòng 1 email)</Label>
        <input
          ref={fileInputRef}
          id="bulk-emails-file"
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="block w-full text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang gửi...' : 'Gửi lời mời'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `bulk-invite-form.tsx`.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 3: Commit**

```bash
git add components/teams/bulk-invite-form.tsx
git commit -m "feat: add BulkInviteForm component"
```

---

### Task 6: Wire `BulkInviteForm` into `InviteDialog`

**Files:**
- Modify: `components/teams/invite-dialog.tsx`
- Modify: `app/teams/[teamId]/page.tsx`

**Interfaces:**
- Consumes: `BulkInviteForm` from `@/components/teams/bulk-invite-form` (Task 5).

- [ ] **Step 1: Add a mode toggle and the new form to `InviteDialog`**

Replace the full contents of `components/teams/invite-dialog.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createInvite } from '@/app/teams/[teamId]/actions'
import { BulkInviteForm } from '@/components/teams/bulk-invite-form'

export function InviteDialog({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'link' | 'email'>('link')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData()
    formData.set('email', email)
    const result = await createInvite(teamId, formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setInviteUrl(`${window.location.origin}/join/${result.data.token}`)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setMode('link')
      setEmail('')
      setError(null)
      setInviteUrl(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline">Mời thành viên</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mời thành viên vào team</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'link' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('link')}
          >
            Link mời
          </Button>
          <Button
            type="button"
            variant={mode === 'email' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('email')}
          >
            Mời qua email
          </Button>
        </div>
        {mode === 'link' ? (
          inviteUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Link mời (hết hạn sau 7 ngày) — gửi cho người bạn muốn mời:
              </p>
              <Input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email (tùy chọn — để trống để tạo link mời mở)</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@congty.com"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Đang tạo...' : 'Tạo link mời'}
                </Button>
              </DialogFooter>
            </form>
          )
        ) : (
          <BulkInviteForm teamId={teamId} teamName={teamName} />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Pass `teamName` from the team page**

In `app/teams/[teamId]/page.tsx`, change:

```tsx
          <InviteDialog teamId={team.id} />
```

to:

```tsx
          <InviteDialog teamId={team.id} teamName={team.name} />
```

- [ ] **Step 3: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `invite-dialog.tsx` or `app/teams/[teamId]/page.tsx`.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Commit**

```bash
git add components/teams/invite-dialog.tsx "app/teams/[teamId]/page.tsx"
git commit -m "feat: add bulk email invite mode to InviteDialog"
```

---

### Task 7: Manual end-to-end verification

This task has no code changes — it confirms Tasks 1–6 work against a real Resend send. **Requires the Resend account's own email address** (the one used to sign up for Resend), since the unverified `onboarding@resend.dev` sender can only deliver there (see Global Constraints).

**Files:** none.

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: all tests pass, including the 10 new tests from Tasks 2 and 3.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Open a team and switch to the email tab**

Open `http://localhost:3000/teams/<a team you own>`, click "Mời thành viên", click "Mời qua email".

- [ ] **Step 4: Submit a mixed batch**

Paste a list containing: the Resend account's own email (valid + eligible), a malformed entry (e.g. `not-an-email`), and an email that's already a member of this team. Click "Gửi lời mời".

Expected summary: "Đã gửi 1/3", "Sai định dạng: not-an-email", "Đã là thành viên: <that member's email>".

- [ ] **Step 5: Confirm the email arrived**

Check the Resend account's inbox for a message with subject "Bạn được mời tham gia team <tên team> trên Candor" containing a working `/join/<token>` link.

- [ ] **Step 6: Confirm the invite row works**

Click the link from the email (or copy it from the Supabase `team_invites` table if the email is delayed), confirm it lands on the join-confirm screen and accepting adds the account to the team.

No commit for this task (no files changed).
