import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { TournamentRound } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

const STATUS_LABELS: Record<TournamentRound['status'], string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const STATUS_COLORS: Record<TournamentRound['status'], string> = {
  not_started: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-[#eaf4e8] text-[#2d5a27]',
}

interface ScorecardDetailProps {
  round: TournamentRound
  onClose: () => void
}

function ScorecardDetail({ round, onClose }: ScorecardDetailProps) {
  const holes = round.hole_scores ?? {}
  const holeNums = Object.keys(holes).map(Number).sort((a, b) => a - b)

  return (
    <div className="mt-3 border-t border-[#e5e1d8] pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">{round.display_name}'s Scorecard</span>
        <button onClick={onClose} className="text-xs text-warm-gray underline">Close</button>
      </div>
      {holeNums.length === 0 ? (
        <p className="text-sm text-warm-gray py-2">No scores recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[280px]">
            <thead>
              <tr className="text-warm-gray">
                <th className="text-left py-1 pr-3 font-medium">Hole</th>
                <th className="text-center py-1 px-2 font-medium">Par</th>
                <th className="text-center py-1 px-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {holeNums.map((h) => {
                const hole = holes[h]
                const diff = hole.strokes - hole.par
                return (
                  <tr key={h} className="border-t border-[#f0ece4]">
                    <td className="py-1 pr-3 text-gray-700">{h}</td>
                    <td className="py-1 px-2 text-center text-warm-gray">{hole.par}</td>
                    <td className={`py-1 px-2 text-center font-semibold ${diff < 0 ? 'text-[#2d5a27]' : diff > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {hole.strokes}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface Props {
  tournamentId: string
}

export default function EventScorecards({ tournamentId }: Props) {
  const [rounds, setRounds] = useState<TournamentRound[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await db
          .from('tournament_rounds')
          .select('*, profiles(display_name)')
          .eq('tournament_id', tournamentId)
          .is('voided_at', null)

        if (err) throw err
        if (!cancelled) {
          const rows: TournamentRound[] = (data ?? []).map((r: Record<string, unknown>) => ({
            ...(r as Omit<TournamentRound, 'display_name'>),
            display_name: (r.profiles as { display_name?: string } | null)?.display_name ?? 'Unknown',
          }))
          setRounds(rows)
        }
      } catch {
        if (!cancelled) setError('Could not load scorecards.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [tournamentId])

  if (loading) {
    return (
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[#e5e1d8] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-warm-gray">{error}</p>
      </div>
    )
  }

  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <p className="text-warm-gray">No rounds submitted yet.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-3">
      {rounds.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-[#e5e1d8] p-4 shadow-sm">
          <button
            className="w-full text-left flex items-center justify-between"
            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            aria-expanded={expandedId === r.id}
          >
            <div>
              <p className="font-semibold text-gray-800">{r.display_name}</p>
              {r.score_to_par !== null && (
                <p className="text-sm text-warm-gray">
                  {r.score_to_par === 0 ? 'E' : r.score_to_par > 0 ? `+${r.score_to_par}` : `${r.score_to_par}`}
                  {r.holes_completed !== null && ` · Thru ${r.holes_completed}`}
                </p>
              )}
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[r.status]}`}>
              {STATUS_LABELS[r.status]}
            </span>
          </button>
          {expandedId === r.id && (
            <ScorecardDetail round={r} onClose={() => setExpandedId(null)} />
          )}
        </div>
      ))}
    </div>
  )
}
