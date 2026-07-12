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
  type text not null check (type in ('rating', 'multiple_choice', 'text')),
  prompt text not null,
  options_json jsonb,
  min_value int,
  max_value int,
  order_index int not null default 0
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

-- rounds, round_questions, round_participants, submission_status, and
-- responses intentionally have RLS enabled but no policies yet — this
-- denies all access to anon/authenticated roles until Day 2 defines the
-- real rules. service_role (the admin client) always bypasses RLS.

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

create policy "team_members_select_teammate"
  on public.team_members for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id and tm.user_id = auth.uid()
    )
  );

create policy "team_members_delete_owner_or_self"
  on public.team_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
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
