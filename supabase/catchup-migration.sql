-- ============================================================
-- Catch-up migration for the EXISTING Supabase project.
--
-- Live DB state (verified via PostgREST OpenAPI): schema.sql sections 1-4
-- only. Section 5 (open rounds) and 6 (guest lockout) were never applied,
-- and the section-2 team_members policies are self-recursive (this is what
-- makes "create team" fail with: infinite recursion detected in policy for
-- relation "team_members").
--
-- This brings the DB up to current schema.sql. Idempotent -- safe to re-run.
-- Run once in the Supabase SQL Editor, then hit Run.
-- ============================================================

-- ============================================================
-- A. Fix team_members recursion (this unblocks "create team")
-- ============================================================
-- A policy on team_members that queries team_members re-triggers itself
-- while being evaluated. These security definer helpers bypass RLS and
-- break the cycle -- for team_members' own policies and for every other
-- table's policy that needs a membership check.

create or replace function public.is_team_member(_team_id uuid)
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

create or replace function public.is_team_owner(_team_id uuid)
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

drop policy if exists "team_members_select_teammate" on public.team_members;
create policy "team_members_select_teammate"
  on public.team_members for select
  to authenticated
  using (public.is_team_member(team_id));

drop policy if exists "team_members_delete_owner_or_self" on public.team_members;
create policy "team_members_delete_owner_or_self"
  on public.team_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_team_owner(team_id)
  );

-- ============================================================
-- B. Section 5 -- open (guest) evaluation rounds
-- ============================================================
alter table public.profiles
  alter column email drop not null;

alter table public.rounds
  alter column team_id drop not null;

alter table public.rounds
  drop constraint if exists rounds_status_check,
  add constraint rounds_status_check
    check (status in ('draft', 'collecting', 'open', 'closed'));

create or replace function public.is_round_participant(_round_id uuid)
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

drop policy if exists "rounds_select_open_participant" on public.rounds;
create policy "rounds_select_open_participant"
  on public.rounds for select
  to authenticated
  using (
    team_id is null
    and public.is_round_participant(id)
  );

drop policy if exists "rounds_insert_open" on public.rounds;
create policy "rounds_insert_open"
  on public.rounds for insert
  to authenticated
  with check (created_by = auth.uid() and team_id is null);

drop policy if exists "round_participants_insert_self_when_collecting" on public.round_participants;
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

drop policy if exists "round_participants_select_open_participant" on public.round_participants;
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

drop policy if exists "round_questions_select_open_participant" on public.round_questions;
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

drop policy if exists "profiles_select_open_round_co_participant" on public.profiles;
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
-- C. Section 6 -- keep anonymous (guest) sessions out of the registered tier
-- ============================================================
drop policy if exists "teams_insert_self_as_creator" on public.teams;
create policy "teams_insert_self_as_creator"
  on public.teams for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and (select (auth.jwt()->>'is_anonymous')::boolean) is not true
  );
