# PRD: User Auth, Round Persistence & Analytics
**Golf Caddy V3**  
**Author:** CTO, The Colony  
**Status:** Approved for Engineering  
**Date:** 2026-03-28

---

## Executive Summary

Golf Caddy V3 introduces persistent user identity, cross-device round storage, in-progress round restoration, and a personal analytics layer. This transforms Golf Caddy from a session-scoped scorecard into a lifelong golf intelligence platform. Every round a user plays enriches their personal dataset — scoring trends, club patterns, handicap trajectory — forming the foundation for AI-powered caddy features in V4.

---

## Problem Statement

Today, Golf Caddy has no user identity. All data lives in `localStorage`:
- **Rounds are lost** if the browser resets, the user switches devices, or clears storage
- **In-progress rounds are unrecoverable** if the app crashes or the phone dies
- **No analytics are possible** without a persistent, queryable history
- **Handicap index is stateless** — recalculated from whatever's in local storage
- **Users cannot be re-engaged** — there's no account to send notifications to

This is the single biggest gap between Golf Caddy and every established golf app.

---

## Goals & Success Metrics

| Goal | KPI | Target (90 days post-launch) |
|------|-----|-------------------------------|
| Users create accounts | Signup conversion | ≥ 40% of active users |
| Rounds are saved | Rounds synced to Supabase | ≥ 80% of completed rounds |
| Cross-device access | Users who log in on 2+ devices | ≥ 15% |
| In-progress restoration | Successful restores after close | ≥ 90% |
| Analytics engagement | Users who view stats screen | ≥ 60% |
| Retention | D30 retention (signed-in vs guest) | +20pp vs guest |

---

## Non-Goals (V3)

- Social features (friends, following, leaderboards beyond group rounds)
- Public profiles or round sharing
- OAuth / social login (Google, Apple) — V4
- Manual handicap override (always calculated from rounds)
- Push notifications
- Paid tiers / paywalls

---

## User Stories

### Auth

**US-1: Sign up**
> As a new user, I want to create an account with my name, email, and password so that my rounds are saved permanently.
- AC: Form collects display_name, email, password (min 8 chars)
- AC: Supabase creates auth.users row; trigger auto-creates profiles row
- AC: User is immediately signed in after successful signup
- AC: Email validation error shown inline
- AC: Password strength hint shown

**US-2: Sign in**
> As a returning user, I want to sign in with email and password to access my rounds from any device.
- AC: Sign-in form with email + password
- AC: "Forgot password?" link triggers Supabase magic link email
- AC: Session persists across browser restarts (Supabase handles token refresh)
- AC: Wrong credentials show a clear error, no data leaked

**US-3: Sign out**
> As a signed-in user, I want to sign out and return to guest mode.
- AC: Sign out clears Supabase session and auth store
- AC: Local rounds remain in localStorage (not deleted)
- AC: App returns to guest state

**US-4: Guest mode**
> As a user who hasn't signed up, I want to use the app normally without an account.
- AC: Full round-playing functionality available without auth
- AC: Rounds saved to localStorage only
- AC: Gentle prompt to sign up after completing a round (non-blocking)

### Round Persistence

**US-5: Auto-save completed round**
> As a signed-in user, when I complete a round, I want it automatically saved to my account.
- AC: On `completeRound()`, if userId present, sync to Supabase in background
- AC: UI shows cloud sync indicator (uploading → saved)
- AC: Failure shows retry option, never blocks the user
- AC: Sync includes round metadata, all holes, all shots, putts, penalties, fairway_hit

**US-6: Restore in-progress round**
> As a signed-in user, if I close the app during a round, I want to resume exactly where I left off.
- AC: Active round state written to Supabase every hole completion (status = 'active')
- AC: On app load, if active round exists in DB but not localStorage, offer to restore
- AC: Restoration loads all holes + shots already recorded
- AC: Guest users: localStorage already handles this for same device

**US-7: View round history**
> As a signed-in user, I want to see all my past rounds in chronological order.
- AC: `/history` route lists all completed rounds from Supabase
- AC: Each row shows: date, course name, score vs par, tee set, hole count
- AC: Tap → Summary page for that round
- AC: Guest users see localStorage rounds with "local only" badge
- AC: Paginated at 20 per page

**US-8: Migrate guest rounds**
> As a user who just signed up, I want my existing local rounds imported to my account.
- AC: On first sign-in/signup, if local completed rounds exist → show migration prompt
- AC: User can confirm or skip
- AC: On confirm: batch sync all local rounds; mark them synced in store
- AC: Duplicate detection: skip rounds with same `id` already in Supabase

### Analytics

