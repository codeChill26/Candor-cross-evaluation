-- ============================================================
-- Question-types expansion migration for the EXISTING project.
-- Extends round_questions.type to 7 kinds + adds the `required` column.
-- Run once in the Supabase SQL Editor. Idempotent — safe to re-run.
-- ============================================================

alter table public.round_questions
  drop constraint if exists round_questions_type_check;

alter table public.round_questions
  add constraint round_questions_type_check
  check (type in ('paragraph', 'short_text', 'rating', 'checkbox',
                  'multiple_choice', 'dropdown', 'nps', 'text'));

alter table public.round_questions
  add column if not exists required boolean not null default true;
