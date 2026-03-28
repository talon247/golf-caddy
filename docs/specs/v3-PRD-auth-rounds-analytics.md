# V3 PRD: User Authentication, Round Persistence & Analytics

**Status:** Final Draft  
**Version:** 1.0  
**Author:** CTO, The Colony  
**Date:** 2026-03-28  
**Track:** V3  
**PRD ID:** THEA-100

---

## Executive Summary

Golf Caddy currently operates as a fully local PWA with no user identity or cloud persistence. All rounds, clubs, and settings are stored in `localStorage`, making data device-bound and unrecoverable if cleared. This PRD defines the V3 feature set that introduces:

1. **User Authentication** — Email/password signup and login with magic link password reset
2. **Round Persistence** — Automatic sync of completed rounds to Supabase, accessible from any device
3. **Round Restoration** — Resume in-progress rounds after app closure; access full round history
4. **Analytics Dashboard** — Per-user statistics including scoring trends, club usage, fairways hit %, GIR %, putts per round, and handicap index over time
5. **Guest Migration** — Seamless adoption of local rounds when a guest creates an account

This feature set transforms Golf Caddy from a disposable score tracker into a persistent golf improvement platform with cross-device continuity.

---

## Problem Statement

### Current State
- All data stored in `localStorage` only — no cloud persistence
- No concept of user identity or accounts
- Rounds are lost when browser storage is cleared or device changes
- Cannot track long-term improvement trends
- No handicap history or statistical analysis
- Users cannot access their data from multiple devices
- No foundation for AI-powered insights (future V4+)

### User Pain Points
1. **Data Loss Risk**: "I lost all my rounds when I cleared my browser cache"
2. **Device Lock-in**: "I can't see my rounds on my tablet that I tracked on my phone"
3. **No Progress Tracking**: "I have no idea if I'm actually improving"
4. **Interrupted Rounds**: "The app crashed mid-round and I lost my progress"

### Business Impact
- High churn risk due to data loss anxiety
- Cannot build retention features without persistent identity
- No foundation for premium analytics features
- Blocked from AI insights roadmap (requires historical data)

---

## Goals & Success Metrics

### Primary Goals
| Goal | Description | Priority |
|------|-------------|----------|
| G1 | Users can create accounts and sign in across devices | P0 |
| G2 | Completed rounds persist to cloud automatically | P0 |
| G3 | In-progress rounds survive app closure | P0 |
| G4 | Users can view round history and detailed stats | P1 |
| G5 | Guest users can migrate local data on signup | P1 |

### Success Metrics (KPIs)

| Metric | Baseline | Target (90 days) | Measurement |
|--------|----------|------------------|-------------|
| **Account Creation Rate** | 0% | 40% of active users | Supabase auth.users count / unique localStorage IDs |
| **Round Sync Rate** | 0% | 95% of completed rounds by logged-in users | rounds.status='completed' in Supabase / total completed |
| **Cross-Device Usage** | 0% | 15% of logged-in users | Users with rounds from 2+ distinct user agents |
| **Analytics Page Views** | N/A | 3+ views/user/month | Page view events for /analytics |
| **Guest Migration Rate** | N/A | 70% of guests with local rounds | Migration completions / migration prompts shown |
| **Round Recovery Rate** | Unknown | <1% data loss complaints | Support tickets mentioning lost rounds |

---

## Non-Goals (V3)

The following are explicitly **out of scope** for V3:

| Non-Goal | Rationale | Future Version |
|----------|-----------|----------------|
| OAuth / Social Login (Google, Apple) | Adds complexity; email/password sufficient for MVP | V4 |
| Public Profiles / Social Features | Focus on core persistence first | V4 |
| Manual Handicap Override | Handicap is always calculated per WHS | Never |
| Round Sharing / Export | Requires sharing infrastructure | V4 |
| Advanced AI Insights | Requires data foundation from V3 | V5 |
| Offline-First Sync Engine | Use optimistic sync with retry; full CRDT later | V4 |
| Group Round Cloud Sync | Separate feature, already has its own tables | V3.5 |

---

## User Stories

### Authentication

#### US-1: Account Creation
**As a** guest user  
**I want to** create an account with my email and password  
**So that** my rounds are saved and accessible from any device

**Acceptance Criteria:**
- [ ] Sign-up form accepts: display name, email, password
- [ ] Password minimum 8 characters, shown with strength indicator
- [ ] Email validation (format + uniqueness check)
- [ ] On success: Supabase creates auth.users row, trigger creates profiles row
- [ ] User is automatically signed in after signup
- [ ] Display name defaults to email prefix if not provided
- [ ] Error states: invalid email, weak password, email taken

