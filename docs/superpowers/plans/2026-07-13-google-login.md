# Google Login (Firebase popup → Supabase session) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sign in with Google" button to the login and register pages that authenticates via a Firebase popup and lands the user in a normal, RLS-compatible Supabase session.

**Architecture:** Firebase Auth (`signInWithPopup` + `GoogleAuthProvider`) is used only to collect a Google ID token from the popup. That token is immediately passed to `supabase.auth.signInWithIdToken({ provider: 'google', token })`, which Supabase verifies against Google directly and turns into a real `auth.users` row + session — identical in shape to what email/password sign-in produces today. No other part of the app (RLS policies, `lib/supabase/proxy.ts` middleware, the 12 files that call `supabase.auth.getUser()`) needs to change.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, `firebase` ^12.16.0 (`firebase/app`, `firebase/auth` only — no Analytics), `@supabase/supabase-js` ^2.110.2, `react-hook-form` + `zod` v4 for the existing forms, Vitest for unit tests, Vietnamese UI copy.

## Global Constraints

- Follow the design in `docs/superpowers/specs/2026-07-13-google-login-design.md` — Firebase is used **only** for the popup handshake; it must never become a second source of truth for identity.
- Do not modify `lib/supabase/proxy.ts`, `supabase/schema.sql`, any RLS policy, or any of the 12 existing server action files. This feature needs none of those changes.
- Do not add Firebase Analytics (`firebase/analytics`) — not needed for auth, and `getAnalytics()` throws outside the browser.
- All new imports use the `@/` path alias, matching every existing file in this repo (see `components/auth/login-form.tsx`).
- All user-facing copy is Vietnamese, matching the existing forms' tone (`Đăng nhập`, `Tạo tài khoản`, etc.).
- New unit tests live under `tests/lib/`, mirroring the existing convention (see `tests/lib/validations.test.ts`) — not colocated with source files.
- `.env.local` is git-ignored (`.gitignore` line `.env*` with an explicit exception only for `.env.local.example`) — real Firebase config values are safe to write there.

---

### Task 1: Firebase client singleton + environment variables

**Files:**
- Create: `lib/firebase/client.ts`
- Modify: `.env.local.example`
- Modify: `.env.local`

**Interfaces:**
- Produces: `export const auth: import('firebase/auth').Auth` from `lib/firebase/client.ts` — this is what Task 3's button imports to call `signInWithPopup`.

- [ ] **Step 1: Add the Firebase env vars to `.env.local.example`**

Append to the end of the existing file (keep the existing Supabase lines untouched):

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

- [ ] **Step 2: Add the real values to `.env.local`**