**US-9: View personal stats**
> As a signed-in user, I want to see my performance stats so I can track improvement.
- AC: Stats screen shows: scoring average, best round, handicap index trend
- AC: Club usage breakdown (shots per club)
- AC: Fairways hit % (18-hole rounds only)
- AC: GIR % (when putts data available)
- AC: Average putts per round
- AC: Handicap index chart over last 20 rounds
- AC: Filter by: all time / last 10 rounds / last 20 rounds / this year

---

## Technical Architecture

### Auth Flow

```
User taps "Sign Up"
  → AuthModal opens
  → supabase.auth.signUp({ email, password, options: { data: { display_name } } })
  → Supabase trigger: handle_new_user() inserts into profiles
  → onAuthStateChange fires → store.setUserId(user.id)
  → store.setProfile(await fetchProfile(user.id))
  → If local rounds exist → show MigrationPrompt
  → MigrationPrompt confirm → batchSyncRounds(localRounds, userId)
```

### Data Sync Strategy

**Local-first, background sync:**
1. Round data always written to localStorage immediately (existing behavior)
2. When signed in, sync to Supabase asynchronously after each action
3. `syncedRoundIds: Set<string>` in store tracks what's been persisted
4. On app load: fetch active round from Supabase if not in localStorage

**Sync triggers:**
- `completeRound()` → full round sync
- `holeComplete` (navigating to next hole) → upsert hole row (enables in-progress restore)
- Profile tab open → fetch latest profile + recalculate handicap

**Conflict resolution:** Last-write-wins via Supabase `updated_at`. We don't support concurrent editing from two devices on the same active round. In-progress rounds are single-device; completed rounds are immutable.

### In-Progress Round Restoration

```
App loads
  → getSession() → userId
  → fetch rounds WHERE user_id = ? AND status = 'active' LIMIT 1
  → If found AND not in localStorage:
      → show RestoreRoundBanner
      → user confirms → load round + holes + shots into store
      → navigate to /round
  → If found AND in localStorage:
      → compare updated_at; use whichever is newer
```

### Offline Behavior

- All writes go to localStorage first (never blocks on network)
- Supabase sync attempted; if offline → queued in `pendingSyncs[]` in store
- On reconnect (visibilitychange / online event) → flush pending syncs
- User sees "Sync pending" indicator when offline with unsaved data

---

## Data Model

### Existing (no migration needed)

```sql
profiles       — id, display_name, home_course, handicap_index
rounds         — id, user_id, course_name, tee_set, course_rating, slope_rating,
                 player_name, tees, hole_count, status, started_at, completed_at,
                 handicap_differential, deleted_at
holes          — id, round_id, user_id, hole_number, par, putts, fairway_hit
shots          — id, hole_id, round_id, user_id, club_id, club_name, sequence, is_putt
clubs          — id, user_id, name, order, deleted_at
```

### Additions Required

```sql
-- 1. Add penalties column to holes (new V3 field)
ALTER TABLE public.holes ADD COLUMN IF NOT EXISTS penalties int NOT NULL DEFAULT 0;

-- 2. Add penalties to frontend Round type (done) → map to DB on sync

-- 3. Club bag sync: clubs table already exists, just need sync logic on the frontend

-- 4. shots.is_putt exists — map frontend Shot.clubId to DB club_id on sync
```

**Migration ticket:** THEA-130 — `ALTER TABLE holes ADD COLUMN penalties`

### TypeScript → Supabase Mapping

| Frontend (`types.ts`) | Supabase column |
|----------------------|-----------------|
| `Round.id` | `rounds.id` |
| `Round.courseName` | `rounds.course_name` |
| `Round.teeSet` | `rounds.tee_set` |
| `Round.courseRating` | `rounds.course_rating` |
| `Round.slopeRating` | `rounds.slope_rating` |
| `Round.holeCount` | `rounds.hole_count` |
| `Round.startedAt` | `rounds.started_at` |
| `Round.completedAt` | `rounds.completed_at` |
| `Hole.putts` | `holes.putts` |
| `Hole.penalties` | `holes.penalties` (new) |
| `Hole.fairwayHit` | `holes.fairway_hit` |
| `Shot.clubId` | `shots.club_id` |
| `Shot.timestamp` | `shots.created_at` |

---

## Analytics Schema

### Derived Metrics (computed client-side from rounds)

| Metric | Source | Formula |
|--------|--------|---------|
| Scoring average | rounds | avg(total_strokes - total_par) |
| Best round | rounds | min(total_strokes - total_par) |
| Handicap index | rounds | WHS formula from last 20 diffs |
| Putts per round | holes | avg(sum(putts) per round) |
| Fairways hit % | holes | sum(fairway_hit=true) / eligible holes |
| GIR % | holes | holes where non-putter shots ≤ par-2 |
| Penalties per round | holes | avg(sum(penalties) per round) |
| Club usage | shots | count per club_name |
| Scoring by hole par | holes | avg(strokes - par) grouped by par |

