# V3 Spec: User Profiles & Round History

**Status:** Draft  
**Track:** V3  
**Dependencies:** Supabase Auth (already configured), existing `profiles` + `rounds` + `holes` DB schema

---

## Problem

All data is currently stored in `localStorage` only. There is no concept of a logged-in user — rounds are device-local, anonymous, and lost when the browser resets. Users cannot access their history from another device, and we can't build AI insights or trends without a persistent identity.

---

## Goals

1. **Auth** — Sign up / sign in (email+password to start; magic link or Google later)
2. **Profile** — Display name, home course, current handicap index (derived)
3. **Round persistence** — Completed rounds sync to Supabase; readable from any device
4. **Round history** — Full list of saved rounds with filtering and detail view
5. **Graceful offline** — Local-first; sync happens in background; works without auth

---

## Non-Goals (V3)

- Social features (friends, leaderboards beyond group rounds)
- Round sharing / public profiles
- Manual handicap override (it's always calculated)
- OAuth / social login (V4)

---

## Auth Flow

### Sign-up
- Triggered from Profile tab (new) or post-round prompt ("Save this round to your profile")
- Fields: display name, email, password
- On success: Supabase creates `auth.users` row → trigger auto-creates `profiles` row
- Guest rounds (local) are migrated to the new user on first sign-in (see Migration)

### Sign-in
- Email + password
- "Forgot password" → Supabase magic link reset

### Session
- Supabase JS client handles token refresh automatically
- Auth state watched via `supabase.auth.onAuthStateChange`
- Zustand store gets a `userId` field; `null` = guest mode

---

## Data Model

### Already in DB (no migration needed)

```sql
-- profiles
id, display_name, home_course, handicap_index, created_at, updated_at

-- rounds
id, user_id, course_name, course_id, tee_set, course_rating, slope_rating,
player_name, tees, hole_count, status, started_at, completed_at,
handicap_differential, deleted_at, created_at, updated_at

-- holes
id, round_id, user_id, hole_number, par, putts, fairway_hit, created_at, updated_at

-- shots (inside holes — need to check if separate table or JSONB)
```

### Additions needed

```sql
-- shots table (if not already JSONB in holes)
-- Check: does current holes table store shots as JSONB column or separate rows?
-- If JSONB: add shots jsonb default '[]' to holes table
-- If separate: create shots table (id, hole_id, round_id, user_id, club_id, timestamp)

-- clubs table already exists (user_id, name, order, deleted_at)
```

**Action:** Audit `holes` table for shot storage before writing migration.

---

## Frontend Architecture

### New: `src/lib/auth.ts`
- `signUp(email, password, displayName)` → Supabase call
- `signIn(email, password)` → Supabase call
- `signOut()` → Supabase call
- `getSession()` → current session
- `onAuthChange(callback)` → wraps `onAuthStateChange`

### New: `src/lib/sync.ts`
- `syncRoundToSupabase(round: Round, userId: string)` → upsert round + holes + shots
- `fetchRounds(userId: string)` → pull all completed rounds from Supabase
- `fetchProfile(userId: string)` → pull profile row
- `updateProfile(userId: string, patch)` → update display_name, home_course

### Store changes (`src/store/index.ts`)
```ts
// Add to StoreState:
userId: string | null
profile: UserProfile | null
syncedRoundIds: Set<string>  // track what's been pushed

// Add actions:
setUserId(id: string | null): void
setProfile(profile: UserProfile | null): void
markRoundSynced(roundId: string): void
```

### Guest → User Migration
When a guest signs up or signs in and there are local rounds:
1. Prompt: "You have X local rounds. Sync them to your profile?"
2. On confirm: call `syncRoundToSupabase` for each local completed round
3. Mark all as synced in store

---

## UI: New Screens

### Profile Tab (new bottom nav item)
```
┌─────────────────────────────┐
│  👤  Brian                  │
│  Handicap Index: 14.2       │
│  Home Course: TPC Sawgrass  │
│                             │
│  [Edit Profile]             │
│  ─────────────────────────  │
│  Rounds played: 24          │
│  Best round: 78             │
│  Avg score: 87              │
│                             │
│  [Sign Out]                 │
└─────────────────────────────┘
```

- If not signed in: show sign-up / sign-in forms instead
- Handicap index pulled from `profiles.handicap_index` (recalculated on round sync)

### Round History Screen (`/history`)
```
┌─────────────────────────────┐
│  Round History              │
│  [All] [9-hole] [18-hole]   │
│ ─────────────────────────── │
│  Mar 27 · Augusta National  │
│  18 holes · White · +5      │
│  Handicap diff: 12.3   >    │
│ ─────────────────────────── │
│  Mar 20 · Pebble Beach      │
│  18 holes · Blue · +8       │
│  Handicap diff: 15.1   >    │
└─────────────────────────────┘
```

- Source: Supabase if logged in, localStorage if guest
- Tap → Round Detail (already exists as Summary page, link from here)
- Infinite scroll or paginate at 20 per page
- Show sync status badge (cloud ✓ / local only)

### Auth Modal / Screen
- Triggered by: Profile tab (if guest), post-round save prompt
- Tabs: Sign In | Sign Up
- Minimal: name, email, password, submit
- Error states inline

---

## Post-Round Save Prompt

After completing a round, if the user is a **guest**, show a non-blocking banner:

```
┌────────────────────────────────┐
│ 💾 Save this round?            │
│ Sign in to keep your history   │
│ and track your handicap.       │
│ [Sign In / Sign Up]  [Not Now] │
└────────────────────────────────┘
```

If **signed in**: round syncs automatically in background on `completeRound()`.

---

## Handicap Index Calculation

- Already partially implemented in `src/lib/handicap/`
- On round sync: recalculate handicap index from last 20 differentials
- Store result in `profiles.handicap_index`
- Display on Profile and in Round History rows

---

## Implementation Order

1. **Auth plumbing** — `src/lib/auth.ts`, wire into store, Profile tab (sign-in/up UI)
2. **Profile screen** — display name, home course, handicap index display
3. **Round sync** — `syncRoundToSupabase`, call on `completeRound` when logged in
4. **Round history screen** — `/history` route, pulls from Supabase + local
5. **Guest migration flow** — prompt + batch sync on first sign-in
6. **Post-round save prompt** — banner for guests after completing a round

---

## Open Questions

1. **Shots storage** — JSONB in holes table or separate shots table? Need to audit current DB.
2. **Club bag sync** — Should club bag also sync to Supabase per user? (Probably yes, V3.)
3. **Offline conflict resolution** — If user edits on two devices, last-write-wins or merge?
4. **Anonymous auth** — Use Supabase anon auth for guests so migration is cleaner? (No email required, but gives a stable user_id for local→cloud transition.)

---

## Tickets to Create

- `THEA-XXX` Auth plumbing (signUp/signIn/signOut, store integration)
- `THEA-XXX` Profile screen UI
- `THEA-XXX` Round sync to Supabase on complete
- `THEA-XXX` Round history screen (`/history`)
- `THEA-XXX` Guest → user migration flow
- `THEA-XXX` Post-round save prompt (guest only)
- `THEA-XXX` Club bag sync to Supabase per user
- `THEA-XXX` Audit shots storage (JSONB vs table), write migration if needed
