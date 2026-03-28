# V3 Engineering Tickets: Auth, Round Persistence & Analytics

**Generated:** 2026-03-28  
**CTO Review:** Complete  
**PRD Reference:** `docs/specs/v3-PRD-auth-rounds-analytics.md`  
**Ticket Range:** THEA-125 → THEA-156 (32 tickets)  
**Total Estimate:** ~130h

---

## Technical Validation Notes (CTO)

Before the tickets, a few findings from validating the PRD against the actual codebase:

1. **`src/lib/supabase.ts` already exists** — typed with `Database` generic, `persistSession`, `autoRefreshToken`, `detectSessionInUrl` all configured. No prerequisite ticket needed.
2. **No charting library in `package.json`** — The analytics dashboard requires charts (line, bar). Recharts is the recommended pick (React 19 compatible, tree-shakeable, TS types included). Added THEA-125 as Phase 0 prerequisite.
3. **`gir` field missing from `types.ts` Hole interface** — PRD adds `gir boolean` to holes DB schema and references it in analytics, but the frontend type doesn't have it yet. Folded into the types update ticket.
4. **React 19 (not 18)** — Brief says React 18; repo has React 19.2.4. No material impact, but confirm Recharts compatibility before installing (v2.12+ supports React 19).
5. **Store has no auth or sync state** — `userId`, `profile`, sync queue all need to be added. Standalone ticket for this.
6. **Club bag sync** — PRD Open Question OQ-3 resolved as "Yes, in scope for V3". Added explicit ticket THEA-140.
7. **`completeRound()` is already in store** — wiring sync to it is an edit, not a rewrite. Estimate is S.
8. **`handicap_differential`, `course_rating`, `slope_rating` columns** — PRD says these need migration, but the `Round` TypeScript interface already has `courseRating?` and `slopeRating?`. The DB migration is the only work here.

---

## Phase Overview

| Phase | Tickets | Theme | Estimate |
|-------|---------|-------|----------|
| Phase 0 | THEA-125 | Prerequisites | S |
| Phase 1 | THEA-126 – THEA-131 | Auth Foundation | ~18h |
| Phase 2 | THEA-132 – THEA-140 | DB Migrations, Types, Sync Infrastructure | ~22h |
| Phase 3 | THEA-141 – THEA-146 | Round History & Resume | ~21h |
| Phase 4 | THEA-147 – THEA-149 | Guest Migration | ~10h |
| Phase 5 | THEA-150 – THEA-156 | Analytics Dashboard | ~27h |
| Phase 6 | THEA-157 – THEA-160 | Polish & QA | ~16h |

---

## THEA-125: Install Recharts charting library

**Type:** chore  
**Assigned:** SE1  
**Phase:** 0  
**Depends on:** none  
**Estimate:** S

### Description
The analytics dashboard (Phase 5) requires line and bar charts. No charting library is currently installed. Install Recharts — it's well-maintained, supports React 19, has TS types bundled, and is tree-shakeable.

### Acceptance Criteria
- [ ] `recharts` added to `package.json` dependencies (`npm install recharts`)
- [ ] `@types/recharts` NOT added (types are bundled)
- [ ] `yarn.lock` / `package-lock.json` committed
- [ ] A smoke-test import `import { LineChart } from 'recharts'` compiles without error
- [ ] Verify React 19 compatibility: Recharts v2.12+ required

### Technical Notes
- Run `npm install recharts@^2.12.0`
- Check for any peer dependency warnings with React 19; suppress with `--legacy-peer-deps` only if necessary and document the reason
- Do NOT install chart.js, victory, or d3 — keep one charting dependency

---

## THEA-126: Create `src/lib/auth.ts` — Supabase auth wrappers

**Type:** feat  
**Assigned:** SE1  
**Phase:** 1  
**Depends on:** none  
**Estimate:** S

### Description
Create a thin wrapper module around Supabase Auth so the rest of the app never imports `supabase.auth` directly. This centralizes auth logic and makes it easier to mock in tests.

### Acceptance Criteria
- [ ] File created at `src/lib/auth.ts`
- [ ] Exports: `signUp`, `signIn`, `signOut`, `resetPassword`, `onAuthChange`, `getSession`
- [ ] `signUp(email, password, displayName)` → calls `supabase.auth.signUp` with `data: { display_name }` in options metadata
- [ ] `signIn(email, password)` → calls `supabase.auth.signInWithPassword`
- [ ] `signOut()` → calls `supabase.auth.signOut`
- [ ] `resetPassword(email)` → calls `supabase.auth.resetPasswordForEmail` with `redirectTo` pointing to `/reset-password`
- [ ] `onAuthChange(callback)` → wraps `supabase.auth.onAuthStateChange`; returns the unsubscribe function
- [ ] `getSession()` → returns `supabase.auth.getSession()`
- [ ] All functions return typed results; errors are surfaced (not swallowed)
- [ ] TypeScript compiles with zero errors

### Technical Notes
- Import `supabase` from `../lib/supabase`
- The `display_name` metadata set on signup is used by the DB trigger that auto-creates the `profiles` row — confirm the trigger reads `raw_user_meta_data->>'display_name'`; if it doesn't, note it as a follow-up
- `resetPassword` redirect URL: use `window.location.origin + '/reset-password'` to support both local dev and Vercel previews
- Do NOT handle auth state here — that's the hook's job (THEA-127)

---

## THEA-127: Create `src/hooks/useAuth.ts` — React auth state hook

**Type:** feat  
**Assigned:** SE1  
**Phase:** 1  
**Depends on:** THEA-126  
**Estimate:** S

### Description
Create a React hook that subscribes to auth state changes and returns current user/session info. Components use this hook; they never call `onAuthChange` directly.

### Acceptance Criteria
- [ ] File created at `src/hooks/useAuth.ts`
- [ ] Hook signature: `useAuth(): { user: User | null, session: Session | null, loading: boolean }`
- [ ] On mount: calls `getSession()` to hydrate initial state; sets `loading = false` when resolved
- [ ] Subscribes to `onAuthChange`; updates state on each event
- [ ] Unsubscribes on unmount (no memory leaks)
- [ ] `loading` is `true` only during the initial session check (not on subsequent changes)
- [ ] TypeScript compiles with zero errors

### Technical Notes
- Use `useEffect` with cleanup for the subscription
- Initial session load should handle the case where `getSession()` rejects (network down) — catch and set `loading = false` with `user: null`
- Types: `User` and `Session` are from `@supabase/supabase-js`
- This hook does NOT write to Zustand — that's the store integration ticket (THEA-128)

---

## THEA-128: Extend Zustand store with auth + sync state

**Type:** feat  
**Assigned:** SE1  
**Phase:** 1  
**Depends on:** THEA-127  
**Estimate:** M

### Description
Extend `src/store/index.ts` to hold auth state (`userId`, `profile`, `isAuthenticated`) and sync metadata (`syncStatus` map, `syncQueue`). This is the single source of truth for whether the user is logged in and which rounds have been synced.

### Acceptance Criteria
- [ ] `StoreState` interface extended with:
  - `userId: string | null`
  - `profile: UserProfile | null`
  - `isAuthenticated: boolean`
  - `syncStatus: Record<string, 'local' | 'synced' | 'pending' | 'error'>`
  - `syncQueue: SyncQueueItem[]`
- [ ] Actions added:
  - `setUserId(id: string | null): void`
  - `setProfile(profile: UserProfile | null): void`
  - `setAuthState(userId: string | null, profile: UserProfile | null): void` — sets both atomically
  - `markRoundSynced(roundId: string): void` — sets `syncStatus[roundId] = 'synced'`
  - `markRoundPending(roundId: string): void` — sets `syncStatus[roundId] = 'pending'`
  - `markRoundError(roundId: string): void` — sets `syncStatus[roundId] = 'error'`
  - `queueSync(item: SyncQueueItem): void`
  - `dequeueSync(roundId: string): void`