### Analytics Events (future telemetry — V4)

Track these for future product decisions (no analytics infra needed in V3, just define the schema):

```ts
type AnalyticsEvent =
  | { event: 'round_started'; hole_count: number; has_course: boolean }
  | { event: 'round_completed'; score_vs_par: number; hole_count: number }
  | { event: 'user_signed_up'; had_local_rounds: boolean }
  | { event: 'round_restored'; holes_completed: number }
  | { event: 'stats_viewed'; filter: string }
  | { event: 'migration_accepted'; round_count: number }
```

---

## UI/UX Spec

### New Bottom Nav Item: Profile (👤)

Replaces or adds to existing nav. Profile tab is the entry point for auth + stats.

### Screen: Profile (signed in)
```
┌─────────────────────────────────┐
│  👤  Brian                      │
│  Handicap Index: 14.2  ↓ trend  │
│  Home Course: TPC Sawgrass      │
│  [Edit Profile]                 │
├─────────────────────────────────┤
│  STATS                          │
│  24 rounds  |  Best: +2  |  Avg: +9  │
│  Putts/round: 33.4              │
│  Fairways: 48%  GIR: 31%        │
│  [View Full Analytics →]        │
├─────────────────────────────────┤
│  [View Round History →]         │
│  [Sign Out]                     │
└─────────────────────────────────┘
```

### Screen: Profile (guest)
```
┌─────────────────────────────────┐
│  Sign in to save your rounds    │
│  Track your handicap and stats  │
│  across all your devices.       │
│                                 │
│  [Sign In]   [Create Account]   │
│                                 │
│  Continue as guest →            │
└─────────────────────────────────┘
```

### Screen: Auth Modal (Sign In tab)
```
┌─────────────────────────────────┐
│  [Sign In]  [Create Account]    │
├─────────────────────────────────┤
│  Email                          │
│  [_________________________]    │
│  Password                       │
│  [_________________________]    │
│  Forgot password?               │
│                                 │
│  [Sign In →]                    │
└─────────────────────────────────┘
```

### Screen: Round History (`/history`)
```
┌─────────────────────────────────┐
│  Round History    [All ▾]       │
├─────────────────────────────────┤
│  Mar 27 · Augusta National      │
│  18 holes · White tees · +5     │
│  Diff: 12.3              ☁ ✓   │
├─────────────────────────────────┤
│  Mar 20 · Pebble Beach          │
│  18 holes · Blue tees · +8      │
│  Diff: 15.1              ☁ ✓   │
├─────────────────────────────────┤
│  Mar 15 · Local Course          │
│  9 holes  · +3           📱     │
└─────────────────────────────────┘
☁ ✓ = synced to cloud   📱 = local only
```

### Screen: Analytics (`/analytics`)
```
┌─────────────────────────────────┐
│  Your Game   [Last 20 ▾]        │
├─────────────────────────────────┤
│  Handicap Index                 │
│  ╭──────────────────────╮       │
│  │  14.2   📉 -1.3       │       │
│  │  [sparkline chart]   │       │
│  ╰──────────────────────╯       │
├─────────────────────────────────┤
│  Scoring Average    +9.4        │
│  Best Round         +2          │
│  Fairways Hit       48%         │
│  GIR                31%         │
│  Avg Putts          33.4        │
│  Avg Penalties      0.8         │
├─────────────────────────────────┤
│  CLUB USAGE                     │
│  Driver      ██████████  41%    │
│  7-iron      ████████    34%    │
│  Pitching W  ██████      25%    │
└─────────────────────────────────┘
```

### Banner: Post-Round Save Prompt (guest only)
```
┌─────────────────────────────────┐
│ 💾  Save this round?            │
│ Create a free account to keep   │
│ your history and track handicap │
│ [Sign Up]          [Not Now]    │
└─────────────────────────────────┘
```

