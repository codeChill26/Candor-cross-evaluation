# Google login (Firebase popup → Supabase session) — Design

## Goal

Add "Sign in with Google" to the login and register pages. Users click the
button, a Google popup (via Firebase Auth) collects their Google identity,
and the app ends up with a normal Supabase session — same as email/password
users get today.

## Why this shape

The app's authorization model is entirely Supabase-based: 23 RLS policies
key off `auth.uid()`, `public.profiles.id` is a `uuid` FK into
`auth.users(id)`, and `lib/supabase/proxy.ts` (the route-protecting
middleware) plus 12 server action files all call
`supabase.auth.getUser()`/`getSession()` to identify the current user.

Two alternatives were considered and rejected:

- **Firebase as the sole auth system, RLS disabled.** Rejected: disabling
  RLS exposes every table to anyone holding the (public, browser-exposed)
  anon key. Separately, disconnecting Firebase from Supabase breaks the
  middleware's login gate and all 12 server actions that resolve "current
  user" via Supabase — this is not additive, it silently breaks existing
  features.
- **Supabase "Third-Party Auth" with Firebase as JWT issuer** (Supabase
  does officially support this — `accessToken` option confirmed present in
  the installed `@supabase/supabase-js`). Rejected for now: Firebase UIDs
  aren't UUIDs, so it requires migrating `profiles.id` and every FK column
  that references it (`created_by`, `user_id`, `reviewer_id`, `target_id`,
  ...) from `uuid` to `text`, rewriting the `handle_new_user` trigger
  (never fires under third-party auth, since no `auth.users` row is
  created), and rewriting `lib/supabase/client.ts`/`server.ts`/`proxy.ts`
  to use the `accessToken` callback pattern. `proxy.ts` runs on the Edge
  runtime, where `firebase-admin` doesn't work, so verifying Firebase
  tokens there would additionally require a `jose` + Firebase JWKS setup.
  Substantially larger blast radius for the same user-facing outcome.

**Chosen approach:** Firebase Auth is used *only* to drive the Google
popup and obtain a Google ID token. That token is immediately handed to
`supabase.auth.signInWithIdToken({ provider: 'google', token })`, which
Supabase verifies against Google directly and turns into a real Supabase
user + session. Everything downstream (RLS, middleware, server actions,
the `handle_new_user` trigger that populates `profiles` from
`full_name`/`avatar_url` in user metadata) keeps working unmodified.

## Scope

In scope:
- Firebase client initialization (Auth only)
- A shared "Sign in with Google" button component
- Wiring it into `LoginForm` and `RegisterForm`
- Env var plumbing for the Firebase config (not hardcoded)

Out of scope (explicitly deferred, not part of this change):
- Firebase Analytics (not needed for auth; `getAnalytics` also breaks
  under SSR since it requires `window`)
- Any Supabase schema change
- Any change to `proxy.ts`, RLS policies, or the 12 existing server action
  files — none are needed under this approach
- Third-party auth / disabling RLS (rejected above)

## Files

**New:**
- `lib/firebase/client.ts` — `initializeApp` + `getAuth`, reading config
  from `NEXT_PUBLIC_FIREBASE_*` env vars. Guarded so it only initializes
  once (Next.js can re-evaluate modules in dev).
- `components/auth/google-sign-in-button.tsx` — shared button used by both
  forms. On click:
  1. `signInWithPopup(auth, new GoogleAuthProvider())`
  2. Pull the Google ID token via
     `GoogleAuthProvider.credentialFromResult(result)`
  3. `supabase.auth.signInWithIdToken({ provider: 'google', token })`
  4. On success: `router.push('/teams'); router.refresh()`
  5. On failure: surface an error via an `onError(message)` callback prop,
     so each form renders it through its existing `serverError` state —
     no new UI pattern introduced (sonner's `<Toaster />` isn't mounted in
     the app, so toast-based errors would silently not render).

**Modified:**
- `components/auth/login-form.tsx`, `components/auth/register-form.tsx` —
  add a divider ("hoặc") and `<GoogleSignInButton onError={setServerError} />`
  below the existing submit button.
- `.env.local.example` — document the new `NEXT_PUBLIC_FIREBASE_*` keys
  (placeholder values, matching the existing convention for the Supabase
  keys).
- `.env.local` — actual values, filled in by the user (not committed).

## Error handling

- Popup closed by the user (`auth/popup-closed-by-user`): no error shown —
  this is a normal cancel, not a failure.
- Popup blocked (`auth/popup-blocked`): "Trình duyệt đã chặn popup, vui
  lòng cho phép popup để đăng nhập bằng Google."
- `signInWithIdToken` failure (e.g. Client ID not yet authorized in
  Supabase's Google provider settings): show `error.message` directly —
  this case is expected during initial setup and the raw message is more
  useful for debugging than a generic string.

## Manual setup (outside this codebase, done by the user)

1. Firebase Console → Authentication → Sign-in method → enable Google.
2. Google Cloud Console → Credentials → copy the Web Client ID that
   Firebase auto-created.
3. Supabase Dashboard → Authentication → Providers → Google → enable, add
   that Client ID under "Authorized Client IDs".
4. Fill `NEXT_PUBLIC_FIREBASE_*` values into `.env.local`.

This spec does not cover walking through these consoles interactively;
the implementation plan will note them as a prerequisite checklist.

## Testing

- Unit-level: not much pure logic to test (the button is thin glue over
  two SDK calls). No new test file planned; existing `vitest` suite is
  unaffected.
- Manual verification (per `webapp-testing`/`verify` conventions used in
  this repo): run `npm run dev`, click through the Google button on both
  `/login` and `/register`, confirm a new Google user lands on `/teams`
  with a working session (i.e. the middleware doesn't bounce them back to
  `/login`), and confirm the resulting `profiles` row has `full_name`/
  `avatar_url` populated from Google.