#### US-2: Sign In
**As a** registered user  
**I want to** sign in with my email and password  
**So that** I can access my saved rounds and profile

**Acceptance Criteria:**
- [ ] Sign-in form accepts: email, password
- [ ] "Remember me" checkbox (extends session duration)
- [ ] On success: session established, userId set in store
- [ ] On failure: show "Invalid email or password" (no enumeration)
- [ ] Rate limiting: 5 attempts per 15 minutes per email
- [ ] Session persists across app restarts (Supabase handles)

#### US-3: Password Reset
**As a** user who forgot my password  
**I want to** reset it via magic link  
**So that** I can regain access to my account

**Acceptance Criteria:**
- [ ] "Forgot password?" link on sign-in form
- [ ] Enter email, receive magic link within 60 seconds
- [ ] Magic link opens app with password reset form
- [ ] New password must meet same requirements as signup
- [ ] On success: user is signed in, redirected to Profile

#### US-4: Sign Out
**As a** signed-in user  
**I want to** sign out  
**So that** I can switch accounts or protect my data on shared devices

**Acceptance Criteria:**
- [ ] Sign out button on Profile screen
- [ ] Confirmation modal: "Sign out? Local data will remain on this device."
- [ ] On confirm: session cleared, userId set to null
- [ ] User returns to guest state, local rounds still visible

---

### Round Persistence

#### US-5: Automatic Round Sync
**As a** signed-in user  
**I want** my completed rounds to automatically sync to the cloud  
**So that** I never lose my data

**Acceptance Criteria:**
- [ ] On `completeRound()`, if signed in, sync to Supabase
- [ ] Sync includes: round metadata, all holes, all shots
- [ ] Visual indicator: "Synced ✓" badge on round in history
- [ ] If offline: queue for sync, retry on reconnection
- [ ] Retry logic: exponential backoff, max 3 attempts
- [ ] On persistent failure: show "Sync failed" with manual retry button

#### US-6: Round History Access
**As a** signed-in user  
**I want to** view all my past rounds from any device  
**So that** I can review my performance history

**Acceptance Criteria:**
- [ ] /history route shows all rounds (Supabase + local merged)
- [ ] Sorted by date descending
- [ ] Filters: All, 9-hole, 18-hole
- [ ] Each row shows: date, course, score, handicap differential
- [ ] Pagination: 20 rounds per page, infinite scroll
- [ ] Tap row → Round detail view
- [ ] Badge indicates sync status: ☁️ synced, 📱 local only

#### US-7: Resume In-Progress Round
**As a** user with an active round  
**I want** my progress saved if the app closes unexpectedly  
**So that** I don't lose mid-round data

**Acceptance Criteria:**
- [ ] Active round state saved to localStorage on every shot/change
- [ ] On app launch: detect active round, prompt "Resume round at [Course]?"
- [ ] If signed in: also persist active round to Supabase (status='active')
- [ ] Sync active round every 5 minutes while in progress
- [ ] On resume: restore exact state including current hole, shots, etc.

---

### Guest Migration

#### US-8: Migrate Local Rounds on Signup
**As a** guest user creating an account  
**I want** my existing local rounds adopted to my new profile  
**So that** I don't lose my history

**Acceptance Criteria:**
- [ ] After signup, detect local rounds without user_id
- [ ] Prompt: "You have X local rounds. Sync them to your profile?"
- [ ] On confirm: batch sync all local rounds to Supabase with new user_id
- [ ] Progress indicator during migration
- [ ] On complete: local rounds marked as synced
- [ ] On decline: local rounds remain local-only (can migrate later)

#### US-9: Post-Round Save Prompt (Guest)
**As a** guest who just completed a round  
**I want to** be prompted to save my round  
**So that** I understand the value of creating an account

**Acceptance Criteria:**
- [ ] After completing round, if guest, show non-blocking banner
- [ ] Banner text: "Save this round? Sign in to keep your history."
- [ ] CTA buttons: [Sign In / Sign Up] [Not Now]
- [ ] If dismissed, don't show again for this round
- [ ] Frequency cap: show max once per session

---

### Analytics

#### US-10: View Personal Stats Dashboard
**As a** user with completed rounds  
**I want to** see my performance statistics  
**So that** I can understand my game and track improvement

**Acceptance Criteria:**
- [ ] /analytics route accessible from bottom nav
- [ ] Requires minimum 3 completed rounds to show stats
- [ ] Key metrics displayed (see Analytics Schema section)
- [ ] Time range filter: Last 10 rounds, Last 30 days, Last 90 days, All time
- [ ] Charts render correctly on mobile viewport

