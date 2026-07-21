# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Candor — anonymous 360° peer review ("đánh giá nội bộ") for small teams. Vietnamese UI. It exists because ordinary survey tools can't guarantee real anonymity; Candor enforces anonymity *structurally* (see below). Full product spec and rationale: `candor-project.md`.

## Commands

- `npm run dev` — dev server. **Port 3000 is taken by an unrelated Docker app on this machine**, so Candor lands on 3001/3005 (`npm run dev -- -p 3001`). Run only ONE dev server at a time: two share `.next` and corrupt the Turbopack cache, making every route 404. Fix: kill all `next dev`, `rm -rf .next`, start one.
- `npm run build` — production build. Run before deploying to catch build-only errors.
- `npm run lint` — ESLint. `npx tsc --noEmit` — typecheck.
- `npm run test` — Vitest (pure-logic unit tests in `tests/lib/`). Single file: `npx vitest run tests/lib/aggregate.test.ts`. UI/flows are verified by driving the browser, not unit tests.

## Architecture

Fullstack **Next.js 16 (App Router) + Supabase** — there is no separate backend service. Server Actions (`'use server'` in `app/**/actions.ts`), async Server Components, and route handlers ARE the backend; on Vercel they run as serverless functions. Supabase (Postgres + Auth) is the managed DB/auth and is always-on. `npm run dev` is the only local process to start.

Three Supabase clients — pick deliberately:
- `lib/supabase/server.ts` — RLS client bound to the user's cookie session. Default for reads.
- `lib/supabase/admin.ts` — service-role client that **bypasses RLS**, `server-only`. Used for writes RLS can't express, with authorization enforced in code.
- `lib/supabase/client.ts` — browser client (e.g. login calls Supabase directly, no server hop).

Two parallel flows that converge on the same round/review/report code once a round is `open`:
- **Team mode** — registered users; `rounds.team_id` set.
- **Open/demo mode** — anonymous guests (`signInAnonymously`), `team_id IS NULL`; no account, join via shared link, meant to be ephemeral.

## Structural anonymity — do NOT break

`responses` has **no reviewer column, by design** — reviewer→content linkage is physically impossible; never add one. "Who has submitted" lives in a separate `submission_status` table with no content. Both are written together, atomically, only by the `submit_response` Postgres RPC (`security definer`). Reports are readable only after a round closes (RLS `responses_select_own_when_closed`), and free-text answers are shuffled per-question *independently* so positions can't be lined up across questions.

## Supabase / RLS gotchas (hard-won)

- **RLS recursion**: a policy that queries its own table → `infinite recursion detected in policy`. Use the `security definer` helpers `is_team_member` / `is_team_owner` / `is_round_participant` instead of inline subqueries on the same table.
- **RLS insert deadlock**: `INSERT … .select()` (return=representation) fails when the new row isn't RLS-readable until a trigger or a later insert makes it so. `createTeam` avoids it with a client-generated UUID + return=minimal; `createOpenRound` / `joinOpenRound` write via the admin client. Don't add `.select()` to such inserts.
- Team/round **management writes** (create/delete team, guest create/join) go through the admin client with code-enforced auth; RLS is defense-in-depth there, not the gate.

## Migrations — the live DB is migrated by hand

`supabase/schema.sql` is the full schema for a FRESH project. The live database is updated by pasting `supabase/catchup-migration*.sql` into the Supabase SQL Editor and running it — **no DDL is possible via the API keys**, so Claude cannot apply migrations; ask the user to. When schema-dependent work looks broken, verify the live DB state first (probe the PostgREST OpenAPI at `<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/` with the service-role key) before assuming a code bug.

## SEO

`lib/site.ts` is the single source for title/description/keywords/URL. Set `NEXT_PUBLIC_SITE_URL` in production (defaults to localhost) so canonical/OG/sitemap resolve correctly. `robots.txt`, `sitemap.xml`, `opengraph-image` are generated (`app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`) and **must stay excluded from the `proxy.ts` matcher**, or the auth proxy redirects them to `/login`.

## Deploy

Vercel imports `codeChill26/Candor-cross-evaluation` (branch `main`). After deploy: set env vars (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_FIREBASE_*`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`) and add the Vercel domain to Supabase → Auth → URL Configuration (Site URL + Redirect URLs), or login/OAuth breaks. Supabase email-confirmation is ON and anonymous sign-ins are enabled. Bulk-invite email uses Resend's `onboarding@resend.dev` test sender (only delivers to your own Resend-account email until a domain is verified).
