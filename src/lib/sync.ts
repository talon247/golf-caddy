/**
 * sync.ts — Supabase sync helpers (Phase 2 + Phase 3)
 */
import { supabase } from './supabase'
import type { Round, Hole, Shot, UserProfile, Club } from '../types'

// ── Round sync ────────────────────────────────────────────────────────────

/**
 * Upsert a round (and its holes + shots) to Supabase.
 * Callers: store.completeRound, syncQueue.processSyncQueue, syncActiveRound
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

    // 2. Delete existing shots then holes (FK order)
    const { error: delShotsErr } = await supabase
      .from('shots')
      .delete()
      .eq('round_id', round.id)
    if (delShotsErr) throw delShotsErr

    const { error: delHolesErr } = await supabase
      .from('holes')
      .delete()
      .eq('round_id', round.id)
    if (delHolesErr) throw delHolesErr

    // 3. Insert holes
    if (round.holes.length > 0) {
      const { data: insertedHoles, error: holesError } = await supabase
        .from('holes')
        .insert(
          round.holes.map(h => ({
            round_id: round.id,
            user_id: userId,
            hole_number: h.number,
            par: h.par,
            putts: h.putts ?? 0,
            fairway_hit: h.fairwayHit ?? null,
          })),
        )
        .select('id, hole_number')
      if (holesError) throw holesError

      // 4. Insert shots (batch)
      const allShots: {
        hole_id: string
        round_id: string
        user_id: string
        club_id: string
        sequence: number
        is_putt: boolean
      }[] = []

      for (const hole of round.holes) {
        if (hole.shots.length === 0) continue
        const holeRow = (insertedHoles ?? []).find(
          h => h.hole_number === hole.number,
        )
        if (!holeRow) continue
        hole.shots.forEach((shot, i) => {
          allShots.push({
            hole_id: holeRow.id,
            round_id: round.id,
            user_id: userId,
            club_id: shot.clubId,
            sequence: i + 1,
            is_putt: false,
          })
        })
      }

      if (allShots.length > 0) {
        const { error: shotsError } = await supabase
          .from('shots')
          .insert(allShots)
        if (shotsError) throw shotsError
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[sync] syncRoundToSupabase error:', err)
    return { success: false }
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

export async function fetchRounds(userId: string): Promise<Round[]> {
  try {
    const { data: roundRows, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false })

    if (error) throw error
    if (!roundRows || roundRows.length === 0) return []

    // Batch-fetch holes and shots to avoid N+1
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
  try {
    await supabase.from('profiles').upsert(
      {
        id: userId,
        display_name: profile.displayName ?? '',
        home_course: profile.homeCourse ?? null,
        handicap_index: profile.handicapIndex ?? null,
      },
      { onConflict: 'id' },
    )
  } catch (err) {
    console.error('[sync] updateProfile error:', err)
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
