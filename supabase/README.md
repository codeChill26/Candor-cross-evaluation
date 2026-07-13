# Supabase setup

1. Create a project at https://supabase.com/dashboard.
2. Project Settings → API → copy `Project URL`, `anon public` key, and
   `service_role` key into `.env.local` (never commit this file).
3. Authentication → Providers → enable Email, and enable Google (paste the
   Client ID/Secret from Google Cloud Console; set the Authorized redirect
   URI to the callback shown in the Supabase Google provider panel).
4. SQL Editor → paste the full contents of `schema.sql` → Run.
5. Verify tables and RLS with this query (run in SQL Editor):

   ```sql
   select tablename, rowsecurity
   from pg_tables
   where schemaname = 'public'
   order by tablename;
   ```

   Expected: all 9 tables listed, `rowsecurity = true` for every row.

6. Verify the `responses` table has no reviewer-linking column:

   ```sql
   select column_name from information_schema.columns
   where table_schema = 'public' and table_name = 'responses';
   ```

   Expected columns: `id, round_id, target_id, answers_json, submitted_at` —
   no `reviewer_id` and no other column that could identify the reviewer.

7. Verify the `submit_response` function exists and is callable by
   `authenticated`:

   ```sql
   select routine_name, security_type
   from information_schema.routines
   where routine_schema = 'public' and routine_name = 'submit_response';
   ```

   Expected: one row, `security_type = 'DEFINER'`.
