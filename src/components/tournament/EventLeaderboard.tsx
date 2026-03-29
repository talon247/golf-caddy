import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { TournamentStanding } from '../../types'

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

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-[#e5e1d8] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

interface Props {
  tournamentId: string
}

export default function EventLeaderboard({ tournamentId }: Props) {
  const [standings, setStandings] = useState<TournamentStanding[]>([])
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
          .eq('tournament_id', tournamentId)
          .order('rank', { ascending: true })

        if (err) throw err
        if (!cancelled) {
          const rows: TournamentStanding[] = (data ?? []).map((r: Record<string, unknown>) => ({
            ...(r as Omit<TournamentStanding, 'display_name'>),
            display_name: (r.profiles as { display_name?: string } | null)?.display_name ?? 'Unknown',
          }))
          setStandings(rows)
        }
      } catch {
        if (!cancelled) setError('Could not load leaderboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStandings()

    // Realtime: refresh on standings insert/update for this tournament
    channelRef.current = supabase
      .channel(`tournament-standings-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_standings',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => { fetchStandings() })
      .subscribe()

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [tournamentId])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="text-warm-gray">{error}</p>
        <button
          onClick={() => setStandings([])}
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
        <table className="w-full text-sm min-w-[320px]" aria-label="Event leaderboard">
          <thead>
            <tr className="bg-[#2d5a27] text-[#f5f0e8]">
              <th scope="col" className="px-3 py-2 text-center w-8">#</th>
              <th scope="col" className="px-3 py-2 text-left">Player</th>
              <th scope="col" className="px-3 py-2 text-center">Thru</th>
              <th scope="col" className="px-3 py-2 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
            ) : standings.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-warm-gray text-sm">
                  No standings yet — round scores will appear here.
                </td>
              </tr>
            ) : (
              standings.map((s) => (
                <tr key={s.user_id} className="border-t border-[#e5e1d8]">
                  <td className="px-3 py-3 text-center font-bold text-warm-gray w-8">{s.rank}</td>
                  <td className="px-3 py-3 font-medium text-gray-800 truncate max-w-[140px]">{s.display_name}</td>
                  <td className="px-3 py-3 text-center text-sm text-warm-gray">
                    {s.holes_completed !== null ? s.holes_completed : '—'}
                  </td>
                  <td className={`px-3 py-3 text-center font-bold ${scoreColor(s.score_to_par)}`}>
                    {formatScore(s.score_to_par)}
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