#### US-11: View Handicap Trend
**As a** user tracking my handicap  
**I want to** see my handicap index over time  
**So that** I can see if I'm improving

**Acceptance Criteria:**
- [ ] Line chart showing handicap index per round (last 20)
- [ ] Current handicap prominently displayed
- [ ] Low HI (12-month low) shown for reference
- [ ] Trend indicator: ↑ ↓ → with percentage change

#### US-12: View Club Usage Statistics
**As a** user who tracks shots by club  
**I want to** see which clubs I use most  
**So that** I can optimize my bag and practice

**Acceptance Criteria:**
- [ ] Bar chart: shots per club (descending)
- [ ] Exclude putter from main chart (separate putts stat)
- [ ] Show usage % of total non-putt shots
- [ ] Filterable by time range

---

## Technical Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AUTH FLOW                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐    signup     ┌─────────────┐    trigger    ┌────────┐ │
│  │  Guest  │ ─────────────▶│ auth.users  │ ────────────▶ │profiles│ │
│  └─────────┘               └─────────────┘               └────────┘ │
│       │                          │                                   │
│       │ signin                   │ session                          │
│       ▼                          ▼                                   │
│  ┌─────────────┐          ┌─────────────┐                           │
│  │  Auth Modal │          │   Zustand   │                           │
│  │  (UI)       │◀────────▶│   Store     │                           │
│  └─────────────┘          │  (userId)   │                           │
│                           └─────────────┘                           │
│                                  │                                   │
│                                  ▼                                   │
│                           ┌─────────────┐                           │
│                           │   Sync      │                           │
│                           │   Engine    │                           │
│                           └─────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Components:**
- `src/lib/auth.ts` — Wraps Supabase auth methods
- `src/hooks/useAuth.ts` — React hook for auth state
- Zustand store extended with `userId`, `profile`, `isAuthenticated`

### Data Sync Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SYNC ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   LOCAL (localStorage)              REMOTE (Supabase)               │
│   ┌──────────────────┐              ┌──────────────────┐            │
│   │  rounds[]        │◀────────────▶│  rounds          │            │
│   │  (with holes,    │   sync       │  holes           │            │
│   │   shots inline)  │              │  shots           │            │
│   └──────────────────┘              └──────────────────┘            │
│                                                                      │
│   Sync Triggers:                                                     │
│   1. completeRound() — immediate sync                               │
│   2. App launch — pull remote, merge                                │
│   3. Active round — every 5 min background sync                     │
│   4. Manual retry — user-initiated on failure                       │
│                                                                      │
│   Conflict Resolution: LAST-WRITE-WINS                              │
│   - Compare updated_at timestamps                                    │
│   - Remote wins ties (server is source of truth)                    │
│   - No merge of partial data (full round replacement)               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Offline/Online Handling

| State | Behavior |
|-------|----------|
| **Online + Signed In** | Sync immediately on round complete; background sync active rounds |
| **Offline + Signed In** | Queue sync operations; persist to localStorage; retry on reconnect |
| **Online + Guest** | localStorage only; no sync attempts |
| **Offline + Guest** | localStorage only; normal operation |

**Reconnection Logic:**
```typescript
// src/lib/sync.ts
const SYNC_QUEUE_KEY = 'golf_caddy_sync_queue';

interface SyncQueueItem {
  type: 'round' | 'profile' | 'clubs';
  operation: 'upsert' | 'delete';
  data: unknown;
  queuedAt: number;
  retries: number;
}

// On reconnect: process queue with exponential backoff
// Max retries: 3
// Backoff: 1s, 4s, 16s
```

### Conflict Resolution

**Strategy: Last-Write-Wins (LWW)**

For V3, we use a simple LWW approach:
1. Each entity has `updated_at` timestamp
2. On sync conflict, compare timestamps
3. Later timestamp wins
4. If timestamps equal, server wins

**Limitations & Future Work:**
- No field-level merge (entire round replaced)
- Potential data loss if user edits same round on two devices offline
- V4 will implement CRDT-based merge for shot-level granularity

---

## Data Model

### Existing Schema (No Changes Required)

The following tables already exist and support V3 requirements:

#### `profiles`
```sql
id               uuid primary key references auth.users(id)
display_name     text not null default 'Golfer'
home_course      text
handicap_index   numeric(4,1)
created_at       timestamptz
updated_at       timestamptz
```