### Banner: Restore In-Progress Round
```
┌─────────────────────────────────┐
│ 🔄  Resume your round?          │
│ Augusta National — Hole 7 of 18 │
│ [Resume Round]     [Discard]    │
└─────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Auth Foundation (Week 1)

| Ticket | Description | Owner |
|--------|-------------|-------|
| THEA-125 | `src/lib/auth.ts` — signUp, signIn, signOut, onAuthChange | SE1 |
| THEA-126 | Auth store — userId, profile, syncedRoundIds in Zustand | SE1 |
| THEA-127 | Profile screen UI — guest state + signed-in state | SE2 |
| THEA-128 | Auth modal — sign in / sign up tabs, error states | SE2 |

### Phase 2: Round Persistence (Week 2)

| Ticket | Description | Owner |
|--------|-------------|-------|
| THEA-129 | `src/lib/sync.ts` — syncRoundToSupabase, fetchRounds, fetchProfile | SE1 |
| THEA-130 | DB migration — `ALTER TABLE holes ADD COLUMN penalties int` | BE |
| THEA-131 | Auto-sync on completeRound() when signed in | SE1 |
| THEA-132 | Sync indicator UI (cloud icon, uploading/saved/failed states) | SE2 |
| THEA-133 | Hole-level sync during active round (in-progress save) | SE1 |

### Phase 3: Restore & History (Week 3)

| Ticket | Description | Owner |
|--------|-------------|-------|
| THEA-134 | In-progress round detection on app load + RestoreRoundBanner | SE1 |
| THEA-135 | Round History screen `/history` — Supabase + local | SE2 |
| THEA-136 | Guest migration flow — prompt + batch sync on first sign-in | SE1 |
| THEA-137 | Offline sync queue — pending syncs flushed on reconnect | SE1 |

### Phase 4: Analytics (Week 4)

| Ticket | Description | Owner |
|--------|-------------|-------|
| THEA-138 | Analytics computation lib — all derived metrics | SE1 |
| THEA-139 | Analytics screen `/analytics` — stats cards + club usage | SE2 |
| THEA-140 | Handicap index sparkline chart (recharts or similar) | SE2 |
| THEA-141 | Club bag sync to Supabase per user | SE1 |

### Phase 5: QA & Polish (Week 5)

| Ticket | Description | Owner |
|--------|-------------|-------|
| THEA-142 | End-to-end auth flow QA (signup → round → history → analytics) | QA |
| THEA-143 | Offline mode testing — play round offline, sync on reconnect | QA |
| THEA-144 | Cross-device testing — complete round on mobile, view on desktop | QA |
| THEA-145 | Post-round save prompt (guest) | SE2 |
| THEA-146 | Production deploy + Supabase RLS policy audit | BE + CSO |

---

## Open Questions

1. **Anonymous auth** — Should we use Supabase anonymous auth for guests? Gives guests a stable `user_id` before they create an account, making migration a single `UPDATE` instead of a batch insert. Recommended: yes.

2. **Shots sync on in-progress rounds** — Sync shots row-by-row as they're added, or batch at hole completion? Batching at hole completion is simpler; row-by-row gives finer restore granularity. Recommendation: batch at hole completion.

3. **Club bag sync direction** — If user has clubs in Supabase and different clubs in localStorage, which wins? Recommendation: Supabase is source of truth for signed-in users; merge strategy on first sign-in.

4. **Chart library** — Recharts (already popular in React ecosystem) or lightweight alternative? Recharts adds ~40KB gzip. Alternative: custom SVG sparklines for basic handicap trend, skip heavy library. Decision needed before THEA-140.

5. **Penalties in historical rounds** — Rounds completed before V3 have no penalties data. Display as "—" rather than 0 to avoid misleading averages. Requires `penalties` nullable in analytics computation.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase sync fails silently | Medium | High | Retry queue + visible sync status UI |
| User loses in-progress round on crash | Low | High | Sync every hole completion, not just on complete |
| LocalStorage → Supabase migration corrupts data | Low | High | Dry-run migration with validation before write |
| Auth token expires during long round | Low | Medium | Supabase auto-refresh; test 4+ hour sessions |
| Bundle size grows beyond 400KB with chart lib | Medium | Medium | Use lightweight SVG sparklines, skip recharts |
| RLS policy gaps allow cross-user data access | Low | Critical | CSO audit (THEA-146) before production deploy |
| Guest-to-user migration creates duplicates | Medium | Medium | Dedup by round.id before batch insert |

---

## Appendix: File Structure

```
src/
├── lib/
│   ├── auth.ts          ← NEW: signUp, signIn, signOut, onAuthChange
│   ├── sync.ts          ← NEW: syncRoundToSupabase, fetchRounds, fetchProfile
│   ├── analytics.ts     ← NEW: all derived metric computations
│   └── handicap/        ← EXISTING: handicap calculation
├── store/
│   └── index.ts         ← MODIFY: add userId, profile, syncedRoundIds, pendingSyncs
├── pages/
│   ├── Profile.tsx      ← NEW: profile + auth screen
│   ├── History.tsx      ← NEW: round history list
│   └── Analytics.tsx    ← NEW: stats + charts
└── components/
    ├── AuthModal.tsx        ← NEW: sign in / sign up modal
    ├── RestoreRoundBanner.tsx  ← NEW: in-progress restore prompt
    ├── MigrationPrompt.tsx     ← NEW: guest round migration
    └── SyncIndicator.tsx       ← NEW: cloud sync status icon
```
