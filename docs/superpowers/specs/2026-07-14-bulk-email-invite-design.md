# Bulk email invite (Resend) — Design

## Goal

Let a team owner/member invite many people at once by email — paste or
upload a list of addresses — instead of generating one link at a time and
copy-pasting it manually. Each recipient gets a real email containing their
own invite link.

## Context

Candor already has an invite system (`team_invites` table, `createInvite`
server action, `/join/[token]` accept flow) — but it only ever creates one
invite row at a time and never sends an email; the owner copies the
generated link and shares it themselves. This spec adds a second path
alongside the existing one: bulk-create invites from a list of emails and
have Resend deliver each link automatically. The existing single/open-link
flow is untouched.

Two other ideas raised in the same conversation are explicitly **out of
scope** for this spec:
- Guest join without login — resolved as "no change needed": the app
  already requires login before accepting an invite
  (`/join/[token]` redirects to `/login?next=...`), which is the behavior
  the user confirmed they want.
- A Google-Forms-style question builder for rounds — unrelated subsystem,
  will get its own spec.

## Why this shape

**Email provider: Resend, not Supabase's built-in invite email.**
Supabase Auth has `admin.inviteUserByEmail`, but two things rule it out:
it's rate-limited to a handful of emails/hour on the free tier without
custom SMTP (defeats the point of "bulk"), and it drives Supabase's own
auth-invite mechanism (creates the `auth.users` row itself, sends its own
templated email, own redirect flow) — running that alongside our existing
`team_invites`/token system means two parallel, overlapping invite
mechanisms. Resend instead just sends an email for a `team_invites` row we
already created ourselves — zero change to the existing token/accept-invite
architecture.

**Local/dev sending is capped to the developer's own inbox.** Resend
blocks sending from the unverified `onboarding@resend.dev` address to any
recipient other than the Resend account's own email (403 otherwise). No
domain has been verified yet, so until one is, every test send — local or
otherwise — can only land in the developer's own inbox, regardless of what
address is typed into the recipient list. This is a Resend platform
restriction, not a bug in this feature. Verifying a real domain (adding it
in the Resend dashboard + a few DNS records) lifts the restriction later,
before production use with real invitees.

**Best-effort batch processing, not all-or-nothing.** A pasted list will
routinely contain a typo or a person already on the team. Rejecting the
whole batch for one bad line is worse UX than sending to everyone valid and
reporting what got skipped and why — confirmed with the user.

## Scope

In scope:
- Bulk input UI (textarea + file upload) added as a second mode inside the
  existing `InviteDialog`
- Server-side validation/dedup/eligibility checks per email
- Creating one `team_invites` row per eligible email (existing schema,
  unchanged)
- Sending via `resend.batch.send` (≤100 recipients per submit — Resend's
  batch API limit)
- A result summary shown after sending

Out of scope:
- Any `schema.sql` or RLS change (existing policies already cover
  per-row inserts by an authenticated team member)
- Domain verification steps in the Resend dashboard (manual, user-side,
  noted as a prerequisite — not part of this codebase)
- Resending/reminding a specific pending invite (still possible today by
  just inviting the same email again, which naturally skips while a prior
  invite is still pending — no new "resend" button planned)
- Chunking beyond 100 recipients in one submit (batch is capped there;
  revisit only if it becomes a real need)

## Files

**New:**
- `lib/email/resend.ts` — `Resend` client singleton, reading
  `RESEND_API_KEY` (server-only, never imported from a client component).
- `lib/email/invite-email.ts` — builds the subject/HTML for one invite
  email given `{ teamName, inviterName, joinUrl }`. Vietnamese copy,
  matching the tone already used in `invite-dialog.tsx` ("Link mời (hết
  hạn sau 7 ngày)").
- `components/teams/bulk-invite-form.tsx` — the new "Mời qua email" mode:
  textarea, file input (`.csv`/`.txt`), submit button, result summary.
- `lib/utils/parse-email-list.ts` — splits raw pasted/uploaded text on
  commas and newlines, trims, drops empties, returns the list for the
  textarea (shared by both the paste path and the "load file into
  textarea" path — file content always lands in the textarea for the user
  to review/edit before submitting, never sent unseen).

**Modified:**
- `app/teams/[teamId]/actions.ts` — add `createBulkInvites(teamId,
  emails: string[])`:
  1. Parse/dedupe/validate each address with the existing
     `z.email()` rule (reuse from `lib/validations/team.ts`).
  2. For each syntactically valid, deduped address: skip if a profile
     with that email is already a `team_members` row for this team, or if
     a non-expired, unused `team_invites` row already exists for
     `(team_id, email)`; otherwise insert a new `team_invites` row
     (same shape `createInvite` already writes).
  3. Call `resend.batch.send(...)` once with one entry per newly created
     invite (subject/HTML from `lib/email/invite-email.ts`, `to: [email]`,
     `from: 'Candor <onboarding@resend.dev>'`).
  4. Return a summary: `{ sent: string[], invalidFormat: string[],
     alreadyMember: string[], alreadyInvited: string[] }`.
- `components/teams/invite-dialog.tsx` — becomes a two-mode dialog: keep
  the current single-link form under a "Link mời" tab, add
  `BulkInviteForm` under a new "Mời qua email" tab.
- `.env.local.example` / `.env.local` — `RESEND_API_KEY` (already added).
- `package.json` — add `resend` dependency.

## Error handling / result summary

After submit, show counts drawn from the action's return value, e.g.:
"Đã gửi 8/10 — 1 sai định dạng, 1 đã là thành viên." Each category
(invalid format, already member, already invited, sent) is listed so the
user can see exactly which addresses fell into which bucket, not just a
count.

If the `resend.batch.send` call itself fails (network/API error), the
already-inserted `team_invites` rows are **not** rolled back — they remain
valid, usable invites; the user just didn't get an email. The summary
surfaces this as a distinct "gửi email thất bại, nhưng link mời đã được tạo"
case rather than a generic error, since the invite rows created are still
functional via manual link-copy (the existing flow).

## Testing

- Unit: `parse-email-list.ts` (dedup, trim, drop empty lines/commas mixed)
  and the eligibility classification logic in `createBulkInvites`
  (mock Supabase client) — mirrors the existing `tests/lib/` convention.
- Manual (per this repo's `verify` convention): `npm run dev`, open a
  team, "Mời qua email", paste a mix of valid/duplicate/malformed
  addresses including the developer's own Resend account email, submit,
  confirm the summary matches expectations and the email actually arrives
  for the one address Resend's sandbox mode allows.

## Prerequisite (manual, user-side)

- Resend account + `RESEND_API_KEY` — done.
- Domain verification in the Resend dashboard — not done yet; needed
  before this feature can email anyone other than the developer's own
  address. Not blocking for building/testing the feature's logic, only for
  testing real multi-recipient delivery.
