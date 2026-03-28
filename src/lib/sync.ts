/**
 * sync.ts — Supabase sync helpers (Phase 2 + Phase 3)
 */
import { supabase } from './supabase'
import type { Round, Hole, Shot, UserProfile, Club } from '../types'

// ── Per-round sync mutex ───────────────────────────────────────────────────

const syncingRounds = new Set<string>()

/** Returns true if the lock was acquired; false if already syncing. */
export function acquireSyncLock(roundId: string): boolean {
  if (syncingRounds.has(roundId)) return false
  syncingRounds.add(roundId)
  return true
}

export function releaseSyncLock(roundId: string): void {
  syncingRounds.delete(roundId)
}

// ── Round sync ────────────────────────────────────────────────────────────

/**
 * Derive a stable, deterministic UUID for a hole from (roundId, holeNumber).
 * Encodes hole_number into the last 4 hex chars of the round UUID so concurrent
 * calls always produce the same IDs → UPSERT is idempotent.
 */
function stableHoleId(roundId: string, holeNumber: number): string {
  const hex = roundId.replace(/-/g, '')
  const tail = holeNumber.toString(16).padStart(4, '0')
  const full = hex.slice(0, 28) + tail
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20)}`
}

/**
 * Derive a stable, deterministic UUID for a shot from (roundId, holeNumber, sequence).
 * Encodes holeNumber (2 hex chars) and sequence (2 hex chars) into the last 4 chars of
 * the round UUID. Using roundId + holeNumber directly avoids the prior bug where
 * stableShotId derived from holeId would collide — holeId only differs in chars 28–31,
 * but we sliced at 27, making all holes share the same prefix.
 */
function stableShotId(roundId: string, holeNumber: number, sequence: number): string {
  const hex = roundId.replace(/-/g, '')
  const holeHex = holeNumber.toString(16).padStart(2, '0')
  const seqHex = sequence.toString(16).padStart(2, '0')
  const full = hex.slice(0, 28) + holeHex + seqHex
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-${full.slice(12, 16)}-${full.slice(16, 20)}-${full.slice(20)}`
}

/**
 * Upsert a round (and its holes + shots) to Supabase.
 * Callers: store.completeRound, syncQueue.processSyncQueue, syncActiveRound
 *
 * Race-condition safety: holes and shots are assigned deterministic UUIDs
 * derived from (roundId, holeNumber) and (holeId, sequence). Concurrent
 * calls for the same round therefore produce identical IDs and UPSERT the
 * same rows — no partial deletes or duplicate inserts can corrupt data.
 */
