# Open (guest) evaluation rounds — Design

## Goal

A second, no-account tier alongside the existing team-based product:
anyone can start an evaluation round, share a link, and have people join
by typing a display name only — no signup, no password, no team. The
creator also participates (reviews and is reviewed like everyone else);
their only extra ability is starting and closing the round. Minimum 2
participants to start; no maximum.

The registered tier (email/Google signup → create a team → persistent
membership + round history) is exactly what already exists today — no
changes needed there. This spec only adds the guest path.

## Why this shape

**Anonymous participants are still real Supabase Auth users — via
`signInAnonymously()` — never a parallel identity system.** The entire
anonymity guarantee (structural, not just RLS — see `schema.sql`'s
`responses`/`submission_status` split), every existing RLS policy, and the
`submit_response()` RPC are built entirely on `auth.uid()`. Supabase's
anonymous sign-in produces a real `auth.users` row and a real `auth.uid()`
with no email/password ever shown to the user — from their point of view
it's just "type your name, you're in." This means the existing rounds/
review/report machinery works for guests with almost no changes: only the
join-time and roster-building edges need new policies (detailed below). A
fully parallel guest-identity system (custom tokens, no `auth.users`
involvement, all access funneled through service-role server actions) was
considered and rejected — it would mean re-deriving the anonymity/progress-
tracking rules from scratch for a second identity model, in a codebase
where getting that exactly right is explicitly the highest-stakes part of
the product (see `schema.sql`'s comment on `responses`: "NEVER add a
reviewer-linking column to this table").

**`rounds.team_id` nullable, not a separate `open_rounds` table.** The
codebase already uses "nullable column = open/unrestricted variant" for
exactly this shape of decision (`team_invites.email` null means an open
invite link vs. a targeted one). A null `team_id` means "this round has no
team — anyone who joins via the link is the roster," fully analogous.
Reusing one `rounds` table means `/rounds/[roundId]`, the review pages, and
the report page work for both round kinds without branching on which table
they came from.

**A new `collecting` status, not reusing `draft`.** `draft` already exists
in the status check constraint but is unused by the team flow (team rounds
are created directly as `open`, with the whole team snapshotted
immediately). Repurposing it would make `draft` mean two different things
depending on `team_id`. `collecting` is an explicit, self-documenting third
state: "the join link is live, roster is still growing." Team rounds never
enter it.

## Scope

In scope:
- `signInAnonymously()`-based join flow (creator and participants)
- Schema: `rounds.team_id` nullable, `collecting` status, `profiles.email`
  nullable, ~6 new RLS policies (additive only — no existing policy
  changes)
- Two new routes (`/rounds/new`, `/rounds/[roundId]/join`) and one new
  branch in the existing `/rounds/[roundId]` page for the `collecting`
  state
- Minimum-2-participants gate before a creator can start the round; no
  maximum

Out of scope:
- Any change to the team-based flow, its routes, or its RLS policies
- Recovering creator/participant access after losing the browser session
  (no account exists to recover into — accepted limitation of a truly
  no-login tier)
- A "collecting phase" deadline separate from the review deadline (see
  Edge cases)
- Rate-limiting/anti-abuse for anonymous sign-in beyond what already
  applies to the rest of the app (Supabase's own abuse protection on
  `signInAnonymously` applies automatically)

## Data model changes

```sql
alter table public.rounds
  alter column team_id drop not null;

alter table public.rounds
  drop constraint rounds_status_check,
  add constraint rounds_status_check
    check (status in ('draft', 'collecting', 'open', 'closed'));

alter table public.profiles
  alter column email drop not null;
```

`handle_new_user()` needs no change — it already does
`coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')`
and inserts `new.email` as-is, which is fine once the column allows null.

## New RLS policies (additive — every existing policy stays as-is)

```sql
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

No changes needed to `rounds_update_creator`, `submission_status_select_own`,
`responses_select_own_when_closed`, or `submit_response()` — none of them
reference `team_id` or `team_members` in the first place.

## Files

**New:**
- `app/rounds/new/page.tsx` + `components/rounds/create-open-round-form.tsx`
  — display name + title + deadline + questions (question-list UI reused
  from `create-round-form.tsx` via a shared subcomponent). Submit action:
  `signInAnonymously({ options: { data: { full_name } } })`, then create
  the round (`team_id: null`, `status: 'collecting'`), then insert self
  into `round_participants`.
- `app/rounds/[roundId]/join/page.tsx` + `components/rounds/join-open-round-form.tsx`
  — display-name-only form. Looks up the round via the admin client first
  (same pattern as `/join/[token]`, since the visitor has no session/RLS
  access yet) to show the round title and reject if not `collecting`.
  Submit: anonymous sign-in, then insert self into `round_participants`
  (covered by the new self-insert policy).
- `app/rounds/[roundId]/start-actions.ts` — `startRound(roundId)`: creator-
  only (mirrors `closeRound`'s `created_by = auth.uid()` check), requires
  ≥2 rows in `round_participants`, flips `status` to `open`.

**Modified:**
- `app/rounds/[roundId]/page.tsx` — add a `collecting` branch: participant
  name list, copyable join link, "Bắt đầu đánh giá" button (creator only,
  disabled with a message below 2 participants).
- `lib/utils/round-status.ts` — add `'collecting'` to the `RoundStatus`
  union. `getEffectiveStatus` needs no logic change: it only special-cases
  `status === 'open'` past its deadline, so a `collecting` round just
  passes through unchanged, which is the desired behavior (see Edge cases).
- `supabase/schema.sql` — the three `alter table` statements and six new
  policies above, appended in the existing file (this repo runs schema.sql
  fresh per environment rather than via migrations, per its header comment).

## Edge cases

- **Deadline covers the review phase only, not collecting.** The creator
  picks one deadline at creation time, same field as team rounds; it only
  starts mattering once `startRound` flips status to `open` (the effective-
  status helper `lib/utils/round-status.ts` already treats "closed" as
  "status = closed OR deadline passed" — no change needed there since a
  round still `collecting` is neither open nor closed by that helper today,
  but the UI won't offer the review/report views until status is `open`
  regardless). If a creator lets collecting drag past their chosen
  deadline, that's on them to manage — not solved automatically, since
  adding a second "collecting expires at" field wasn't requested and adds a
  second clock to reason about for one open question.
- **Fewer than 2 people ever join.** The round stays `collecting`
  indefinitely; `startRound` simply refuses (same message text as the
  existing team-mode "cần ít nhất 2 thành viên").
- **Creator loses their browser session mid-collecting.** No recovery path
  — matches the accepted trade-off of a true no-login tier. The round
  itself isn't lost (other participants who already joined keep their
  session), just nobody can click "Bắt đầu đánh giá" or "Đóng vòng" until
  the creator returns on the same browser.

## Testing

- Unit: none of the new logic is pure/isolable beyond what
  `lib/utils/round-status.ts` already covers; `startRound`'s "≥2
  participants" check mirrors the existing tested pattern in
  `app/teams/[teamId]/rounds/actions.ts` (mock-Supabase style, if a test is
  added later).
- Manual (per this repo's `verify` convention): `npm run dev`, open
  `/rounds/new` in one browser (creator), submit with 1 question of each
  type, copy the join link, open it in a second (incognito) browser, join
  with a display name, go back to the creator's tab, confirm the new name
  appears and "Bắt đầu đánh giá" becomes enabled, start the round, submit a
  review from each side, close the round (or wait for deadline), confirm
  both sides can see their own report and it's correctly anonymous (no way
  to tell which of the other participants wrote which response).

## Prerequisite

- Run the updated `schema.sql` statements (or an equivalent migration)
  against the Supabase project before this feature can work — the nullable
  columns and new policies don't exist until then.
