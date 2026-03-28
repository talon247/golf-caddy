# PRD: Round Persistence Reliability

**Status:** Draft
**Priority:** P0
**Author:** CTO (Agent)
**Date:** 2026-03-28
**Parent Issue:** THEA-152

---

## Problem Statement

Brian reported that after logging in with a new account, only 1 of his prior rounds appeared in Round History (showing as "Local only"). A second round was missing entirely. This indicates systemic gaps in round persistence, sync, and the guest-to-authenticated migration flow.

## Root Cause Analysis

The app uses a two-tier persistence model: **local-first (localStorage) + cloud-optional (Supabase)**. The audit revealed multiple interacting failures:

### Why rounds show as "Local only" after sign-in
1. **syncStatus is not reconciled with the sync queue on app reload.** If the app crashes or is closed during sync, `syncStatus` may show 'pending' but the queue item survives in localStorage. On reload, the store doesn't reconcile — the round appears as 'local' even though it may be in the queue.
2. **Fire-and-forget sync in `completeRound()`** has no `.catch()` handler. If `syncRoundToSupabase` throws (vs returning `{ success: false }`), the error is swallowed, leaving syncStatus stuck at 'pending' forever.

### Why a round goes missing entirely
1. **Race condition in `syncRoundToSupabase`**: The sync function DELETEs all child rows (holes, shots) then re-INSERTs them. If two sync calls run concurrently (e.g., immediate retry + queue retry), one can delete the other's just-inserted data, leaving orphaned round rows with no holes/shots.
2. **localStorage quota errors are silently dropped** in `saveQueue()`. If the device is full, the queue item is lost, and the round never retries sync.
3. **Migration logic uses type-casting hacks** to check `syncStatus` on the Round object (it's actually on `store.syncStatus[roundId]`). Rounds with undefined status may be skipped during migration.

---

## Identified Weak Points

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1 | Missing `SyncIndicator` component — History page crashes at runtime | **P0** | `src/pages/History.tsx:220` |
| 2 | Fire-and-forget sync with no `.catch()` — silent data loss | **P0** | `src/store/index.ts:346-361` |
| 3 | Concurrent sync race condition (DELETE-then-INSERT without transaction) | **P0** | `src/lib/sync.ts:43-54` |
| 4 | `syncStatus` not reconciled with queue on app load | **P0** | `src/store/index.ts`, `src/lib/syncQueue.ts` |
| 5 | Migration logic uses wrong type for syncStatus check, may sync incomplete rounds | **P1** | `src/components/AuthModal.tsx:176-189` |
| 6 | History merge discards local edits without timestamp comparison | **P1** | `src/pages/History.tsx:66-73` |
| 7 | No pagination in `fetchRounds()` — performance degrades with volume | **P1** | `src/lib/sync.ts:162-167` |
| 8 | localStorage quota errors silently dropped — sync queue items lost | **P1** | `src/lib/syncQueue.ts:24-29` |
| 9 | Retry logic uses fixed 3 retries with no exponential backoff | **P2** | `src/lib/syncQueue.ts:74-92` |
| 10 | RLS policies don't enforce soft-delete filter | **P2** | Supabase migrations |

---

## Specific Fixes Required

### Fix 1: Create SyncIndicator Component (P0)
**File:** `src/components/SyncIndicator.tsx` (new)
**What:** Create a small badge/icon component that shows sync status ('local', 'pending', 'synced', 'error') with a retry button for error state. Referenced in History.tsx but does not exist.
**Acceptance criteria:**
- Renders without crashing
- Shows visual state for each status
- Retry button calls `handleRetry(roundId)` on error state
- Mobile-friendly tap target (min 44px)

### Fix 2: Add Error Handling to completeRound Sync (P0)
**File:** `src/store/index.ts` — `completeRound()` method
**What:**
- Add `.catch()` handler to the `syncRoundToSupabase` promise chain
- Ensure `markRoundError` + `addToQueue` is called on any thrown error
- Persist syncStatus to localStorage BEFORE starting sync (not after)
- Show toast/notification on sync failure

### Fix 3: Wrap syncRoundToSupabase in Transaction (P0)
**File:** `src/lib/sync.ts` — `syncRoundToSupabase()`
**What:**
- Use Supabase RPC or a database function to wrap DELETE+INSERT in a transaction
- Alternative: use UPSERT for child rows (holes, shots) instead of DELETE+INSERT
- Add a sync mutex/lock to prevent concurrent calls for the same round

### Fix 4: Reconcile syncStatus with Queue on App Load (P0)
**File:** `src/store/index.ts`, `src/lib/syncQueue.ts`
**What:**
- On app initialization, read the sync queue from localStorage
- For each queued item, set `syncStatus[roundId] = 'pending'`
- For rounds that exist locally but have no syncStatus entry and user is authenticated, mark as 'local' (needs sync)
- Process the queue on load if online

### Fix 5: Fix Migration Logic (P1)
**File:** `src/components/AuthModal.tsx`
**What:**
- Use `store.syncStatus[round.id]` instead of type-casting Round
- Filter to `completedAt != null` before offering migration
- Handle migration return value (`{ synced, failed }`) — show result to user
- Don't migrate rounds already in 'synced' or 'pending' state

### Fix 6: Improve History Merge with Timestamps (P1)
**File:** `src/pages/History.tsx`
**What:**
- When both cloud and local versions exist, compare `completedAt` timestamps
- Use the more recent version
- Add `updatedAt` tracking to rounds (requires schema change)
- Show sync source indicator (cloud icon vs device icon)

### Fix 7: Add Pagination to fetchRounds (P1)
**File:** `src/lib/sync.ts` — `fetchRounds()`
**What:**
- Add `limit` and `offset` parameters (default: limit=50)
- Support cursor-based pagination for History infinite scroll
- Fetch holes/shots only for the current page of rounds

### Fix 8: Handle localStorage Quota Errors (P1)
**File:** `src/lib/syncQueue.ts`
**What:**
- Catch `QuotaExceededError` specifically
- Show user warning when storage is full
- Implement LRU eviction of old synced rounds from localStorage
- Log quota errors to Sentry

### Fix 9: Add Exponential Backoff to Retry (P2)
**File:** `src/lib/syncQueue.ts`
**What:**
- Track `nextRetryAt` timestamp per queue item
- Exponential backoff: 2s, 10s, 60s, then give up
- Add jitter to prevent thundering herd
- Skip items whose `nextRetryAt` is in the future

### Fix 10: RLS Soft-Delete Enforcement (P2)
**Files:** Supabase migration
**What:**
- Add `AND deleted_at IS NULL` to RLS policies on clubs, rounds
- Or create a security-definer view that pre-filters

---

## Data Integrity Checks

### Orphaned Round Detection
Create a Supabase RPC `detect_orphaned_rounds()` that finds:
- Rounds with no holes (should have 9 or 18)
- Holes with no shots
- Rounds where `status = 'completed'` but `completed_at IS NULL`
- Rounds where hole count doesn't match `hole_count` field

### Recovery Strategy
- For orphaned rounds with no holes: mark as `status = 'abandoned'`, flag for user review
- For rounds with missing shots: preserve what exists, show warning in History
- Add a "re-sync from device" action that re-uploads local round data

---

## Sync Status Visibility

### Current State
- No visual indicator of sync status in History
- SyncIndicator component missing (crashes page)
- User has no way to know if data is safe in the cloud

### Target State
- Each round in History shows a sync badge: cloud checkmark (synced), device icon (local), spinner (pending), warning (error)
- Error state shows retry button
- Profile page shows overall sync health: "3 rounds pending sync"
- Toast notification on sync success/failure after round completion

---

## Ticket Breakdown

| Ticket | Title | Assignee | Priority | Dependencies |
|--------|-------|----------|----------|-------------|
| T1 | Create SyncIndicator component | SE1 | P0 | None |
| T2 | Fix completeRound sync error handling + add sync mutex | SE1 | P0 | None |
| T3 | Wrap syncRoundToSupabase in transaction / use upsert for children | SE2 | P0 | None |
| T4 | Reconcile syncStatus with queue on app load | SE2 | P0 | None |
| T5 | Fix migration logic — correct syncStatus check + filter incomplete rounds | SE1 | P1 | T2 |
| T6 | Add fetchRounds pagination + localStorage quota handling | SE2 | P1 | T3 |
| T7 | Orphaned round detection RPC + exponential backoff retry | Backend | P1 | None |
| T8 | RLS soft-delete enforcement | Backend | P2 | None |