export async function syncRoundToSupabase(
  round: Round,
  userId: string,
  status: 'active' | 'completed' | 'abandoned' = 'completed',
): Promise<{ success: boolean }> {
  try {
    // 1. Upsert the round row
    const { error: roundError } = await supabase.from('rounds').upsert(
      {
        id: round.id,
        user_id: userId,
        course_id: round.courseId ?? null,
        course_name: round.courseName,
        tees: round.tees ?? null,
        tee_set: round.teeSet ?? null,
        player_name: round.playerName,
        hole_count: round.holeCount,
        status,
        course_rating: round.courseRating ?? null,
        slope_rating: round.slopeRating ?? null,
        score_differential: round.scoreDifferential ?? null,
        started_at: new Date(round.startedAt).toISOString(),
        completed_at: round.completedAt
          ? new Date(round.completedAt).toISOString()
          : null,
      },
      { onConflict: 'id' },
    )
    if (roundError) throw roundError

    // 2. Build hole upsert data with stable IDs
    const holeRows = round.holes.map(h => {
      const holeId = stableHoleId(round.id, h.number)
      return {
        id: holeId,
        round_id: round.id,
        user_id: userId,
        hole_number: h.number,
        par: h.par,
        putts: h.putts ?? 0,
        fairway_hit: h.fairwayHit ?? null,
        penalties: h.penalties ?? 0,
        gir: h.gir ?? null,
      }
    })
    const keepHoleIds = holeRows.map(h => h.id)

    // 3. UPSERT holes — idempotent because IDs are deterministic
    if (holeRows.length > 0) {
      const { error: holesError } = await supabase
        .from('holes')
        .upsert(holeRows, { onConflict: 'id' })
      if (holesError) throw holesError
    }

    // 4. Delete orphaned holes (e.g. hole count changed from 18→9)
    //    Shots cascade-delete via DB FK, so delete holes first then shots
    const { data: existingHoles, error: fetchHolesErr } = await supabase
      .from('holes')
      .select('id')
      .eq('round_id', round.id)
    if (fetchHolesErr) throw fetchHolesErr

    const orphanHoleIds = (existingHoles ?? [])
      .map(h => h.id)
      .filter(id => !keepHoleIds.includes(id))

    if (orphanHoleIds.length > 0) {
      // Delete orphaned shots first (FK constraint)
      const { error: delOrphanShotsErr } = await supabase
        .from('shots')
        .delete()
        .in('hole_id', orphanHoleIds)
      if (delOrphanShotsErr) throw delOrphanShotsErr

      const { error: delOrphanHolesErr } = await supabase
        .from('holes')
        .delete()
        .in('id', orphanHoleIds)
      if (delOrphanHolesErr) throw delOrphanHolesErr
    }

    // 5. Build shot upsert data with stable IDs
    const allShots: {
      id: string
      hole_id: string
      round_id: string
      user_id: string
      club_id: string
      sequence: number
      is_putt: boolean
    }[] = []

    for (const hole of round.holes) {
      const holeId = stableHoleId(round.id, hole.number)
      hole.shots.forEach((shot, i) => {
        allShots.push({
          id: stableShotId(round.id, hole.number, i + 1),
          hole_id: holeId,
          round_id: round.id,
          user_id: userId,
          club_id: shot.clubId,
          sequence: i + 1,
          is_putt: false,
        })
      })
    }

    // 6. UPSERT shots — idempotent because IDs are deterministic
    if (allShots.length > 0) {
      const { error: shotsError } = await supabase
        .from('shots')
        .upsert(allShots, { onConflict: 'id' })
      if (shotsError) throw shotsError
    }

    // 7. Delete orphaned shots (e.g. shots removed from a hole)
    const keepShotIds = allShots.map(s => s.id)
    const { data: existingShots, error: fetchShotsErr } = await supabase
      .from('shots')
      .select('id')
      .eq('round_id', round.id)
    if (fetchShotsErr) throw fetchShotsErr

    const orphanShotIds = (existingShots ?? [])
      .map(s => s.id)
      .filter(id => !keepShotIds.includes(id))

    if (orphanShotIds.length > 0) {
      const { error: delOrphanShotsErr } = await supabase
        .from('shots')
        .delete()
        .in('id', orphanShotIds)
      if (delOrphanShotsErr) throw delOrphanShotsErr
    }

    return { success: true }
  } catch (err) {
    return { success: false }
  }
}

// ── Abandon round ─────────────────────────────────────────────────────────

/**
 * Mark a round as abandoned in Supabase so it won't reappear on refresh.
 * Fire-and-forget; does not block the UI.
 */
export async function abandonRoundInSupabase(roundId: string): Promise<void> {
  try {
    await supabase
      .from('rounds')
      .update({ status: 'abandoned', completed_at: new Date().toISOString() })
      .eq('id', roundId)
  } catch {
    // intentionally swallowed — local state is already updated
  }
}

// ── Delete round ──────────────────────────────────────────────────────────

/**
 * Soft-delete a round in Supabase by setting deleted_at = now().
 * Fire-and-forget; does not block the UI.
 */
export async function deleteRoundInSupabase(roundId: string): Promise<void> {
  try {
    await supabase
      .from('rounds')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', roundId)
  } catch {
    // intentionally swallowed — local state is already updated
  }
}

// ── Active round ──────────────────────────────────────────────────────────

/**
 * Silently sync an in-progress round. Fire-and-forget; no return value.
 */
