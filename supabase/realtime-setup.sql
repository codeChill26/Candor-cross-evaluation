-- ============================================================
-- Enable Supabase Realtime for the live "waiting room".
-- Adds the two tables the collecting panel subscribes to into the
-- `supabase_realtime` publication. Run once in the Supabase SQL Editor.
-- Idempotent — safe to re-run.
--
-- RLS still applies to Realtime: a subscriber only receives a change if their
-- SELECT policy lets them read the changed row. So open-round participants get
-- roster/status updates for their own round, and nothing leaks beyond that.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'round_participants'
  ) then
    alter publication supabase_realtime add table public.round_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rounds'
  ) then
    alter publication supabase_realtime add table public.rounds;
  end if;

  -- Live team roster (a member joins via invite → team page updates).
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_members'
  ) then
    alter publication supabase_realtime add table public.team_members;
  end if;
end $$;
