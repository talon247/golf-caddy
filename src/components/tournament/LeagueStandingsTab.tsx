import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { LeagueStanding } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

function formatScore(score: number | null): string {
  if (score === null) return '—'
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : `${score}`
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-warm-gray'
  if (score < 0) return 'text-forest font-semibold'
  if (score === 0) return 'text-gray-700'
  return 'text-red-600'
}

function TrendArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return <span className="text-warm-gray text-xs">—</span>
  if (current < previous) return <span className="text-[#2d5a27] text-sm font-bold" aria-label="moved up">↑</span>
  if (current > previous) return <span className="text-red-500 text-sm font-bold" aria-label="moved down">↓</span>
  return <span className="text-warm-gray text-sm" aria-label="no change">–</span>
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-[#e5e1d8] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

interface Props {
  leagueId: string
}

export default function LeagueStandingsTab({ leagueId }: Props) {
  const [standings, setStandings] = useState<LeagueStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStandings() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await db
          .from('tournament_standings')
          .select('*, profiles(display_name)')
          .eq('tournament_id', leagueId)
          .order('rank', { ascending: true })

        if (err) throw err
        if (!cancelled) {
          const rows: LeagueStanding[] = (data ?? []).map((r: Record<string, unknown>) => ({
            ...(r as Omit<LeagueStanding, 'display_name'>),
            display_name: (r.profiles as { display_name?: string } | null)?.display_name ?? 'Unknown',
            previous_rank: (r.previous_rank as number | null) ?? null,
            points: (r.points as number | null) ?? null,
          }))
          setStandings(rows)
        }
      } catch {
        if (!cancelled) setError('Could not load standings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStandings()

    channelRef.current = supabase
      .channel(`league-standings-${leagueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_standings',
        filter: `tournament_id=eq.${leagueId}`,
      }, () => { fetchStandings() })
      .subscribe()

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [leagueId])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
        <p className="text-warm-gray">{error}</p>
        <button
          onClick={() => setError(null)}
          className="text-sm text-[#2d5a27] underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="overflow-x-auto rounded-xl border border-[#e5e1d8] bg-white shadow-sm">
        <table className="w-full text-sm min-w-[320px]" aria-label="League standings">
          <thead>
            <tr className="bg-[#2d5a27] text-[#f5f0e8]">
              <th scope="col" className="px-3 py-2 text-center w-8">#</th>
              <th scope="col" className="px-3 py-2 text-left">Player</th>
              <th scope="col" className="px-3 py-2 text-center">Rounds</th>
              <th scope="col" className="px-3 py-2 text-center">Score</th>
              <th scope="col" className="px-3 py-2 text-center w-8">Trend</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            ) : standings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-warm-gray text-sm">
                  No standings yet — scores will appear after rounds are played.
                </td>
              </tr>
            ) : (
              standings.map((s) => (
                <tr key={s.user_id} className="border-t border-[#e5e1d8]">
                  <td className="px-3 py-3 text-center font-bold text-warm-gray w-8">{s.rank}</td>
                  <td className="px-3 py-3 font-medium text-gray-800 truncate max-w-[120px]">{s.display_name}</td>
                  <td className="px-3 py-3 text-center text-sm text-warm-gray">{s.rounds_played}</td>
                  <td className={`px-3 py-3 text-center font-bold ${scoreColor(s.score_to_par)}`}>
                    {formatScore(s.score_to_par)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <TrendArrow current={s.rank} previous={s.previous_rank} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && standings.length > 0 && (
        <p className="text-xs text-warm-gray text-center mt-3">Updates live as scores come in</p>
      )}
    </div>
  )
}