export async function syncActiveRound(
  roundId: string,
  userId: string,
): Promise<void> {
  try {
    // Lazy import avoids circular dependency with store
    const { useAppStore } = await import('../store')
    const round = useAppStore.getState().rounds.find(r => r.id === roundId)
    if (!round) return
    await syncRoundToSupabase(round, userId, 'active')
    console.debug('[sync] active round synced:', roundId)
  } catch (err) {
    console.error('[sync] syncActiveRound error:', err)
  }
}

/**
 * Fetch the most recent active round for a user (used on app resume).
 */
export async function fetchActiveRound(userId: string): Promise<Round | null> {
  try {
    const { data: row, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !row) return null
    return mapRowToRound(row)
  } catch {
    return null
  }
}

// ── Fetch rounds ──────────────────────────────────────────────────────────

export async function fetchRounds(
  userId: string,
  options?: { limit?: number; offset?: number },
): Promise<Round[]> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  try {
    const { data: roundRows, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    if (!roundRows || roundRows.length === 0) return []

    // Batch-fetch holes and shots to avoid N+1 (only for this page of rounds)
    const roundIds = roundRows.map(r => r.id)

    const { data: holeRows } = await supabase
      .from('holes')
      .select('*')
      .in('round_id', roundIds)
      .order('hole_number', { ascending: true })

    const holeIds = (holeRows ?? []).map(h => h.id)

    let shotRows: Array<{
      id: string
      hole_id: string
      round_id: string
      user_id: string
      club_id: string | null
      sequence: number
      created_at: string
    }> = []

    if (holeIds.length > 0) {
      const { data } = await supabase
        .from('shots')
        .select('*')
        .in('hole_id', holeIds)
        .order('sequence', { ascending: true })
      shotRows = (data ?? []) as typeof shotRows
    }

    // Group by round
    const rounds: Round[] = []
    for (const row of roundRows) {
      const rowHoles = (holeRows ?? []).filter(h => h.round_id === row.id)
      const holes: Hole[] = rowHoles.map(holeRow => {
        const holeShots = shotRows
          .filter(s => s.hole_id === holeRow.id)
          .map(s => ({
            clubId: s.club_id ?? '',
            timestamp: new Date(s.created_at).getTime(),
          } satisfies Shot))
        return {
          number: holeRow.hole_number,
          par: holeRow.par,
          shots: holeShots,
          putts: holeRow.putts,
          fairwayHit: holeRow.fairway_hit ?? undefined,
        } satisfies Hole
      })

      rounds.push({
        id: row.id,
        courseName: row.course_name,
        courseId: row.course_id ?? undefined,
        tees: row.tees ?? '',
        teeSet: row.tee_set ?? undefined,
        courseRating: row.course_rating ?? undefined,
        slopeRating: row.slope_rating ?? undefined,
        playerName: row.player_name,
        holeCount: row.hole_count as 9 | 18,
        startedAt: new Date(row.started_at).getTime(),
        completedAt: row.completed_at
          ? new Date(row.completed_at).getTime()
          : undefined,
        holes,
        scoreDifferential: row.score_differential ?? null,
      } satisfies Round)
    }

    return rounds
  } catch (err) {
    console.error('[sync] fetchRounds error:', err)
    return []
  }
}

// ── Profile ───────────────────────────────────────────────────────────────

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      displayName: data.display_name,
      username: (data as Record<string, unknown>).username as string | undefined ?? undefined,
      homeCourse: data.home_course ?? undefined,
      handicapIndex: data.handicap_index ?? null,
    }
  } catch {
    return null
  }
}

export async function updateProfile(
  userId: string,
  profile: Partial<UserProfile>,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (profile.displayName !== undefined) patch.display_name = profile.displayName
  if (profile.homeCourse !== undefined) patch.home_course = profile.homeCourse
  if (profile.handicapIndex !== undefined) patch.handicap_index = profile.handicapIndex

  if (Object.keys(patch).length === 0) return

  try {
    await supabase.from('profiles').update(patch).eq('id', userId)
  } catch {
    // update failed — caller can retry
  }
}