#### `rounds`
```sql
id               uuid primary key
user_id          uuid references auth.users(id)
course_id        uuid references courses(id)
course_name      text not null
tees             text
player_name      text not null
hole_count       int (9 or 18)
status           round_status ('active', 'completed', 'abandoned')
started_at       timestamptz
completed_at     timestamptz
deleted_at       timestamptz
created_at       timestamptz
updated_at       timestamptz
```

#### `holes`
```sql
id               uuid primary key
round_id         uuid references rounds(id)
user_id          uuid references auth.users(id)
hole_number      int (1-18)
par              int (3-5)
putts            int default 0
fairway_hit      boolean
created_at       timestamptz
updated_at       timestamptz
-- Note: NO shots column — shots are in separate table
```

#### `shots`
```sql
id               uuid primary key
hole_id          uuid references holes(id)
round_id         uuid references rounds(id)
user_id          uuid references auth.users(id)
club_id          uuid references clubs(id)
club_name        text  -- denormalized for history
sequence         int not null
is_putt          boolean default false
created_at       timestamptz
```

#### `clubs`
```sql
id               uuid primary key
user_id          uuid references auth.users(id)
name             text not null
sort_order       int default 0
deleted_at       timestamptz
created_at       timestamptz
updated_at       timestamptz
```

### Schema Additions Required

#### Add `handicap_differential` to `rounds`
```sql
-- Migration: 20260328000001_add_handicap_differential.sql
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS handicap_differential numeric(4,1);

ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS course_rating numeric(4,1);

ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS slope_rating int;
```

#### Add `penalties` to `holes`
```sql
-- Migration: 20260328000002_add_penalties_to_holes.sql
ALTER TABLE public.holes 
ADD COLUMN IF NOT EXISTS penalties int default 0;
```

#### Add `gir` (Green in Regulation) to `holes`
```sql
-- Migration: 20260328000003_add_gir_to_holes.sql
ALTER TABLE public.holes 
ADD COLUMN IF NOT EXISTS gir boolean;
```

### Frontend Type Updates

```typescript
// src/types.ts additions

export interface UserProfile {
  id: string
  displayName: string
  homeCourse?: string
  handicapIndex?: number
  createdAt: string
  updatedAt: string
}

export interface SyncStatus {
  roundId: string
  synced: boolean
  syncedAt?: number
  error?: string
}

// Extended Round type for sync
export interface SyncedRound extends Round {
  userId?: string
  syncStatus: 'local' | 'synced' | 'pending' | 'error'
  remoteId?: string  // Supabase UUID if synced
}
```

---

## Analytics Schema

### Events to Track

| Event | Trigger | Properties |
|-------|---------|------------|
| `round_started` | Start new round | `hole_count`, `course_name`, `has_course_rating` |
| `round_completed` | Complete round | `hole_count`, `total_strokes`, `duration_minutes` |
| `round_abandoned` | Abandon round | `hole_count`, `holes_completed` |
| `shot_recorded` | Add shot | `club_id`, `hole_number`, `is_putt` |
| `signup_completed` | Account created | `has_local_rounds`, `local_round_count` |
| `signin_completed` | Sign in | `method` ('email') |
| `migration_started` | Begin local→cloud migration | `round_count` |
| `migration_completed` | Finish migration | `round_count`, `duration_ms` |
| `analytics_viewed` | View analytics page | `time_range` |

### Derived Metrics (Analytics Dashboard)

#### Scoring Metrics
| Metric | Calculation | Display |
|--------|-------------|---------|
| **Average Score** | `SUM(strokes) / COUNT(rounds)` | "87.4" |
| **Best Round** | `MIN(strokes)` for 18-hole rounds | "78" |
| **Scoring Trend** | Linear regression over last 10 rounds | "↓ 2.3 strokes" |
| **Score Distribution** | Histogram: <80, 80-89, 90-99, 100+ | Bar chart |

#### Handicap Metrics
| Metric | Calculation | Display |
|--------|-------------|---------|
| **Current HI** | `profiles.handicap_index` | "14.2" |
| **Low HI (12mo)** | Min HI in last 365 days | "12.8" |
| **HI Trend** | Last 20 calculations | Line chart |
| **Rounds Used** | Count from WHS calculation | "8 of 20" |

#### Accuracy Metrics
| Metric | Calculation | Display |
|--------|-------------|---------|
| **Fairways Hit %** | `COUNT(fairway_hit=true) / COUNT(par>3 holes)` | "58%" |
| **GIR %** | `COUNT(gir=true) / COUNT(holes)` | "44%" |
| **Avg Putts/Round** | `SUM(putts) / COUNT(rounds)` | "32.1" |
| **Avg Putts/Hole** | `SUM(putts) / COUNT(holes)` | "1.78" |
| **3-Putt %** | `COUNT(putts>=3) / COUNT(holes)` | "12%" |

