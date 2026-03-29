import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { TournamentRound, LeagueRoundGroup } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

function formatScore(score: number | null): string {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : `${score}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function groupRounds(rows: TournamentRound[]): LeagueRoundGroup[] {
  const map = new Map<string, LeagueRoundGroup>()
  for (const r of rows) {
    const key = r.group_round_id ?? r.round_id ?? r.id
    if (!map.has(key)) {
      map.set(key, {
        key,
        group_round_id: r.group_round_id,
        played_at: r.counted_at,
        course_name: null,
        voided: r.voided_at !== null,
        players: [],
      })
    }
    const group = map.get(key)!
    group.voided = group.voided && r.voided_at !== null
    group.players.push({
      id: r.id,
      display_name: r.display_name,
      score_to_par: r.score_to_par,
      total_strokes: r.total_strokes,
    })
  }
  return Array.from(map.values()).sort((a, b) => {
    if (!a.played_at && !b.played_at) return 0
    if (!a.played_at) return 1
    if (!b.played_at) return -1
    return new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
  })
}

interface VoidState {
  group: LeagueRoundGroup
  reason: string
}

interface Props {
  leagueId: string
  isCommissioner: boolean
}

export default function LeagueRoundsTab({ leagueId, isCommissioner }: Props) {
  const [rounds, setRounds] = useState<LeagueRoundGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voidState, setVoidState] = useState<VoidState | null>(null)
  const [voiding, setVoiding] = useState(false)

  const fetchRounds = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await db
        .from('tournament_rounds')
        .select('*')
        .eq('tournament_id', leagueId)
        .order('counted_at', { ascending: false })

      if (err) throw err
      setRounds(groupRounds((data ?? []) as TournamentRound[]))
    } catch {
      setError('Could not load rounds.')
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => { fetchRounds() }, [fetchRounds])

  const handleVoidConfirm = useCallback(async () => {
    if (!voidState) return
    setVoiding(true)
    try {
      const playerIds = voidState.group.players.map((p) => p.id)
      await db
        .from('tournament_rounds')
        .update({ voided_at: new Date().toISOString(), void_reason: voidState.reason.trim() || null })
        .in('id', playerIds)
      await fetchRounds()
    } catch {
      // non-fatal — reload to sync
      await fetchRounds()
    } finally {
      setVoiding(false)
      setVoidState(null)
    }
  }, [voidState, fetchRounds])

  if (loading) {
    return (
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-[#e5e1d8] rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6 gap-3">
        <p className="text-warm-gray">{error}</p>
        <button onClick={fetchRounds} className="text-sm text-[#2d5a27] underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      {rounds.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-warm-gray text-sm">No rounds played yet.</p>
        </div>
      ) : (
        rounds.map((group) => (
          <div
            key={group.key}
            className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-2 ${
              group.voided ? 'opacity-60 border-red-200' : 'border-[#e5e1d8]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {formatDate(group.played_at)}
              </span>
              <div className="flex items-center gap-2">
                {group.voided && (
                  <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full line-through">
                    Voided
                  </span>
                )}
                {isCommissioner && !group.voided && (
                  <button
                    onClick={() => setVoidState({ group, reason: '' })}
                    className="text-xs text-red-500 font-semibold border border-red-200 rounded-lg px-2 py-1 min-h-[28px] active:scale-95 transition-transform"
                  >
                    Void
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {group.players.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className={`text-gray-700 ${group.voided ? 'line-through' : ''}`}>{p.display_name}</span>
                  <span className="text-warm-gray font-medium">{formatScore(p.score_to_par)}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {voidState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-900">Void Round</h2>
            <p className="text-warm-gray text-sm">
              This will void the round for all {voidState.group.players.length} player(s) and trigger a standings recalculation.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="void-reason" className="text-sm font-medium text-gray-700">
                Reason <span className="text-warm-gray font-normal">(optional)</span>
              </label>
              <input
                id="void-reason"
                type="text"
                value={voidState.reason}
                onChange={(e) => setVoidState((s) => s ? { ...s, reason: e.target.value } : s)}
                placeholder="e.g. Incorrect scores entered"
                className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
              />
            </div>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setVoidState(null)}
                className="flex-1 py-3 rounded-xl border-2 border-[#e5e1d8] text-gray-700 font-semibold min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidConfirm}
                disabled={voiding}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold min-h-[48px] disabled:opacity-50 active:scale-95 transition-transform"
              >
                {voiding ? 'Voiding…' : 'Void Round'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
