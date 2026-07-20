-- ============================================================
-- Candor database schema
-- Run this once in the Supabase SQL Editor for a fresh project.
--
-- Structure: all tables are created first (in FK dependency order),
-- then RLS + policies + triggers are added afterward. This ordering
-- matters — a `create policy` clause is parsed immediately and fails
-- if a table it references (e.g. team_members) doesn't exist yet.
-- ============================================================

-- ============================================================
-- 1. Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  token text not null unique,
  email text,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Day 2 feature — table created now, locked down (no policies) until then.
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null,
  created_by uuid not null references public.profiles (id),
  deadline timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now()
);

-- Day 2 feature.
create table public.round_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  type text not null check (
    type in ('paragraph', 'short_text', 'rating', 'checkbox',
             'multiple_choice', 'dropdown', 'nps', 'text')
  ),
  prompt text not null,
  options_json jsonb,
  min_value int,
  max_value int,
  order_index int not null default 0,
  required boolean not null default true
);

-- Day 2 feature.
create table public.round_participants (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  unique (round_id, user_id)
);

-- Day 2 feature — progress tracking only, no response content.
create table public.submission_status (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id),
  target_id uuid not null references public.profiles (id),
  submitted_at timestamptz not null default now(),
  unique (round_id, reviewer_id, target_id)
);

-- Day 2/3 feature — NEVER add a reviewer-linking column to this table.
-- This is the structural core of Candor's anonymity guarantee: response
-- content has no column, anywhere, that identifies who submitted it.
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  target_id uuid not null references public.profiles (id),
  answers_json jsonb not null,
  submitted_at timestamptz not null default now()
);

-- ============================================================
-- 2. Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.rounds enable row level security;
alter table public.round_questions enable row level security;
alter table public.round_participants enable row level security;
alter table public.submission_status enable row level security;
alter table public.responses enable row level security;

-- ---------- profiles ----------

create policy "profiles_select_self_or_teammate"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.team_members tm1
      join public.team_members tm2 on tm1.team_id = tm2.team_id
      where tm1.user_id = auth.uid() and tm2.user_id = profiles.id
    )
  );

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- ---------- teams ----------

create policy "teams_select_member"
  on public.teams for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = teams.id and team_members.user_id = auth.uid()
    )
  );

create policy "teams_insert_self_as_creator"
  on public.teams for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "teams_update_owner"
  on public.teams for update
  to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = teams.id
        and team_members.user_id = auth.uid()
        and team_members.role = 'owner'
    )
  );

-- ---------- team_members ----------

-- security definer: a team_members policy that queried team_members itself
-- would re-trigger that same policy while evaluating it (infinite recursion).
-- These functions run as the function owner, which bypasses RLS, breaking
-- the cycle for any policy — on team_members or elsewhere — that needs to
-- check membership.
create function public.is_team_member(_team_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = _team_id and user_id = auth.uid()
  );
$$;

create function public.is_team_owner(_team_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = _team_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create policy "team_members_select_teammate"
  on public.team_members for select
  to authenticated
  using (public.is_team_member(team_id));

create policy "team_members_delete_owner_or_self"
  on public.team_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_team_owner(team_id)
  );

-- No client-side INSERT policy: rows are created only by the
-- handle_new_team trigger (owner) or the accept-invite server action,
-- which uses the service-role key and therefore bypasses RLS entirely.

-- ---------- team_invites ----------

create policy "team_invites_select_teammate"
  on public.team_invites for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members
      where team_members.team_id = team_invites.team_id and team_members.user_id = auth.uid()
    )
  );

create policy "team_invites_insert_teammate"
  on public.team_invites for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.team_members
      where team_members.team_id = team_invites.team_id and team_members.user_id = auth.uid()
    )
  );

-- Token lookup during the join flow (before the visitor is a member) and
-- marking an invite used both happen server-side via the admin client,
-- which bypasses RLS. No public SELECT/UPDATE-by-token policy exists.

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

-- ============================================================
-- 3. Triggers
-- ============================================================

-- Auto-create a profile row whenever a new auth user is created
-- (covers email/password signup and Google OAuth signup alike).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-add the creator as owner whenever a team is created.
create function public.handle_new_team()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_team_created
  after insert on public.teams
  for each row execute procedure public.handle_new_team();

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

-- security definer: mirrors is_team_member. A round_participants policy that
-- queried round_participants, or a rounds policy that queried round_participants
-- whose own policy queries rounds, would recurse. This function bypasses RLS
-- and breaks both cycles.
create function public.is_round_participant(_round_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.round_participants
    where round_id = _round_id and user_id = auth.uid()
  );
$$;

-- A guest can see an open round once they've joined it as a participant.
create policy "rounds_select_open_participant"
  on public.rounds for select
  to authenticated
  using (
    team_id is null
    and public.is_round_participant(id)
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
    public.is_round_participant(round_participants.round_id)
    and exists (
      select 1 from public.rounds
      where rounds.id = round_participants.round_id and rounds.team_id is null
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

-- ============================================================
-- 6. Keep anonymous (guest) sessions out of the registered tier
-- ============================================================
-- Anonymous auth users are real `authenticated`-role sessions, so every
-- existing team-mode policy that just checks auth.uid() would otherwise
-- let a guest session create/join a real team via a direct API call,
-- bypassing the app entirely. team_members has no client INSERT policy
-- at all (see the comment below the team_members policies) — joining a
-- team only ever happens through acceptInvite()'s service-role client,
-- which now checks user.is_anonymous in code. This policy closes the
-- other entry point: creating a team directly.

drop policy "teams_insert_self_as_creator" on public.teams;

create policy "teams_insert_self_as_creator"
  on public.teams for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and (select (auth.jwt()->>'is_anonymous')::boolean) is not true
  );