- [ ] Auth state is NOT persisted to localStorage (it's derived from Supabase session on load)
- [ ] `syncStatus` IS persisted to localStorage so badges survive reload
- [ ] An `AuthProvider` component (or `App.tsx` effect) calls `setAuthState` when `useAuth` fires — wire this up
- [ ] TypeScript compiles with zero errors

### Technical Notes
- `UserProfile` and `SyncQueueItem` types come from THEA-134 (types.ts update); if THEA-134 isn't merged yet, define inline and reconcile
- Persist only: `clubBag`, `rounds`, `activeRoundId`, `syncStatus` — not auth state
- The `AuthProvider` pattern: wrap `App.tsx` with a component that subscribes to `useAuth` and calls `store.setAuthState` — keeps store and auth in sync without prop drilling
- `isAuthenticated` is derived: `userId !== null`

---

## THEA-129: Build `AuthModal` component (Sign In / Sign Up tabs)

**Type:** feat  
**Assigned:** SE2  
**Phase:** 1  
**Depends on:** THEA-128  
**Estimate:** M

### Description
Build the `AuthModal` component at `src/components/AuthModal.tsx`. This modal handles sign-up and sign-in in a tabbed UI. It is the primary entry point for authentication and is reused throughout the app (Profile page, post-round prompt, migration flow).

### Acceptance Criteria
- [ ] Component at `src/components/AuthModal.tsx`
- [ ] Props: `{ isOpen: boolean, onClose: () => void, defaultTab?: 'signin' | 'signup' }`
- [ ] Two tabs: "Sign In" and "Sign Up"
- [ ] **Sign In tab fields:** Email, Password (with show/hide toggle), Submit button, "Forgot password?" link
- [ ] **Sign Up tab fields:** Display Name (optional, defaults to email prefix), Email, Password, Password strength indicator, Submit button
- [ ] Password strength indicator: shows "Weak / Fair / Strong" based on length + character variety
- [ ] On sign-in success: modal closes, store updated via `setAuthState`
- [ ] On sign-up success: modal closes; trigger migration check (emit event or call callback — see THEA-147)
- [ ] Error states displayed inline below the relevant field:
  - Invalid email format
  - Password < 8 characters
  - "Invalid email or password" (sign-in failure — no enumeration of which is wrong)
  - "Email already in use" (sign-up)
- [ ] Loading state: submit button disabled + spinner while request in-flight
- [ ] "Forgot password?" triggers `resetPassword(email)` and shows confirmation text: "Check your email for a reset link"
- [ ] Modal is dismissible via backdrop click or Escape key (unless loading)
- [ ] Accessible: focus traps inside modal, aria-modal, labeled fields
- [ ] Mobile-first layout; full-screen on small viewports

### Technical Notes
- Use `src/lib/auth.ts` functions — never call `supabase.auth` directly here
- Password strength: simple heuristic — length ≥8 (weak), +uppercase+number (fair), +special char (strong). No need for zxcvbn.
- On successful sign-in, call `store.setAuthState(user.id, profile)`. Profile fetch happens in THEA-139 — for now store profile as null and let the Profile screen fetch it.
- Tailwind classes only — no CSS modules
- The modal backdrop: `fixed inset-0 bg-black/50 z-50`

---

## THEA-130: Implement password reset flow

**Type:** feat  
**Assigned:** SE2  
**Phase:** 1  
**Depends on:** THEA-129  
**Estimate:** S

### Description
Handle the password reset deep-link. When a user clicks the magic link in their email, Supabase redirects to the app with a hash/token. The app must detect this, show a "set new password" form, and complete the reset.

### Acceptance Criteria
- [ ] Route `/reset-password` added to `react-router-dom` router config
- [ ] Page at `src/pages/ResetPassword.tsx`
- [ ] On mount: detects `#access_token` in URL hash (Supabase redirect); extracts and exchanges token
- [ ] Shows form: "New Password" + "Confirm Password" fields
- [ ] Validation: min 8 chars, passwords match
- [ ] On submit: calls `supabase.auth.updateUser({ password })` 
- [ ] On success: shows "Password updated!" message + navigates to `/profile` after 2s
- [ ] On failure: shows error message inline
- [ ] If accessed without valid token (no hash): shows "This link has expired. Request a new one." with link back to sign-in

### Technical Notes
- Supabase v2 password reset: after the user clicks the email link, the URL contains a fragment with `access_token` and `type=recovery`. Use `supabase.auth.onAuthStateChange` — it fires a `PASSWORD_RECOVERY` event which sets the session; then call `updateUser`.
- Alternative: `supabase.auth.setSession` with the tokens from the hash, then `updateUser`
- The `redirectTo` in `auth.ts resetPassword()` must match this route exactly (THEA-126)
- Update Supabase dashboard redirect URLs to include the Vercel preview pattern `https://*.vercel.app/reset-password`

---

## THEA-131: Auth session persistence on app reload

**Type:** feat  
**Assigned:** SE1  
**Phase:** 1  
**Depends on:** THEA-128  
**Estimate:** S

### Description
When the app reloads, the Supabase client auto-restores the session from localStorage (it's configured with `persistSession: true`). Wire up the app initialization sequence to hydrate the Zustand store from this restored session before rendering protected content.

### Acceptance Criteria
- [ ] On app mount (before render), call `getSession()` and populate `userId` + `profile` in store if session exists
- [ ] A loading state prevents flash of unauthenticated UI during hydration (show spinner or skeleton)
- [ ] If `getSession()` returns null, store stays in guest state — no error
- [ ] If session exists but profile fetch fails (network down), app still loads in auth'd state with `profile: null`
- [ ] Session auto-refresh works: Supabase renews the token silently; no user action required
- [ ] Sign-out clears session from localStorage and resets `userId`/`profile` in store

### Technical Notes
- This is largely wiring, not new logic. The `AuthProvider` pattern from THEA-128 handles this.
- Put the session hydration in `App.tsx` or a top-level `AuthProvider` component using a `useEffect` with an empty dependency array
- The Supabase client's `detectSessionInUrl: true` config handles OAuth redirect tokens — keep it
- Test: reload the app while signed in; you should not see the sign-in screen briefly

---

## THEA-132: DB migration — add `penalties` and `gir` to `holes`

**Type:** migration  
**Assigned:** SE1  
**Phase:** 2  
**Depends on:** none  
**Estimate:** S

### Description
The `holes` table is missing the `penalties` column (a known gap called out in the context brief) and the `gir` (green in regulation) column required by the analytics dashboard.

### Acceptance Criteria
- [ ] Migration file created at `supabase/migrations/20260328000002_add_penalties_gir_to_holes.sql`
- [ ] `penalties int default 0` added to `holes` table
- [ ] `gir boolean` added to `holes` table (nullable — not all users track GIR)
- [ ] Migration uses `ADD COLUMN IF NOT EXISTS` for idempotency
- [ ] Migration applied to Supabase project (run `supabase db push` or apply via dashboard)
- [ ] Existing rows unaffected: `penalties` defaults to 0, `gir` defaults to null
- [ ] RLS policies on `holes` table still valid after migration (verify — no policy changes needed, just column additions)

### Technical Notes
```sql
-- supabase/migrations/20260328000002_add_penalties_gir_to_holes.sql
ALTER TABLE public.holes
  ADD COLUMN IF NOT EXISTS penalties int default 0,
  ADD COLUMN IF NOT EXISTS gir boolean;
```
- This migration is a prerequisite for sync (THEA-135) since `syncRoundToSupabase` will write `penalties` and `gir`
- Check `src/lib/database.types.ts` — regenerate types after migration: `supabase gen types typescript --linked > src/lib/database.types.ts`

---

## THEA-133: DB migration — add `handicap_differential`, `course_rating`, `slope_rating` to `rounds`

**Type:** migration  
**Assigned:** SE1  
**Phase:** 2  
**Depends on:** none  
**Estimate:** S

### Description
Add the missing columns to the `rounds` table needed for handicap calculation and analytics. The TypeScript `Round` interface already has `courseRating` and `slopeRating`, but the DB columns may be missing.

### Acceptance Criteria
- [ ] Migration file created at `supabase/migrations/20260328000001_add_handicap_fields_to_rounds.sql`
- [ ] `handicap_differential numeric(4,1)` added to `rounds`
- [ ] `course_rating numeric(4,1)` added to `rounds`
- [ ] `slope_rating int` added to `rounds`
- [ ] All use `ADD COLUMN IF NOT EXISTS` for idempotency
- [ ] Migration applied to Supabase project
- [ ] Regenerate `database.types.ts` after applying

### Technical Notes
```sql
-- supabase/migrations/20260328000001_add_handicap_fields_to_rounds.sql
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS handicap_differential numeric(4,1),
  ADD COLUMN IF NOT EXISTS course_rating numeric(4,1),
  ADD COLUMN IF NOT EXISTS slope_rating int;
```
- Note: `tee_set` column exists on DB schema per PRD but frontend uses `teeSet` — confirm column name mapping in sync logic (THEA-135)
- Prerequisite for sync logic in THEA-135

---

## THEA-134: Update `src/types.ts` with auth, sync, and analytics types

**Type:** chore  
**Assigned:** SE1  
**Phase:** 2  
**Depends on:** none  
**Estimate:** S

### Description
Add new TypeScript interfaces and extend existing ones to support auth, sync, and analytics features. This is a pure types update — no runtime logic.

### Acceptance Criteria
- [ ] `Hole` interface gains `gir?: boolean` field
- [ ] New interface `UserProfile` added:
  ```ts
  interface UserProfile {
    id: string
    displayName: string
    homeCourse?: string
    handicapIndex?: number
    createdAt: string
    updatedAt: string
  }
  ```
- [ ] New type `SyncStatusValue = 'local' | 'synced' | 'pending' | 'error'`
- [ ] New interface `SyncStatus`:
  ```ts
  interface SyncStatus {
    roundId: string
    status: SyncStatusValue
    syncedAt?: number
    error?: string
  }
  ```
- [ ] New interface `SyncedRound` extending `Round`:
  ```ts
  interface SyncedRound extends Round {
    userId?: string
    syncStatus: SyncStatusValue
    remoteId?: string
  }
  ```
- [ ] New interface `SyncQueueItem`:
  ```ts
  interface SyncQueueItem {
    type: 'round' | 'profile' | 'clubs'
    operation: 'upsert' | 'delete'
    data: unknown
    queuedAt: number
    retries: number
  }
  ```
- [ ] All existing types unchanged; TypeScript compiles with zero errors

### Technical Notes
- These types are consumed by THEA-128 (store), THEA-135 (sync), THEA-150 (analytics)
- Export all new types from `src/types.ts` — do not create separate files for just types
- `SyncedRound` is used in the History screen to merge local + remote rounds with status indicators

---

## THEA-135: Create `src/lib/sync.ts` — round sync logic

**Type:** feat  
**Assigned:** SE1  
**Phase:** 2  
**Depends on:** THEA-128, THEA-132, THEA-133, THEA-134  
**Estimate:** L

### Description
Create the core sync module. This is the most critical file in the V3 feature set — it handles writing local rounds to Supabase and fetching remote rounds back. All other sync features build on this.

### Acceptance Criteria
- [ ] File at `src/lib/sync.ts`
- [ ] `syncRoundToSupabase(round: Round, userId: string): Promise<{ success: boolean; error?: string }>`:
  - Upserts `rounds` row with all fields including `handicap_differential`, `course_rating`, `slope_rating`
  - Upserts each `holes` row including `penalties` and `gir`
  - Upserts each `shots` row in the hole with `sequence`, `club_id`, `club_name`, `is_putt`
  - Uses round's local UUID as the Supabase `id` (stable cross-device identifier)
  - Returns `{ success: true }` or `{ success: false, error: message }`
- [ ] `fetchRounds(userId: string): Promise<Round[]>`:
  - Fetches all non-deleted rounds for user, ordered by `started_at DESC`
  - Joins holes and shots in a single query (or sequential fetch — document the approach)
  - Maps DB rows back to frontend `Round` type
  - Returns empty array on error (log error, don't throw)
- [ ] `fetchProfile(userId: string): Promise<UserProfile | null>`:
  - Fetches `profiles` row by `id`
  - Returns null if not found
- [ ] `updateProfile(userId: string, patch: Partial<Pick<UserProfile, 'displayName' | 'homeCourse'>>): Promise<{ success: boolean }>`:
  - Upserts profile with patch data
- [ ] `syncClubs(userId: string, clubs: Club[]): Promise<{ success: boolean }>`:
  - Upserts all non-deleted clubs for user
  - Handles `deleted_at` soft-delete

### Technical Notes
- All DB field name mappings: `courseName` → `course_name`, `startedAt` → `started_at` (snake_case in DB, camelCase in TS)
- `is_putt` detection: use `shot.clubId === 'putter'` or check club name contains "putter" (case-insensitive) — document the convention
- For holes upsert: the hole's `id` needs to be stable. Since `Hole` type has no `id` field, generate a deterministic ID: `${round.id}-hole-${hole.number}` (UUID v5 or simple string)
- Same for shots: `${round.id}-hole-${hole.number}-shot-${index}`
- Supabase upsert conflict target: `onConflict: 'id'` for all tables
- Error handling: catch at each upsert level; partial sync is acceptable (don't abort entire round sync if one shot fails — log and continue)
- RLS: all writes pass `user_id` = current session's user; RLS on Supabase verifies this automatically

---

## THEA-136: Implement offline sync queue with retry

**Type:** feat  
**Assigned:** SE1  
**Phase:** 2  
**Depends on:** THEA-135  
**Estimate:** M

### Description
When the user is offline or a sync attempt fails, queue the operation and retry on reconnection with exponential backoff. This prevents data loss when network is unavailable at round completion.

### Acceptance Criteria
- [ ] `SYNC_QUEUE_KEY = 'golf_caddy_sync_queue'` localStorage key stores pending operations
- [ ] When `syncRoundToSupabase` fails, the round is added to the queue with `retries: 0`
- [ ] On app init and on `window.addEventListener('online')`: call `processSyncQueue()`
- [ ] `processSyncQueue()` iterates queue, retries failed items:
  - Max 3 retries per item
  - Exponential backoff: 1s, 4s, 16s between retries
  - After 3 failures: mark round as `error` in store; leave in queue with `retries: 3`
  - On success: remove from queue, mark round as `synced` in store
- [ ] `syncStatus` in store updated throughout: `pending` → `synced` or `error`
- [ ] Queue survives app reload (persisted in localStorage)
- [ ] No duplicate queue entries: check by `roundId` before adding

### Technical Notes
- `processSyncQueue` should be idempotent — safe to call multiple times concurrently (use a lock flag `isSyncingQueue`)
- Backoff: use `setTimeout` wrapped in a `sleep(ms)` utility
- Online detection: `navigator.onLine` + `window.online` event
- Queue items use `SyncQueueItem` type from THEA-134
- Only 'round' type items needed for V3; 'profile' and 'clubs' queue support can be stubbed

---

## THEA-137: Wire `completeRound()` to trigger sync for logged-in users

**Type:** feat  
**Assigned:** SE1  
**Phase:** 2  
**Depends on:** THEA-135  
**Estimate:** S

### Description
Modify the existing `completeRound()` store action to automatically sync the completed round to Supabase when the user is authenticated. This is the primary sync trigger.

### Acceptance Criteria
- [ ] After `completeRound(roundId)` sets `completedAt` and updates localStorage, if `store.isAuthenticated`:
  - Call `markRoundPending(roundId)` immediately
  - Call `syncRoundToSupabase(round, userId)` asynchronously (don't block UI)
  - On success: call `markRoundSynced(roundId)`
  - On failure: call `markRoundError(roundId)` and add to sync queue (THEA-136)
- [ ] If user is not authenticated (guest): round stays local only, `syncStatus` stays `'local'`
- [ ] `completeRound` action itself remains synchronous and fast — sync is fire-and-forget
- [ ] Also compute and store `handicapDifferential` in the round before sync, using existing `src/lib/handicap/` logic

### Technical Notes
- Import `syncRoundToSupabase` from `src/lib/sync.ts`
- Access `userId` from store state within the action: `const { userId } = get()`
- Handicap differential calculation: `src/lib/handicap/` already exists — find the relevant export and call it here; store the result in the round via `updateRound` before syncing
- The round object passed to sync must have `completedAt` set — ensure this happens before the async sync call

---

## THEA-138: Build `SyncIndicator` component + sync status badges

**Type:** feat  
**Assigned:** SE2  
**Phase:** 2  
**Depends on:** THEA-137  
**Estimate:** S

### Description
Visual feedback for sync status. Two components: a small `SyncIndicator` icon (used in nav/headers to show overall sync state) and inline badges on round list items showing per-round sync status.

### Acceptance Criteria
- [ ] `SyncIndicator` component at `src/components/SyncIndicator.tsx`
- [ ] Props: `{ status: 'synced' | 'pending' | 'error' | 'local' }`
- [ ] Visual treatments:
  - `synced`: ☁️ cloud icon (or green checkmark) — "Synced"
  - `pending`: spinner/pulse — "Syncing..."
  - `error`: ⚠️ warning icon — "Sync failed" with tap-to-retry CTA
  - `local`: 📱 phone icon — "Local only"
- [ ] Tap on `error` status badge triggers manual retry: calls `syncRoundToSupabase` for that round
- [ ] A global `SyncStatusBar` sub-component shows overall pending count if >0 items in queue
- [ ] Used in: History screen round rows (THEA-141), Summary page

### Technical Notes
- Use `lucide-react` icons (already installed): `Cloud`, `CloudOff`, `Loader2`, `AlertTriangle`, `Smartphone`
- The `Loader2` icon should animate with `animate-spin` Tailwind class when status is `pending`
- Read sync status from `useAppStore(state => state.syncStatus[roundId])`
- Keep component pure — pass status as prop, don't read store directly (for reusability)

---

## THEA-139: Build Profile screen (`/profile`)

**Type:** feat  
**Assigned:** SE2  
**Phase:** 2  
**Depends on:** THEA-129, THEA-135  
**Estimate:** M

### Description
Build the Profile screen at `src/pages/Profile.tsx`. This screen serves dual purpose: show profile info + stats for authenticated users, and show the auth modal inline for guests.

### Acceptance Criteria
- [ ] Route `/profile` added to router
- [ ] **Authenticated state:**
  - Avatar placeholder (initials-based circle using display name)
  - Display name + email (from `useAuth`)
  - Handicap Index: fetched from `profiles.handicap_index`, shown prominently; includes 12-month Low HI
  - Home Course: editable inline (tap → text field → save)
  - Quick stats: rounds played count, best round (18-hole only), avg score
  - "Edit Display Name" flow (tap → inline edit → calls `updateProfile`)
  - "Sign Out" button with confirmation: "Sign out? You'll stay in guest mode on this device."
  - On sign-out: calls `auth.signOut()`, store cleared, navigate to `/profile` (now guest state)
- [ ] **Guest state:**
  - Shows AuthModal inline (not as overlay) — embed the form directly in the page
  - Brief pitch: "Create an account to save your rounds and track your handicap."
- [ ] Profile data fetched via `fetchProfile(userId)` on mount; cached in store
- [ ] Loading skeleton while fetching
- [ ] Error state if profile fetch fails

### Technical Notes
- Quick stats are derived from `store.rounds` filtered by `completedAt != null`
- For avg score: `SUM(hole strokes) / COUNT(rounds)` — compute from local rounds array
- Best round: min total strokes among 18-hole rounds
- Handicap index display: use `profiles.handicap_index` from DB (authoritative); local calculation is for display only
- Home course edit: debounce the save by 500ms; show checkmark on save confirmation
- Initials avatar: first letter of display name, uppercase, colored circle

---

## THEA-140: Sync club bag to Supabase per user

**Type:** feat  
**Assigned:** SE1  
**Phase:** 2  
**Depends on:** THEA-135  
**Estimate:** M

### Description
Club bag is currently localStorage-only. Since PRD OQ-3 resolved "Yes, club bag syncs to Supabase in V3", implement two-way club sync: push local clubs on sign-in, pull clubs from Supabase on new device login.

### Acceptance Criteria
- [ ] On successful sign-in: call `syncClubs(userId, store.clubBag)` to push local clubs up
- [ ] On sign-in: call `fetchClubs(userId)` to pull server clubs; merge with local (server wins on conflict)
- [ ] `fetchClubs(userId: string): Promise<Club[]>` added to `src/lib/sync.ts`:
  - Fetches non-deleted clubs for user ordered by `sort_order`
  - Maps to frontend `Club` type
- [ ] Club mutations (add, remove, rename, reorder) call `syncClubs` if authenticated (debounced 2s to batch rapid changes)
- [ ] Soft-delete: when `removeClub` is called and user is authenticated, set `deleted_at` in Supabase rather than deleting the row
- [ ] Club sync does not block UI — fire-and-forget with error logging

### Technical Notes
- Club merge strategy: if local and remote have different clubs, union them (show all); if same `id` exists in both, server wins
- `sort_order` in DB corresponds to `order` in frontend type — map carefully
- Debounce sync on mutation: use a `useEffect` in the store or a dedicated hook that watches `clubBag` and syncs after 2s of inactivity
- `syncClubs` in `src/lib/sync.ts` was scaffolded in THEA-135; implement it fully here

---

## THEA-141: Build Round History screen (`/history`)

**Type:** feat  
**Assigned:** SE2  
**Phase:** 3  
**Depends on:** THEA-137, THEA-138  
**Estimate:** M

### Description
Build the Round History screen at `src/pages/History.tsx`. Shows all rounds (local + remote merged) in a scrollable list sorted by date descending.

### Acceptance Criteria
- [ ] Route `/history` added to router
- [ ] Each round row shows:
  - Date (formatted: "Mar 27, 2026")
  - Course name
  - Hole count + tee color/name
  - Total score + score-to-par (e.g., "87 (+15)")
  - Handicap differential (if available, else "—")
  - Sync status badge (from `SyncIndicator` component — THEA-138)
- [ ] Rows sorted by `startedAt` descending
- [ ] Tap row → navigates to `/summary/:roundId` (existing Summary page, or round detail)
- [ ] Empty state: "No rounds yet. Start your first round!" with a CTA to `/`
- [ ] Loading skeleton while fetching remote rounds
- [ ] Guest state: shows local rounds only with a banner "Sign in to access rounds from all devices"

### Technical Notes
- Merge strategy: combine `store.rounds` (local) with `fetchedRounds` from Supabase; deduplicate by `id`; prefer remote data for rounds with matching IDs
- Score-to-par: `totalStrokes - totalPar` where `totalPar` = sum of `hole.par` across all holes
- Total strokes: `round.holes.reduce((acc, h) => acc + h.shots.length + (h.penalties ?? 0), 0)`
- For the initial render, show local rounds immediately; replace/merge with remote data as it loads (no loading flash for already-local rounds)
- History screen is NOT paginated in first pass — load all rounds (reasonable for golf: max ~200 rounds over years); add pagination in THEA-143

---

## THEA-142: Implement round fetch from Supabase + local merge

**Type:** feat  
**Assigned:** SE1  
**Phase:** 3  
**Depends on:** THEA-135  
**Estimate:** M

### Description
Implement the data fetching layer that History and Analytics screens use. Fetch remote rounds on mount, merge with local rounds, and keep the merged result in a React Query cache or local state. This is the data layer for both History and Analytics.

### Acceptance Criteria
- [ ] Hook `useRounds()` created at `src/hooks/useRounds.ts`:
  - Returns `{ rounds: Round[], loading: boolean, error: string | null, refetch: () => void }`
  - On mount: immediately returns local `store.rounds`; fetches remote rounds in background
  - On remote fetch complete: merges remote into local (deduplicate by `id`; remote wins on conflict)
  - Updates `store.rounds` with merged result
  - `refetch()` triggers a new remote fetch
- [ ] Merge algorithm:
  - Union of local and remote round IDs
  - For rounds in both: use remote version (it's the source of truth)
  - For local-only rounds: keep as-is with `syncStatus: 'local'`
  - For remote-only rounds: add to local store with `syncStatus: 'synced'`
- [ ] Guest mode: hook returns local rounds only, no fetch attempted
- [ ] Errors logged; UI shows stale local data on error (graceful degradation)

### Technical Notes
- Do NOT use React Query for now (not installed, not in dependencies) — use a simple `useEffect` + `useState` pattern
- Cache the fetch result in module-level state or a store field to avoid re-fetching on every navigation
- Invalidate cache on `completeRound()` (fetch again after a new round syncs)
- The hook is consumed by `History.tsx` (THEA-141) and `Analytics.tsx` (THEA-151)

---

## THEA-143: Round History filters (All / 9-hole / 18-hole) + pagination

**Type:** feat  
**Assigned:** SE2  
**Phase:** 3  
**Depends on:** THEA-141  
**Estimate:** S

### Description
Add filter tabs and basic pagination to the History screen.

### Acceptance Criteria
- [ ] Three filter tabs at top of History screen: "All", "9 holes", "18 holes"
- [ ] Active tab filters `rounds` array by `holeCount`
- [ ] Active tab visually distinguished (underline or background highlight)
- [ ] Pagination: show 20 rounds per page; "Load more" button at bottom (or infinite scroll via `IntersectionObserver`)
- [ ] Filter persists during the session (not across reloads)
- [ ] Round count shown per tab: "All (47)" "9 holes (12)" "18 holes (35)"

### Technical Notes
- Implement as controlled state in `History.tsx`: `filterTab` ('all' | '9' | '18') and `visibleCount` (starts at 20, +20 on "Load more")
- Filtering happens client-side on the merged rounds array from THEA-142
- `IntersectionObserver` approach is cleaner for mobile but "Load more" button is acceptable for V3

---

## THEA-144: Active round persistence to Supabase (status='active')

**Type:** feat  
**Assigned:** SE1  
**Phase:** 3  
**Depends on:** THEA-135  
**Estimate:** M

### Description
While a round is in progress, periodically persist it to Supabase with `status='active'` so it can be recovered if the device is lost, app crashes, or user switches devices.

### Acceptance Criteria
- [ ] `syncActiveRound(roundId: string, userId: string)` added to `src/lib/sync.ts`:
  - Calls `syncRoundToSupabase` with the current round state (status='active')
  - Idempotent — safe to call multiple times
- [ ] When a round becomes active (user enters Round screen), if authenticated:
  - Immediately sync with `status='active'`
  - Start a 5-minute interval timer: `setInterval(syncActiveRound, 5 * 60 * 1000)`
- [ ] Interval cleared on `completeRound()` and `abandonRound()`
- [ ] Interval cleared on component unmount (cleanup)
- [ ] Each hole update (shot added, putts set, etc.) does NOT trigger an immediate sync (only the interval does — except on `completeRound`)
- [ ] Guest users: active round continues to be localStorage-only (no change)

### Technical Notes
- Start the interval in `Round.tsx`'s `useEffect` — the Round page is the natural lifecycle for this
- Store the interval ID in a `useRef` to clear it on unmount
- If the app goes offline mid-round, the interval attempts will fail silently (no error shown to user during play)
- On reconnect, the interval will eventually fire and sync. Don't add extra reconnection logic here — that's THEA-136's queue.

---

## THEA-145: Build `RestoreRoundBanner` component

**Type:** feat  
**Assigned:** SE2  
**Phase:** 3  
**Depends on:** THEA-144  
**Estimate:** S

### Description
On app launch, if an in-progress round is detected (either in localStorage or Supabase), prompt the user to resume it. This covers the "app crashed mid-round" recovery case.

### Acceptance Criteria
- [ ] Component at `src/components/RestoreRoundBanner.tsx`
- [ ] Shown on the Home screen when `store.activeRoundId` is set and points to an unfinished round
- [ ] Banner text: "You have an in-progress round at [Course Name]. Resume?"
- [ ] Buttons: "Resume" → navigates to `/round/:id`; "Dismiss" → calls `abandonRound(id)` after confirmation
- [ ] If authenticated: also check Supabase for `status='active'` rounds on app launch — if found and not in local store, offer to restore it
- [ ] Confirmation for "Dismiss": "Abandon this round? This can't be undone." (standard confirm modal)
- [ ] Banner is NOT shown if the user is actively on the Round screen

### Technical Notes
- Restoration from Supabase: on app launch (in `App.tsx` or `Home.tsx`), if authenticated, call a new `fetchActiveRound(userId)` function in `sync.ts` that queries rounds with `status='active'` and returns the most recent one
- If Supabase has an active round not in localStorage: offer to load it; on accept, fetch full round data (holes + shots) and hydrate local store via `addRound` + `setActiveRoundId`
- This is the only place where remote data can overwrite a missing local round

---

## THEA-146: Background sync for active rounds (5-min interval)

**Type:** feat  
**Assigned:** SE1  
**Phase:** 3  
**Depends on:** THEA-144  
**Estimate:** S

### Description
This ticket is largely implemented as part of THEA-144 (the 5-minute interval). The remaining work is to ensure the interval is correctly scoped, doesn't run when the app is backgrounded, and logs sync activity for debugging.

### Acceptance Criteria
- [ ] Interval does not fire when `document.hidden === true` (app backgrounded / tab not active)
- [ ] On `visibilitychange` event: if app comes back to foreground during active round, trigger an immediate sync (catches up any missed intervals)
- [ ] Console.debug log on each background sync: `[sync] active round synced: ${roundId}`
- [ ] If user signs out during an active round: interval cleared immediately; round stays local-only
- [ ] Interval cleared on browser tab close (`beforeunload`): attempt a final sync (best-effort)

### Technical Notes
- `document.addEventListener('visibilitychange', handler)` in `Round.tsx` useEffect
- `window.addEventListener('beforeunload', handler)` for final sync attempt — keep this synchronous or use `navigator.sendBeacon` if the round data is small enough
- This is a polish ticket on top of THEA-144; coordinate with SE1 to avoid duplicate interval setup

---

## THEA-147: Detect local rounds on signup + build `MigrationPrompt` modal

**Type:** feat  
**Assigned:** SE2  
**Phase:** 4  
**Depends on:** THEA-129  
**Estimate:** M

### Description
After a user successfully signs up (creating a new account), detect whether there are local rounds that haven't been synced. If so, show the Migration Prompt modal offering to adopt them.

### Acceptance Criteria
- [ ] Component at `src/components/MigrationPrompt.tsx`
- [ ] Props: `{ isOpen: boolean, roundCount: number, onConfirm: () => void, onDecline: () => void }`
- [ ] Modal text: "Welcome! 🎉 We found [N] round[s] on this device. Sync them to your new account?"
- [ ] Buttons: "Yes, sync my rounds" (primary) | "No, start fresh" (secondary)
- [ ] Triggered automatically after signup completes: `AuthModal` on-success callback checks `store.rounds.filter(r => !r.userId).length > 0`
- [ ] If count is 0: skip the prompt entirely (no migration needed)
- [ ] On confirm: triggers THEA-148 migration; shows progress (see THEA-148)
- [ ] On decline: prompt dismissed; rounds remain local; `localStorage` item set to `migration_declined: true` to prevent re-prompting
- [ ] Post sign-in (not sign-up): if user signs in and local rounds exist without userId, show a non-blocking banner (not the full modal) offering to migrate: "You have X local rounds. Sync them?" with a CTA

### Technical Notes
- "Local rounds without userId": `store.rounds.filter(r => !r.syncStatus || r.syncStatus === 'local')`
- The `migration_declined` flag prevents annoying repeat prompts; clear it if user signs out and back in on the same device (they may have changed their mind)
- Animation: slide up from bottom on mobile for the modal

---

## THEA-148: Implement batch sync for local round migration

**Type:** feat  
**Assigned:** SE1  
**Phase:** 4  
**Depends on:** THEA-135, THEA-147  
**Estimate:** M

### Description
When the user confirms migration, batch-sync all local rounds to Supabase sequentially (not in parallel, to avoid rate-limiting and DB contention).

### Acceptance Criteria
- [ ] `migrateLocalRounds(userId: string, rounds: Round[]): Promise<{ synced: number; failed: number }>` added to `src/lib/sync.ts`
- [ ] Processes rounds sequentially (not Promise.all — serial to avoid rate limits)
- [ ] Emits progress: takes a `onProgress(current: number, total: number)` callback
- [ ] On each round sync success: calls `store.markRoundSynced(roundId)`
- [ ] On each round sync failure: continues (don't abort); increments `failed` counter
- [ ] Returns final counts: `{ synced: 5, failed: 1 }`
- [ ] `MigrationPrompt` shows a progress bar during migration: "Syncing round 3 of 5..."
- [ ] On completion: shows success message "5 rounds synced!" or "4 of 5 rounds synced (1 failed)" then closes
- [ ] "Failed" rounds can be retried via the sync queue (THEA-136)

### Technical Notes
- Sequential: `for (const round of rounds) { await syncRoundToSupabase(...) }`
- Do not migrate rounds that are already synced (`syncStatus === 'synced'`)
- Also migrate clubs in the same flow: call `syncClubs` after rounds complete
- The `onProgress` callback updates a `useState` counter in `MigrationPrompt` for the progress bar

---

## THEA-149: Build post-round save prompt for guests

**Type:** feat  
**Assigned:** SE2  
**Phase:** 4  
**Depends on:** THEA-129  
**Estimate:** S

### Description
After a guest completes a round, show a non-blocking banner on the Summary screen prompting them to sign in to save their history.

### Acceptance Criteria
- [ ] Component at `src/components/SaveRoundBanner.tsx` (or inline in `Summary.tsx`)
- [ ] Shown only when: `!store.isAuthenticated` AND round is completed
- [ ] Banner text: "💾 Save this round? Sign in to keep your history and track your handicap."
- [ ] Buttons: "Sign Up" → opens `AuthModal` with `defaultTab='signup'`; "Sign In" → opens `AuthModal` with `defaultTab='signin'`; "Not Now" → dismisses banner
- [ ] "Not Now" stores a per-round dismissal in localStorage: `save_prompt_dismissed_${roundId}: true` — never re-shows for this specific round
- [ ] Frequency cap: show max once per browser session (track in `sessionStorage`)
- [ ] Banner is non-blocking: sits below the summary content, not a modal

### Technical Notes
- Place in `src/pages/Summary.tsx` — check for guest state on mount
- The `defaultTab` prop was defined on `AuthModal` in THEA-129
- When the user successfully signs in/up after this prompt, the round should automatically sync (THEA-137 handles this for the next `completeRound`; for the just-completed round, trigger a manual sync in the `AuthModal` onSuccess callback if `activeRoundId` is set)

---

## THEA-150: Create `src/lib/analytics.ts` — derived metric computations

**Type:** feat  
**Assigned:** SE1  
**Phase:** 5  
**Depends on:** THEA-142  
**Estimate:** M

### Description
Pure computation module for analytics metrics. Takes an array of completed `Round[]` and returns derived stats. No Supabase calls, no React — just data transformation functions.

### Acceptance Criteria
- [ ] File at `src/lib/analytics.ts`
- [ ] `filterByTimeRange(rounds: Round[], range: TimeRange): Round[]` — filter by last 10 / 30d / 90d / all-time
- [ ] `calcAverageScore(rounds: Round[]): number | null` — avg total strokes; null if no rounds
- [ ] `calcBestRound(rounds: Round[]): { strokes: number; roundId: string } | null` — lowest 18-hole round
- [ ] `calcScoringTrend(rounds: Round[]): { slope: number; label: string }` — linear regression over `totalStrokes` per round; label: "Improving", "Worsening", "Stable"
- [ ] `calcFIRPercentage(rounds: Round[]): number | null` — fairways hit % (par >3 holes only)
- [ ] `calcGIRPercentage(rounds: Round[]): number | null` — GIR % (requires `gir` field on holes)
- [ ] `calcPuttsPerRound(rounds: Round[]): number | null` — avg putts per round
- [ ] `calcPuttsPerHole(rounds: Round[]): number | null`
- [ ] `calcThreePuttPercentage(rounds: Round[]): number | null` — holes with `putts >= 3`
- [ ] `calcClubUsage(rounds: Round[]): { clubName: string; shots: number; percentage: number }[]` — exclude putts; sorted descending
- [ ] `calcHandicapTrend(rounds: Round[]): { roundId: string; differential: number; date: number }[]` — for chart; uses `handicapDifferential` field
- [ ] All functions handle edge cases: empty arrays return null/[]
- [ ] 100% TypeScript, no side effects, pure functions
- [ ] Unit tests in `src/lib/analytics.test.ts` covering happy path and edge cases

### Technical Notes
- Linear regression for `calcScoringTrend`: simple least-squares; "Improving" if slope ≤ -0.3, "Worsening" if slope ≥ +0.3, "Stable" otherwise
- `calcFIRPercentage` excludes par-3 holes (`hole.par === 3`)
- Club usage: `hole.shots` filtered by `is_putt === false` — but `Shot` type doesn't have `is_putt`; derive from club name containing "putter" (case-insensitive). Document this limitation.
- `TimeRange` type: `'last10' | 'last30d' | 'last90d' | 'alltime'`
- Export a `type AnalyticsMetrics` aggregated interface for convenience

---

## THEA-151: Build Analytics screen shell with time range filter

**Type:** feat  
**Assigned:** SE2  
**Phase:** 5  
**Depends on:** THEA-125, THEA-142  
**Estimate:** S

### Description
Build the Analytics screen shell at `src/pages/Analytics.tsx` — the layout, routing, time range filter controls, and the "minimum rounds" gate. The actual metric sections are separate tickets (THEA-152 through THEA-155).

### Acceptance Criteria
- [ ] Route `/analytics` added to router
- [ ] File at `src/pages/Analytics.tsx`
- [ ] Time range filter tabs: "Last 10", "30 days", "90 days", "All Time"
- [ ] Selected range is passed as state to child metric sections
- [ ] **Minimum rounds gate**: if `filteredRounds.length < 3`, show: "Play at least 3 rounds to see your stats." with a CTA to start a round
- [ ] Loading skeleton while rounds are fetching (from `useRounds` hook — THEA-142)
- [ ] Guest state: show the stats for local rounds; no sign-in gate (analytics work offline)
- [ ] Page header: "Analytics" with the time range filter below it
- [ ] Scrollable single-column layout with section headings: "Handicap", "Scoring", "Accuracy", "Club Usage"
- [ ] Each section is a separate component (imported from THEA-152–155)

### Technical Notes
- Time range filter state: `useState<TimeRange>('last10')` in `Analytics.tsx`; pass to each section
- The 3-round minimum applies per time range (if "Last 10" has < 3, show gate even if "All Time" has more)
- Page is accessible to guests (no auth guard) — they see their local rounds

---

## THEA-152: Analytics — Handicap section with trend line chart

**Type:** feat  
**Assigned:** SE2  
**Phase:** 5  
**Depends on:** THEA-150, THEA-151  
**Estimate:** M

### Description
Build the Handicap section of the Analytics dashboard: current handicap index display, 12-month low HI, trend indicator, and a line chart of HI over last 20 rounds.

### Acceptance Criteria
- [ ] Component at `src/components/analytics/HandicapSection.tsx`
- [ ] Props: `{ rounds: Round[], profile: UserProfile | null, timeRange: TimeRange }`
- [ ] Current HI displayed prominently (from `profile.handicapIndex`; falls back to calculated if null)
- [ ] 12-month Low HI: minimum `handicapDifferential` in last 365 days
- [ ] Trend indicator: `↑ +0.3` (worsening) / `↓ -0.3` (improving) / `→ 0.0` (stable) compared to 30 days ago
- [ ] Line chart: X-axis = round date, Y-axis = handicap differential; last 20 rounds; uses Recharts `LineChart`
- [ ] Chart is responsive: uses `ResponsiveContainer` from Recharts
- [ ] Y-axis inverted logic: lower differential = better (visually, a downward line = improving; note this in the label)
- [ ] "Rounds Used" stat: count of rounds in the current WHS 8-of-20 calculation

### Technical Notes
- Use `calcHandicapTrend(rounds)` from `analytics.ts` (THEA-150) for chart data
- Recharts `LineChart` with `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Line` components
- `ResponsiveContainer width="100%" height={200}` for mobile-friendly sizing
- X-axis tick format: "Mar 27" (short month + day)
- If `profile.handicapIndex` is null (user has < 3 differentials for WHS): show "Not yet calculated" instead of the number

---

## THEA-153: Analytics — Scoring section

**Type:** feat  
**Assigned:** SE2  
**Phase:** 5  
**Depends on:** THEA-150, THEA-151  
**Estimate:** S

### Description
Build the Scoring section: average score, best round, scoring trend, and score distribution.

### Acceptance Criteria
- [ ] Component at `src/components/analytics/ScoringSection.tsx`
- [ ] Props: `{ rounds: Round[], timeRange: TimeRange }`
- [ ] 2-up stat grid: "Avg Score" (e.g., "87.4") + "Best Round" (e.g., "78")
- [ ] Best round labeled as 18-hole only (if no 18-hole rounds: "—")
- [ ] Scoring trend text: "↓ 2.3 strokes (improving)" or "↑ 1.1 strokes (worsening)"
- [ ] Score distribution bar chart: bins `< 80`, `80–89`, `90–99`, `100+` as a horizontal bar chart (Recharts `BarChart`)
- [ ] All 18-hole metrics clearly labeled "18 holes"; 9-hole rounds shown separately or excluded

### Technical Notes
- Use `calcAverageScore`, `calcBestRound`, `calcScoringTrend` from `analytics.ts`
- Score distribution: `rounds.filter(r => r.holeCount === 18).map(totalStrokes).reduce(...)` into buckets
- Trend text color: green for improving, red for worsening, gray for stable (Tailwind: `text-green-600`, `text-red-500`, `text-gray-500`)

---

## THEA-154: Analytics — Accuracy section (FIR%, GIR%, putts)

**Type:** feat  
**Assigned:** SE2  
**Phase:** 5  
**Depends on:** THEA-150, THEA-151  
**Estimate:** S

### Description
Build the Accuracy section: fairways in regulation %, greens in regulation %, average putts per round, putts per hole, and 3-putt percentage.

### Acceptance Criteria
- [ ] Component at `src/components/analytics/AccuracySection.tsx`
- [ ] Props: `{ rounds: Round[], timeRange: TimeRange }`
- [ ] 2x2 stat grid: "FIR %" + "GIR %" (top row); "Avg Putts" + "3-Putt %" (bottom row)
- [ ] FIR %: shown as integer percentage (e.g., "58%"); "N/A" if no holes with `fairwayHit` data
- [ ] GIR %: shown as integer percentage; "N/A" if no holes with `gir` data
- [ ] Avg Putts: per round (e.g., "32.1"), formatted to 1 decimal
- [ ] 3-Putt %: percentage of holes with 3+ putts (e.g., "12%")
- [ ] Each stat has a subtitle label (e.g., "Fairways in Regulation")
- [ ] If data is insufficient (all holes have `fairwayHit = undefined`): show "—" not "0%"

### Technical Notes
- Use `calcFIRPercentage`, `calcGIRPercentage`, `calcPuttsPerRound`, `calcThreePuttPercentage` from `analytics.ts`
- GIR requires the `gir` field from THEA-132/THEA-134; it will be null for older rounds — handle gracefully
- "N/A" vs "0%": if the data field was simply never recorded, show "N/A"; 0% means it was tracked but 0% achieved

---

## THEA-155: Analytics — Club Usage bar chart

**Type:** feat  
**Assigned:** SE2  
**Phase:** 5  
**Depends on:** THEA-150, THEA-151  
**Estimate:** S

### Description
Build the Club Usage section: a horizontal bar chart showing shots per club, sorted by most-used, with putter excluded from the main chart.

### Acceptance Criteria
- [ ] Component at `src/components/analytics/ClubUsageSection.tsx`
- [ ] Props: `{ rounds: Round[], timeRange: TimeRange }`
- [ ] Horizontal bar chart (Recharts `BarChart` layout="vertical") showing top 8 clubs by shot count
- [ ] Each bar shows: club name, shot count, percentage of total non-putt shots
- [ ] Putter excluded from main chart; putts shown as a separate stat below: "Putter: 341 putts (28%)"
- [ ] "Most Used Club" callout: "7 Iron · 18% of shots"
- [ ] Empty state: "No shot data yet. Start tracking clubs when you play."
- [ ] Chart is responsive: `ResponsiveContainer`

### Technical Notes
- Use `calcClubUsage(rounds)` from `analytics.ts`
- Top 8 clubs to keep the chart readable; show "Others (X shots)" as a catch-all bar if > 8 clubs
- Y-axis labels may be long ("Pitching Wedge") — truncate at 12 chars with ellipsis in the label
- Color: use a single color for all bars (e.g., Tailwind green-500 as hex `#22c55e`)

---

## THEA-156: Update bottom navigation (Home / History / Analytics / Profile)

**Type:** feat  
**Assigned:** SE2  
**Phase:** 5  
**Depends on:** THEA-139, THEA-141, THEA-151  
**Estimate:** S

### Description
Replace the current bottom navigation with the 4-tab V3 layout: Home, History, Analytics, Profile.

### Acceptance Criteria
- [ ] Bottom nav updated in the relevant layout component (find `BottomNav` or similar)
- [ ] 4 tabs: Home (`/`), History (`/history`), Analytics (`/analytics`), Profile (`/profile`)
- [ ] Icons from `lucide-react`: `Home`, `History` (or `Clock`), `BarChart2`, `User`
- [ ] Active tab highlighted (current route matches)
- [ ] History tab shows a badge if there are unsynced rounds (`syncStatus === 'pending'` or `'error'` count > 0)
- [ ] Profile tab shows a small dot indicator if user is not authenticated (encourages sign-up)
- [ ] Previous tabs ("Clubs", "Settings") — check if they have dedicated routes; if so, move their content to the Profile screen or a settings drawer
- [ ] Nav is `position: fixed` at bottom with proper safe-area inset for iOS (`pb-safe` or `padding-bottom: env(safe-area-inset-bottom)`)

### Technical Notes
- Check existing nav component location — search for the current bottom nav implementation in `Home.tsx` or a shared layout
- "Clubs" tab content: if clubs management was in a `/clubs` route, keep that route accessible but remove from bottom nav; add a link from Profile screen
- iOS safe area: use Tailwind `pb-[env(safe-area-inset-bottom)]` or equivalent
- React Router `useLocation` for active tab detection

---

## THEA-157: Error handling & edge case audit

**Type:** chore  
**Assigned:** SE1  
**Phase:** 6  
**Depends on:** THEA-155, THEA-156  
**Estimate:** M

### Description
Systematic audit of all V3 code paths for unhandled errors, missing loading states, and edge cases. Fix all P0 and P1 issues found.

### Acceptance Criteria
- [ ] All `async/await` calls in `sync.ts` and `auth.ts` have `try/catch`
- [ ] No unhandled promise rejections in the browser console during a full auth + round + sync flow
- [ ] Error boundaries added around Analytics and History pages (show fallback UI on crash)
- [ ] Empty states: every screen that loads data has an empty state defined
- [ ] Auth errors surface friendly messages (not raw Supabase error objects) in all UI paths
- [ ] Network timeout: `syncRoundToSupabase` has a max 30s timeout (use `AbortController`)
- [ ] Verify: no infinite loops in `processSyncQueue` (max retry guard)
- [ ] Document any intentional "swallowed errors" (log-and-continue patterns) with a comment

### Technical Notes
- Use React ErrorBoundary: wrap `<Analytics />` and `<History />` in App.tsx
- A simple `ErrorBoundary` component is sufficient (no third-party needed)
- Test offline scenarios using Chrome DevTools → Network → Offline

---

## THEA-158: Offline mode testing & sync queue validation

**Type:** chore  
**Assigned:** SE1  
**Phase:** 6  
**Depends on:** THEA-136  
**Estimate:** M

### Description
Manually verify and fix all offline scenarios. The sync queue (THEA-136) is the critical path here.

### Acceptance Criteria
- [ ] Scenario 1 (Offline completion): Complete a round while offline → round queued → go online → round syncs → badge shows ☁️
- [ ] Scenario 2 (Offline mid-round): Start round, go offline, complete several holes, come back online → progress not lost
- [ ] Scenario 3 (Sign in offline): Attempt sign-in while offline → friendly error "No internet connection"
- [ ] Scenario 4 (Queue processing): 3 rounds in queue → process sequentially on reconnect → all synced
- [ ] Scenario 5 (Max retries): Simulate persistent failure → after 3 retries → error badge shown → manual retry works
- [ ] All 5 scenarios pass on Chrome mobile emulation and Safari/iOS (if accessible)

### Technical Notes
- Use `navigator.onLine` checks before showing "No internet connection" messages in auth
- Chrome DevTools offline simulation is sufficient for testing
- Document confirmed behavior in a `docs/testing/offline-scenarios.md` file

---

## THEA-159: Performance optimization

**Type:** chore  
**Assigned:** SE1  
**Phase:** 6  
**Depends on:** THEA-155, THEA-156  
**Estimate:** M

### Description
Profile and optimize the V3 feature set for mobile performance. Focus on: analytics computation, round list rendering, and initial load time.

### Acceptance Criteria
- [ ] Analytics metrics (`calcClubUsage`, `calcHandicapTrend`, etc.) are memoized with `useMemo` — not recomputed on every render
- [ ] Round History list uses `React.memo` or virtualization if > 50 rounds (use simple windowing or accept scroll perf on small lists)
- [ ] Supabase `fetchRounds` result cached — no re-fetch on every navigation to `/history` or `/analytics`
- [ ] `syncRoundToSupabase` does not block the UI thread during `completeRound` (already fire-and-forget per THEA-137)
- [ ] Recharts bundle impact: verify total JS bundle size increase is < 200KB gzipped (run `vite build --report`)
- [ ] Profile screen initial load (fetching profile + quick stats) < 500ms on fast 3G (Chrome throttling)

### Technical Notes
- `useMemo` in Analytics sections: `const metrics = useMemo(() => calcAverageScore(rounds), [rounds, timeRange])`
- Cache key for rounds: store `lastFetchedAt` timestamp; only re-fetch if > 5 minutes old
- If Recharts bundle is too large: consider lazy loading the Analytics page with `React.lazy`

---

## THEA-160: Update bottom nav + navigation routing audit

**Type:** chore  
**Assigned:** SE2  
**Phase:** 6  
**Depends on:** THEA-156  
**Estimate:** S

### Description
Final navigation audit: ensure all routes are correctly registered, back navigation works everywhere, and deep links work on Vercel previews.

### Acceptance Criteria
- [ ] All new routes (`/profile`, `/history`, `/analytics`, `/reset-password`) are registered in the router
- [ ] Back navigation from all new pages works (mobile browser back button + in-app back arrow)
- [ ] Deep links work on Vercel: navigating directly to `/analytics` shows the page (not 404) — requires Vercel rewrite rules
- [ ] PWA: navigating to any route on the PWA (installed) doesn't 404
- [ ] `vercel.json` has a catch-all rewrite: `{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }` (if not already present)
- [ ] All `<Link>` components use correct paths
- [ ] No orphaned routes (all routes reachable from UI)

### Technical Notes
- Check existing `vercel.json` — may already have rewrites for the PWA
- Use `react-router-dom`'s `useNavigate(-1)` for back navigation
- Test: open `https://[preview-url].vercel.app/analytics` directly in browser — should load the analytics page

---

## Ticket Summary

| # | Ticket | Phase | Type | Assigned | Estimate | Depends On |
|---|--------|-------|------|----------|----------|------------|
| 1 | THEA-125: Install Recharts | 0 | chore | SE1 | S | — |
| 2 | THEA-126: src/lib/auth.ts | 1 | feat | SE1 | S | — |
| 3 | THEA-127: useAuth hook | 1 | feat | SE1 | S | 126 |
| 4 | THEA-128: Extend Zustand store (auth + sync state) | 1 | feat | SE1 | M | 127 |
| 5 | THEA-129: AuthModal component | 1 | feat | SE2 | M | 128 |
| 6 | THEA-130: Password reset flow | 1 | feat | SE2 | S | 129 |
| 7 | THEA-131: Session persistence on reload | 1 | feat | SE1 | S | 128 |
| 8 | THEA-132: DB migration — penalties + gir on holes | 2 | migration | SE1 | S | — |
| 9 | THEA-133: DB migration — handicap fields on rounds | 2 | migration | SE1 | S | — |
| 10 | THEA-134: Update types.ts | 2 | chore | SE1 | S | — |
| 11 | THEA-135: src/lib/sync.ts | 2 | feat | SE1 | L | 128, 132, 133, 134 |
| 12 | THEA-136: Offline sync queue + retry | 2 | feat | SE1 | M | 135 |
| 13 | THEA-137: Wire completeRound() to sync | 2 | feat | SE1 | S | 135 |
| 14 | THEA-138: SyncIndicator component + badges | 2 | feat | SE2 | S | 137 |
| 15 | THEA-139: Profile screen | 2 | feat | SE2 | M | 129, 135 |
| 16 | THEA-140: Club bag sync to Supabase | 2 | feat | SE1 | M | 135 |
| 17 | THEA-141: Round History screen | 3 | feat | SE2 | M | 137, 138 |
| 18 | THEA-142: useRounds hook — fetch + merge | 3 | feat | SE1 | M | 135 |
| 19 | THEA-143: History filters + pagination | 3 | feat | SE2 | S | 141 |
| 20 | THEA-144: Active round persistence (status='active') | 3 | feat | SE1 | M | 135 |
| 21 | THEA-145: RestoreRoundBanner component | 3 | feat | SE2 | S | 144 |
| 22 | THEA-146: Background sync interval polish | 3 | feat | SE1 | S | 144 |
| 23 | THEA-147: Detect local rounds + MigrationPrompt modal | 4 | feat | SE2 | M | 129 |
| 24 | THEA-148: Batch sync migration | 4 | feat | SE1 | M | 135, 147 |
| 25 | THEA-149: Post-round save prompt (guest) | 4 | feat | SE2 | S | 129 |
| 26 | THEA-150: src/lib/analytics.ts | 5 | feat | SE1 | M | 142 |
| 27 | THEA-151: Analytics screen shell + time filter | 5 | feat | SE2 | S | 125, 142 |
| 28 | THEA-152: Analytics — Handicap section | 5 | feat | SE2 | M | 150, 151 |
| 29 | THEA-153: Analytics — Scoring section | 5 | feat | SE2 | S | 150, 151 |
| 30 | THEA-154: Analytics — Accuracy section | 5 | feat | SE2 | S | 150, 151 |
| 31 | THEA-155: Analytics — Club Usage chart | 5 | feat | SE2 | S | 150, 151 |
| 32 | THEA-156: Update bottom navigation | 5 | feat | SE2 | S | 139, 141, 151 |
| 33 | THEA-157: Error handling audit | 6 | chore | SE1 | M | 155, 156 |
| 34 | THEA-158: Offline mode testing | 6 | chore | SE1 | M | 136 |
| 35 | THEA-159: Performance optimization | 6 | chore | SE1 | M | 155, 156 |
| 36 | THEA-160: Navigation + routing audit | 6 | chore | SE2 | S | 156 |

**Total tickets:** 36  
**SE1 tickets:** 20 | **SE2 tickets:** 16  
**Phases:** 0–6 (Phase 0 = 1 prereq, Phases 1–5 = feature delivery, Phase 6 = polish/QA)

---

## Critical Path (unblocked → blocked chain)

```
THEA-125 (Recharts)
THEA-126 (auth.ts) → THEA-127 (useAuth) → THEA-128 (store) → THEA-129 (AuthModal)
                                                             → THEA-135 (sync.ts) → THEA-136 (queue)
                                                                                  → THEA-137 (wire completeRound)
                                                                                  → THEA-142 (useRounds)
                                                                                              → THEA-150 (analytics.ts)
                                                                                                         → THEA-151 (Analytics shell)
                                                                                                                    → THEA-152–155 (sections)
                                                                                                                                  → THEA-156 (nav)
THEA-132/133 (migrations) ─┘
THEA-134 (types) ──────────┘
```

**SE1 and SE2 can work in parallel** starting at Phase 1:
- SE1 owns the auth plumbing and sync infrastructure  
- SE2 owns the UI components and screens  
- SE2 unblocked on UI work as soon as SE1 delivers THEA-128 (store with auth state)