#### Club Usage Metrics
| Metric | Calculation | Display |
|--------|-------------|---------|
| **Shots by Club** | `COUNT(shots) GROUP BY club_name` | Bar chart |
| **Most Used Club** | Club with highest shot count | "7 Iron (18%)" |
| **Putter Usage** | `COUNT(is_putt=true)` | Separate stat |

### Analytics Query Examples

```sql
-- Average score per round (last 30 days)
SELECT 
  AVG(
    (SELECT COUNT(*) FROM shots WHERE round_id = r.id)
  ) as avg_strokes
FROM rounds r
WHERE r.user_id = $1
  AND r.status = 'completed'
  AND r.completed_at > NOW() - INTERVAL '30 days';

-- Fairway hit percentage
SELECT 
  ROUND(
    COUNT(*) FILTER (WHERE h.fairway_hit = true)::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE h.par > 3), 0) * 100, 
    1
  ) as fir_percentage
FROM holes h
JOIN rounds r ON h.round_id = r.id
WHERE r.user_id = $1 AND r.status = 'completed';

-- Club usage breakdown
SELECT 
  COALESCE(s.club_name, 'Unknown') as club,
  COUNT(*) as shots,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) as percentage
FROM shots s
JOIN rounds r ON s.round_id = r.id
WHERE r.user_id = $1 
  AND r.status = 'completed'
  AND s.is_putt = false
GROUP BY s.club_name
ORDER BY shots DESC;
```

---

## UI/UX Specification

### New Screens

#### 1. Auth Modal (`/auth` or modal overlay)

**Wireframe:**
```
┌────────────────────────────────────────┐
│  ╔════════════════════════════════╗    │
│  ║         Golf Caddy             ║    │
│  ║                                ║    │
│  ║  ┌──────────┬──────────┐       ║    │
│  ║  │ Sign In  │ Sign Up  │       ║    │
│  ║  └──────────┴──────────┘       ║    │
│  ║                                ║    │
│  ║  ┌────────────────────────┐    ║    │
│  ║  │ Email                  │    ║    │
│  ║  └────────────────────────┘    ║    │
│  ║  ┌────────────────────────┐    ║    │
│  ║  │ Password          👁   │    ║    │
│  ║  └────────────────────────┘    ║    │
│  ║                                ║    │
│  ║  ┌────────────────────────┐    ║    │
│  ║  │      Sign In           │    ║    │
│  ║  └────────────────────────┘    ║    │
│  ║                                ║    │
│  ║  Forgot password?              ║    │
│  ║                                ║    │
│  ╚════════════════════════════════╝    │
└────────────────────────────────────────┘
```

**Sign Up Tab additions:**
- Display Name field (above email)
- Password strength indicator
- Terms acceptance checkbox

#### 2. Profile Screen (`/profile`)

**Signed In State:**
```
┌────────────────────────────────────────┐
│  ← Profile                             │
├────────────────────────────────────────┤
│                                        │
│           ┌─────────┐                  │
│           │  👤     │                  │
│           └─────────┘                  │
│         Brian Johnson                  │
│         brian@example.com              │
│                                        │
├────────────────────────────────────────┤
│  Handicap Index                        │
│  ┌─────────────────────────────────┐   │
│  │      14.2         ↓ 0.3         │   │
│  │   Low HI: 12.8                  │   │
│  └─────────────────────────────────┘   │
│                                        │
├────────────────────────────────────────┤
│  Home Course                           │
│  TPC Sawgrass              [Edit]      │
│                                        │
├────────────────────────────────────────┤
│  Quick Stats                           │
│  ┌────────────┬────────────┐           │
│  │ 24 Rounds  │ Best: 78   │           │
│  └────────────┴────────────┘           │
│                                        │
├────────────────────────────────────────┤
│  ┌────────────────────────────────┐    │
│  │         Sign Out               │    │
│  └────────────────────────────────┘    │
│                                        │
└────────────────────────────────────────┘
```

**Guest State:**
Shows Auth Modal inline (Sign Up / Sign In forms)

#### 3. Round History (`/history`)