Append the same six keys to `.env.local`, using the actual Firebase project config (already shared in this project's chat history for the `candor-6e48f` Firebase project):

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC1ZWYBoN0o6ooyGszWA6CjdxyZ3e9MhN8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=candor-6e48f.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=candor-6e48f
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=candor-6e48f.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=749874822815
NEXT_PUBLIC_FIREBASE_APP_ID=1:749874822815:web:300678d1efe8ac13bc2caa
```

- [ ] **Step 3: Create `lib/firebase/client.ts`**

```ts
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
```

The `getApps().length ? getApp() : initializeApp(...)` guard prevents a "Firebase App named '[DEFAULT]' already exists" crash when Next.js Fast Refresh re-evaluates this module in dev.

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `lib/firebase/client.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/firebase/client.ts .env.local.example
git commit -m "feat: add Firebase client singleton for Google auth"
```

(`.env.local` is git-ignored and will not be staged by this command — that's expected.)

---

### Task 2: Google sign-in error message mapping (TDD)

**Files:**
- Create: `lib/firebase/google-error.ts`
- Test: `tests/lib/google-error.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export function getGoogleSignInErrorMessage(error: unknown): string | null` — Task 3's button calls this on every caught/returned error from both the Firebase popup step and the Supabase `signInWithIdToken` step. Returning `null` means "don't show anything" (user-initiated cancel); a non-null string is shown via the form's existing `serverError` state.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/google-error.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { getGoogleSignInErrorMessage } from '@/lib/firebase/google-error'

describe('getGoogleSignInErrorMessage', () => {
  it('returns null when the user closes the popup themselves', () => {
    const error = new FirebaseError('auth/popup-closed-by-user', 'Popup closed by user')
    expect(getGoogleSignInErrorMessage(error)).toBeNull()
  })

  it('returns a Vietnamese message when the popup is blocked', () => {
    const error = new FirebaseError('auth/popup-blocked', 'Popup blocked')
    expect(getGoogleSignInErrorMessage(error)).toBe(
      'Trình duyệt đã chặn popup, vui lòng cho phép popup để đăng nhập bằng Google.'
    )
  })

  it('falls back to the message of any other Error (e.g. a Supabase AuthError)', () => {
    expect(getGoogleSignInErrorMessage(new Error('invalid client id'))).toBe('invalid client id')
  })

  it('falls back to a generic Vietnamese message for non-Error values', () => {
    expect(getGoogleSignInErrorMessage('not an error')).toBe('Đăng nhập Google thất bại.')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/google-error.test.ts`
Expected: FAIL — `Cannot find module '@/lib/firebase/google-error'`.

- [ ] **Step 3: Implement `lib/firebase/google-error.ts`**

```ts
import { FirebaseError } from 'firebase/app'

export function getGoogleSignInErrorMessage(error: unknown): string | null {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/popup-closed-by-user') {
      return null
    }
    if (error.code === 'auth/popup-blocked') {
      return 'Trình duyệt đã chặn popup, vui lòng cho phép popup để đăng nhập bằng Google.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Đăng nhập Google thất bại.'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/google-error.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/firebase/google-error.ts tests/lib/google-error.test.ts
git commit -m "feat: map Firebase Google sign-in errors to user-facing messages"
```

---

### Task 3: GoogleSignInButton component

**Files:**
- Create: `components/auth/google-sign-in-button.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/firebase/client` (Task 1), `getGoogleSignInErrorMessage` from `@/lib/firebase/google-error` (Task 2), `createClient` from `@/lib/supabase/client` (existing), `Button` from `@/components/ui/button` (existing).
- Produces: `export function GoogleSignInButton({ onError }: { onError: (message: string) => void }): JSX.Element` — Tasks 4 and 5 render this inside `LoginForm`/`RegisterForm`, passing their existing `setServerError` as `onError`.

- [ ] **Step 1: Create `components/auth/google-sign-in-button.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { getGoogleSignInErrorMessage } from '@/lib/firebase/google-error'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.27a12 12 0 0 0 0 10.76l4-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.62l4 3.11C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  )
}

type GoogleSignInButtonProps = {
  onError: (message: string) => void
}

export function GoogleSignInButton({ onError }: GoogleSignInButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleClick() {
    setIsSubmitting(true)
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      const credential = GoogleAuthProvider.credentialFromResult(result)
      if (!credential?.idToken) {
        onError('Không lấy được token từ Google.')
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential.idToken,
      })
      if (error) {
        onError(getGoogleSignInErrorMessage(error) ?? error.message)
        return
      }

      router.push('/teams')
      router.refresh()
    } catch (error) {
      const message = getGoogleSignInErrorMessage(error)
      if (message) {
        onError(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={isSubmitting}
      onClick={handleClick}
    >
      <GoogleIcon />
      Đăng nhập với Google
    </Button>
  )
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `google-sign-in-button.tsx`.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 3: Commit**

```bash
git add components/auth/google-sign-in-button.tsx
git commit -m "feat: add GoogleSignInButton (Firebase popup -> Supabase signInWithIdToken)"
```

---

### Task 4: Wire the Google button into `LoginForm`

**Files:**
- Modify: `components/auth/login-form.tsx`

**Interfaces:**
- Consumes: `GoogleSignInButton` from `@/components/auth/google-sign-in-button` (Task 3), `FieldSeparator` from `@/components/ui/field` (existing, already exports it — used elsewhere for "or" dividers).

- [ ] **Step 1: Add the import**

In `components/auth/login-form.tsx`, change:

```tsx
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
```

to:

```tsx
import { Field, FieldGroup, FieldLabel, FieldError, FieldSeparator } from '@/components/ui/field'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
```

- [ ] **Step 2: Add the divider and button after the submit button**

Change:

```tsx
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Đăng nhập
        </Button>
      </FieldGroup>
    </form>
```

to:

```tsx
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Đăng nhập
        </Button>
        <FieldSeparator>hoặc</FieldSeparator>
        <GoogleSignInButton onError={setServerError} />
      </FieldGroup>
    </form>
```

- [ ] **Step 3: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `login-form.tsx`.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Commit**

```bash
git add components/auth/login-form.tsx
git commit -m "feat: add Google sign-in button to the login form"
```

---

### Task 5: Wire the Google button into `RegisterForm`

**Files:**
- Modify: `components/auth/register-form.tsx`

**Interfaces:**
- Consumes: same as Task 4 — `GoogleSignInButton` and `FieldSeparator`.

- [ ] **Step 1: Add the import**

In `components/auth/register-form.tsx`, change:

```tsx
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
```

to:

```tsx
import { Field, FieldGroup, FieldLabel, FieldError, FieldSeparator } from '@/components/ui/field'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
```

- [ ] **Step 2: Add the divider and button after the submit button**

Change:

```tsx
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Tạo tài khoản
        </Button>
      </FieldGroup>
    </form>
```

to:

```tsx
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          Tạo tài khoản
        </Button>
        <FieldSeparator>hoặc</FieldSeparator>
        <GoogleSignInButton onError={setServerError} />
      </FieldGroup>
    </form>
```

- [ ] **Step 3: Verify it type-checks and lints**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `register-form.tsx`.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Commit**

```bash
git add components/auth/register-form.tsx
git commit -m "feat: add Google sign-in button to the register form"
```

---

### Task 6: Console setup + end-to-end manual verification

This task has no code changes — it configures the three external consoles per the design's "Manual setup" section, then verifies the whole flow actually works. **This task must be done by the project owner** (requires access to accounts this assistant cannot reach), and it's the only way to confirm Tasks 1–5 actually function, since there is no automated test that can exercise a real Google OAuth popup.

**Files:** none.

- [ ] **Step 1: Enable Google sign-in in Firebase**

Firebase Console → project `candor-6e48f` → Authentication → Sign-in method → enable "Google" as a provider.

- [ ] **Step 2: Copy the Web Client ID**

Google Cloud Console → project `candor-6e48f` → APIs & Services → Credentials → find the OAuth 2.0 Client ID named "Web client (auto created by Google Service)" → copy its Client ID (not the secret).

- [ ] **Step 3: Authorize that Client ID in Supabase**

Supabase Dashboard → this project → Authentication → Providers → Google → enable it → paste the Client ID from Step 2 into "Authorized Client IDs" → Save.

- [ ] **Step 4: Run the app locally**

Run: `npm run dev`

- [ ] **Step 5: Click through the login page**

Open `http://localhost:3000/login`, click "Đăng nhập với Google", complete the Google popup with a real Google account.
Expected: redirected to `/teams`, and reloading any page under `/teams` does **not** bounce you back to `/login` (confirms `lib/supabase/proxy.ts` sees a valid Supabase session).

- [ ] **Step 6: Confirm the profile row was created correctly**

Supabase Dashboard → Table Editor → `profiles` → find the new row.
Expected: `full_name` and `avatar_url` are populated from the Google account (proves the existing `handle_new_user` trigger fired correctly for this third-party sign-in, same as it does for email/password).

- [ ] **Step 7: Click through the register page with a second Google account**

Open `http://localhost:3000/register`, click "Đăng nhập với Google" with a Google account that has never signed in before.
Expected: same result as Step 5 — lands on `/teams` with a working session.

- [ ] **Step 8: Run the full test suite one more time**

Run: `npm run test`
Expected: all tests pass, including the 4 new tests from Task 2.

No commit for this task (no files changed).
