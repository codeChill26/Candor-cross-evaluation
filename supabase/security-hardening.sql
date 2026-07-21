-- ============================================================
-- Candor — Security hardening migration
-- Paste this whole file into the Supabase SQL Editor and run it ONCE.
-- Safe to re-run (CREATE OR REPLACE / ALTER POLICY / DROP IF EXISTS).
--
-- Covers audit findings:
--   #3  submit_response: validate answers_json (shape/size/known questions)
--   #11 add WITH CHECK to two UPDATE policies
--   #5  drop the open-round profiles policy that leaked emails
--       (the app now resolves open-round names via the admin client, names only)
-- ============================================================


-- ------------------------------------------------------------
-- #3  Validate answers_json inside the RPC (Medium)
-- The RPC is the real trust boundary: it is `grant execute ... to authenticated`,
-- so a participant can call it directly and skip the zod validation that only
-- runs in the server action. Without these checks they could store a huge blob
-- (storage-exhaustion DoS) or answers to questions that aren't in the round.
-- ------------------------------------------------------------
create or replace function public.submit_response(
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

  -- ---- NEW: payload validation ----
  if jsonb_typeof(p_answers_json) <> 'array' then
    raise exception 'answers must be a JSON array';
  end if;

  if jsonb_array_length(p_answers_json) > 100
     or length(p_answers_json::text) > 20000 then
    raise exception 'answers payload too large';
  end if;

  -- Every answer must reference a question that actually belongs to this round.
  if exists (
    select 1
    from jsonb_array_elements(p_answers_json) e
    where not exists (
      select 1 from public.round_questions q
      where q.round_id = p_round_id
        and q.id = (e->>'question_id')::uuid
    )
  ) then
    raise exception 'answer references a question not in this round';
  end if;
  -- ---- end new validation ----

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


-- ------------------------------------------------------------
-- #11  Add WITH CHECK to UPDATE policies (Low)
-- USING controls which rows may be updated; WITH CHECK controls the NEW values.
-- Without it, a user could rewrite their own row's key columns.
-- ------------------------------------------------------------
alter policy "profiles_update_self" on public.profiles
  using (auth.uid() = id)
  with check (auth.uid() = id);

alter policy "rounds_update_creator" on public.rounds
  using (created_by = auth.uid())
  with check (created_by = auth.uid());


-- ------------------------------------------------------------
-- #5  Close the open-round email leak (Medium)
-- This policy let any open-round participant read co-participants' FULL profile
-- row — including `email` — so a registered user who joined a demo round leaked
-- their email to anonymous guests. The app no longer needs it: open-round roster
-- names are now fetched via the admin client (full_name only) in
-- app/rounds/[roundId]/page.tsx. Dropping it removes the leak.
-- (Self-reads still work via profiles_select_self_or_teammate: auth.uid() = id.)
-- ------------------------------------------------------------
drop policy if exists "profiles_select_open_round_co_participant" on public.profiles;