```
┌────────────────────────────────────────┐
│  ← Round History                       │
├────────────────────────────────────────┤
│  ┌──────┬────────┬─────────┐           │
│  │ All  │ 9-hole │ 18-hole │           │
│  └──────┴────────┴─────────┘           │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ Mar 27, 2026                     │  │
│  │ Augusta National          ☁️     │  │
│  │ 18 holes · White tees            │  │
│  │ Score: 87 (+15)    Diff: 14.2  > │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Mar 20, 2026                     │  │
│  │ Pebble Beach              ☁️     │  │
│  │ 18 holes · Blue tees             │  │
│  │ Score: 92 (+20)    Diff: 15.8  > │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ Mar 15, 2026                     │  │
│  │ Local Muni               📱      │  │
│  │ 9 holes · White tees             │  │
│  │ Score: 44 (+8)          Diff: —> │  │
│  └──────────────────────────────────┘  │
│                                        │
│         Loading more...                │
│                                        │
└────────────────────────────────────────┘
```

**Legend:**
- ☁️ = Synced to cloud
- 📱 = Local only (guest or unsynced)

#### 4. Analytics Dashboard (`/analytics`)

```
┌────────────────────────────────────────┐
│  ← Analytics                           │
├────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │ Last 10 │ 30d │ 90d │ All Time  │   │
│  └─────────────────────────────────┘   │
├────────────────────────────────────────┤
│  HANDICAP                              │
│  ┌─────────────────────────────────┐   │
│  │  14.2        ↓ 0.8 (30d)        │   │
│  │  ───────────────────────────    │   │
│  │  [        Line Chart           ]│   │
│  │  [    HI over last 20 rounds   ]│   │
│  └─────────────────────────────────┘   │
├────────────────────────────────────────┤
│  SCORING                               │
│  ┌────────────┬────────────┐           │
│  │ Avg Score  │ Best Round │           │
│  │   87.4     │    78      │           │
│  └────────────┴────────────┘           │
│  Trend: ↓ 2.3 strokes (improving)      │
├────────────────────────────────────────┤
│  ACCURACY                              │
│  ┌────────────┬────────────┐           │
│  │ FIR %      │ GIR %      │           │
│  │   58%      │   44%      │           │
│  └────────────┴────────────┘           │
│  ┌────────────┬────────────┐           │
│  │ Avg Putts  │ 3-Putt %   │           │
│  │   32.1     │   12%      │           │
│  └────────────┴────────────┘           │
├────────────────────────────────────────┤
│  CLUB USAGE                            │
│  ┌─────────────────────────────────┐   │
│  │ 7 Iron    ████████████  18%     │   │
│  │ Driver    ██████████    15%     │   │
│  │ PW        ████████      12%     │   │
│  │ 8 Iron    ███████       10%     │   │
│  │ ...                             │   │
│  └─────────────────────────────────┘   │
│                                        │
└────────────────────────────────────────┘
```

#### 5. Post-Round Save Prompt (Guest)