// ── Clubs ─────────────────────────────────────────────────────────────────

export async function syncClubs(userId: string, clubs: Club[]): Promise<void> {
  try {
    if (clubs.length === 0) return
    const { error } = await supabase.from('clubs').upsert(
      clubs.map(c => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        sort_order: c.order,
      })),
      { onConflict: 'id' },
    )
    if (error) throw error
  } catch (err) {
    console.error('[sync] syncClubs error:', err)
  }
}

// ── Migration ─────────────────────────────────────────────────────────────

/**
 * Batch-migrate local rounds to Supabase sequentially.
 * Called after signup when user confirms migration prompt.
 */
export async function migrateLocalRounds(
  userId: string,
  rounds: Round[],
  onProgress?: (current: number, total: number) => void,
): Promise<{ synced: number; failed: number }> {
  // Only migrate rounds that are not already synced
  const toMigrate = rounds.filter(r => r.completedAt != null)
  const total = toMigrate.length
  let synced = 0
  let failed = 0

  for (let i = 0; i < toMigrate.length; i++) {
    const round = toMigrate[i]
    onProgress?.(i + 1, total)
    try {
      const result = await syncRoundToSupabase(round, userId, 'completed')
      if (result.success) {
        synced++
        // Lazy import store to avoid circular deps
        const { useAppStore } = await import('../store')
        useAppStore.getState().markRoundSynced(round.id)
      } else {
        failed++
        const { useAppStore } = await import('../store')
        useAppStore.getState().markRoundError(round.id)
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}

export async function fetchClubs(userId: string): Promise<Club[]> {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
    if (error || !data) return []
    return data.map((c: { id: string; name: string; sort_order: number }) => ({
      id: c.id,
      name: c.name,
      order: c.sort_order,
    }))
  } catch {
    return []
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function mapRowToRound(row: {
  id: string
  course_id: string | null
  course_name: string
  tees: string | null
  tee_set: string | null
  course_rating: number | null
  slope_rating: number | null
  player_name: string
  hole_count: 9 | 18
  started_at: string
  completed_at: string | null
  score_differential: number | null
}): Promise<Round | null> {
  try {
    const { data: holeRows, error: holeError } = await supabase
      .from('holes')
      .select('*')
      .eq('round_id', row.id)
      .order('hole_number', { ascending: true })

    if (holeError) throw holeError

    const holeIds = (holeRows ?? []).map(h => h.id)
    let shotRows: Array<{
      id: string
      hole_id: string
      club_id: string | null
      sequence: number
      created_at: string
    }> = []

    if (holeIds.length > 0) {
      const { data } = await supabase
        .from('shots')
        .select('*')
        .in('hole_id', holeIds)
        .order('sequence', { ascending: true })
      shotRows = (data ?? []) as typeof shotRows
    }

    const holes: Hole[] = (holeRows ?? []).map(holeRow => {
      const shots: Shot[] = shotRows
        .filter(s => s.hole_id === holeRow.id)
        .map(s => ({
          clubId: s.club_id ?? '',
          timestamp: new Date(s.created_at).getTime(),
        }))
      return {
        number: holeRow.hole_number,
        par: holeRow.par,
        shots,
        putts: holeRow.putts,
        fairwayHit: holeRow.fairway_hit ?? undefined,
      }
    })

    return {
      id: row.id,
      courseName: row.course_name,
      courseId: row.course_id ?? undefined,
      tees: row.tees ?? '',
      teeSet: row.tee_set ?? undefined,
      courseRating: row.course_rating ?? undefined,
      slopeRating: row.slope_rating ?? undefined,
      playerName: row.player_name,
      holeCount: row.hole_count,
      startedAt: new Date(row.started_at).getTime(),
      completedAt: row.completed_at
        ? new Date(row.completed_at).getTime()
        : undefined,
      holes,
      scoreDifferential: row.score_differential ?? null,
    }
  } catch {
    return null
  }
}