```
┌────────────────────────────────────────┐
│  Round Complete! Score: 87             │
├────────────────────────────────────────┤
│                                        │
│  (existing summary content)            │
│                                        │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ 💾 Save this round?              │  │
│  │ Sign in to keep your history     │  │
│  │ and track your handicap.         │  │
│  │                                  │  │
│  │ [Sign Up]  [Sign In]  [Not Now]  │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

#### 6. Guest Migration Modal

```
┌────────────────────────────────────────┐
│  ╔════════════════════════════════╗    │
│  ║   Welcome, Brian! 🎉           ║    │
│  ║                                ║    │
│  ║   We found 5 rounds on this    ║    │
│  ║   device. Sync them to your    ║    │
│  ║   new account?                 ║    │
│  ║                                ║    │
│  ║   ┌────────────────────────┐   ║    │
│  ║   │   Yes, sync my rounds  │   ║    │
│  ║   └────────────────────────┘   ║    │
│  ║   ┌────────────────────────┐   ║    │
│  ║   │   No, start fresh      │   ║    │
│  ║   └────────────────────────┘   ║    │
│  ║                                ║    │
│  ╚════════════════════════════════╝    │
└────────────────────────────────────────┘
```

### Navigation Updates

**Current Bottom Nav:**
```
[ Home ] [ Clubs ] [ Settings ]
```

**Updated Bottom Nav:**
```
[ Home ] [ History ] [ Analytics ] [ Profile ]
```

- **Home** — Start round, active round access
- **History** — Round history list
- **Analytics** — Stats dashboard  
- **Profile** — User profile, settings, auth

---

## Implementation Plan

### Phase 1: Auth Foundation (Week 1-2)
| Ticket | Title | Estimate | Dependencies |
|--------|-------|----------|--------------|
| THEA-101 | Create `src/lib/auth.ts` with Supabase auth wrappers | 3h | — |
| THEA-102 | Create `useAuth` hook for React components | 2h | THEA-101 |
| THEA-103 | Extend Zustand store with auth state (`userId`, `profile`) | 3h | THEA-102 |
| THEA-104 | Build Auth Modal UI (Sign In / Sign Up tabs) | 5h | THEA-103 |
| THEA-105 | Implement password reset flow (magic link) | 3h | THEA-104 |
| THEA-106 | Add auth state persistence (session recovery on reload) | 2h | THEA-103 |

**Phase 1 Deliverable:** Users can sign up, sign in, sign out. Session persists.

### Phase 2: Profile & Sync Infrastructure (Week 2-3)
| Ticket | Title | Estimate | Dependencies |
|--------|-------|----------|--------------|
| THEA-107 | DB migration: add `handicap_differential`, `course_rating`, `slope_rating` to rounds | 1h | — |
| THEA-108 | DB migration: add `penalties`, `gir` to holes | 1h | — |
| THEA-109 | Build Profile screen UI (signed in + guest states) | 5h | THEA-104 |
| THEA-110 | Create `src/lib/sync.ts` with round sync logic | 8h | THEA-103, THEA-107 |
| THEA-111 | Implement sync queue for offline support | 5h | THEA-110 |
| THEA-112 | Wire `completeRound()` to trigger sync for logged-in users | 3h | THEA-110 |
| THEA-113 | Add sync status badges to round list items | 2h | THEA-112 |

**Phase 2 Deliverable:** Logged-in users' completed rounds sync automatically.

### Phase 3: Round History & Resume (Week 3-4)
| Ticket | Title | Estimate | Dependencies |
|--------|-------|----------|--------------|
| THEA-114 | Build Round History screen (`/history`) | 5h | THEA-112 |
| THEA-115 | Implement round fetch from Supabase + local merge | 5h | THEA-114 |
| THEA-116 | Add filters (All / 9-hole / 18-hole) and pagination | 3h | THEA-114 |
| THEA-117 | Implement active round persistence to Supabase | 5h | THEA-110 |
| THEA-118 | Build "Resume round?" prompt on app launch | 3h | THEA-117 |
| THEA-119 | Background sync for active rounds (5-min interval) | 3h | THEA-117 |

**Phase 3 Deliverable:** Full round history accessible; in-progress rounds recoverable.

### Phase 4: Guest Migration (Week 4)
| Ticket | Title | Estimate | Dependencies |
|--------|-------|----------|--------------|
| THEA-120 | Detect local rounds on signup completion | 2h | THEA-104 |
| THEA-121 | Build migration prompt modal | 3h | THEA-120 |
| THEA-122 | Implement batch sync for local rounds | 5h | THEA-121, THEA-110 |
| THEA-123 | Add progress indicator during migration | 2h | THEA-122 |
| THEA-124 | Build post-round save prompt for guests | 3h | THEA-104 |

**Phase 4 Deliverable:** Guests can migrate local rounds; prompted to save after rounds.

### Phase 5: Analytics Dashboard (Week 5-6)
| Ticket | Title | Estimate | Dependencies |
|--------|-------|----------|--------------|
| THEA-125 | Create analytics data fetching layer | 5h | THEA-115 |
| THEA-126 | Build Analytics screen shell with time range filter | 3h | — |
| THEA-127 | Implement Handicap section with trend chart | 5h | THEA-125, THEA-126 |
| THEA-128 | Implement Scoring section (avg, best, trend) | 3h | THEA-125, THEA-126 |
| THEA-129 | Implement Accuracy section (FIR%, GIR%, putts) | 3h | THEA-125, THEA-126 |
| THEA-130 | Implement Club Usage chart | 4h | THEA-125, THEA-126 |
| THEA-131 | Update bottom navigation with new tabs | 2h | THEA-126, THEA-114 |

**Phase 5 Deliverable:** Full analytics dashboard with all metrics.

### Phase 6: Polish & QA (Week 6)
| Ticket | Title | Estimate | Dependencies |
|--------|-------|----------|--------------|
| THEA-132 | Error handling & edge cases audit | 5h | All |
| THEA-133 | Offline mode testing & fixes | 5h | THEA-111 |
| THEA-134 | Performance optimization (queries, renders) | 5h | All |
| THEA-135 | Accessibility audit (a11y) | 3h | All UI tickets |
| THEA-136 | E2E test suite for auth & sync flows | 8h | All |

**Phase 6 Deliverable:** Production-ready, tested feature set.

### Ticket Summary

| Phase | Tickets | Total Estimate |
|-------|---------|----------------|
| Phase 1: Auth | THEA-101 to THEA-106 | 18h |
| Phase 2: Profile & Sync | THEA-107 to THEA-113 | 25h |
| Phase 3: History & Resume | THEA-114 to THEA-119 | 24h |
| Phase 4: Guest Migration | THEA-120 to THEA-124 | 15h |
| Phase 5: Analytics | THEA-125 to THEA-131 | 25h |
| Phase 6: Polish & QA | THEA-132 to THEA-136 | 26h |
| **Total** | **36 tickets** | **133h (~3.5 weeks)** |

---

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-1 | Should we use Supabase anonymous auth for guests to simplify migration? | CTO | **Decision: No** — adds complexity, localStorage is sufficient for V3 |
| OQ-2 | Do we need real-time sync via Supabase Realtime? | CTO | **Decision: No** — polling/manual refresh sufficient for V3 |
| OQ-3 | Should club bag sync to Supabase per user? | CTO | **Decision: Yes** — included in THEA-110 sync logic |
| OQ-4 | What happens to local rounds after signing out? | CTO | **Decision: Keep locally** — they remain accessible in guest mode |
| OQ-5 | How do we handle the same round edited on two offline devices? | CTO | **Decision: LWW** — last write wins, documented limitation for V3 |
| OQ-6 | Should we calculate GIR automatically from shot data? | PM | **Open** — requires knowing if approach shot landed on green |
| OQ-7 | Do we need email verification before allowing full access? | CTO | **Decision: No** — allow immediate access, verify later for premium features |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Data loss during sync failures** | Medium | High | Implement robust queue with retry; never delete local until confirmed synced |
| **Slow initial load with large history** | Medium | Medium | Paginate queries; lazy load; cache in localStorage |
| **Supabase rate limits** | Low | Medium | Batch operations; implement backoff; monitor usage |
| **User confusion about local vs cloud** | Medium | Medium | Clear visual indicators (☁️/📱); onboarding tooltip |
| **Handicap calculation discrepancies** | Low | High | Comprehensive test suite; match USGA/R&A reference calculations |
| **Offline sync conflicts** | Medium | Medium | Document LWW behavior; consider conflict UI for V4 |
| **Session token expiration** | Low | Low | Supabase auto-refresh; graceful re-auth prompt |
| **PWA cache invalidation** | Medium | Medium | Service worker version strategy; force refresh on major updates |

---

## Appendix

### A. Supabase Client Configuration

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

### B. Sample Sync Implementation

```typescript
// src/lib/sync.ts (sketch)
export async function syncRoundToSupabase(
  round: Round, 
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: roundData, error: roundError } = await supabase
    .from('rounds')
    .upsert({
      id: round.id,
      user_id: userId,
      course_name: round.courseName,
      course_id: round.courseId,
      tees: round.tees,
      player_name: round.playerName,
      hole_count: round.holeCount,
      status: round.completedAt ? 'completed' : 'active',
      started_at: new Date(round.startedAt).toISOString(),
      completed_at: round.completedAt 
        ? new Date(round.completedAt).toISOString() 
        : null,
      course_rating: round.courseRating,
      slope_rating: round.slopeRating,
    })
    .select()
    .single()

  if (roundError) return { success: false, error: roundError.message }

  // Sync holes and shots...
  for (const hole of round.holes) {
    const { data: holeData, error: holeError } = await supabase
      .from('holes')
      .upsert({
        round_id: round.id,
        user_id: userId,
        hole_number: hole.number,
        par: hole.par,
        putts: hole.putts ?? 0,
        fairway_hit: hole.fairwayHit,
        penalties: hole.penalties ?? 0,
      })
      .select()
      .single()

    if (holeError) continue

    // Sync shots for this hole
    for (let i = 0; i < hole.shots.length; i++) {
      const shot = hole.shots[i]
      await supabase.from('shots').upsert({
        hole_id: holeData.id,
        round_id: round.id,
        user_id: userId,
        club_id: shot.clubId,
        sequence: i + 1,
        is_putt: false, // Determine from club or explicit flag
      })
    }
  }

  return { success: true }
}
```

### C. Store Extensions

```typescript
// Additions to src/store/index.ts
interface AuthState {
  userId: string | null
  profile: UserProfile | null
  isAuthenticated: boolean
  
  setUserId: (id: string | null) => void
  setProfile: (profile: UserProfile | null) => void
  signOut: () => void
}

interface SyncState {
  syncQueue: SyncQueueItem[]
  syncStatus: Record<string, SyncStatus>
  
  queueSync: (item: SyncQueueItem) => void
  markSynced: (roundId: string) => void
  processSyncQueue: () => Promise<void>
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-28 | CTO | Initial PRD |

---

*This PRD is ready for engineering review and ticket creation.*
