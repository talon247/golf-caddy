import { useNavigate } from 'react-router-dom'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { useLeaderboardStore } from '../store/leaderboardStore'
import type { PlayerScore } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatScore(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E'
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`
}

function scoreColor(scoreToPar: number): string {
  if (scoreToPar < 0) return 'text-forest font-bold'
  if (scoreToPar === 0) return 'text-gray-700 font-semibold'
  if (scoreToPar <= 2) return 'text-orange-600'
  return 'text-red-600 font-semibold'
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}th`
}

// Best strokes for each hole across all players
function bestPerHole(players: PlayerScore[]): Record<number, { strokes: number; playerName: string }> {
  const best: Record<number, { strokes: number; playerName: string }> = {}
  for (const player of players) {
    for (const [holeStr, data] of Object.entries(player.holes)) {
      const hole = parseInt(holeStr, 10)
      if (!best[hole] || data.strokes < best[hole].strokes) {
        best[hole] = { strokes: data.strokes, playerName: player.displayName }
      }
    }
  }
  return best
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StandingRow({ player, rank }: { player: PlayerScore; rank: number }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${rank === 1 ? 'bg-gold/10 border-2 border-gold' : 'bg-white border border-cream-dark'}`}>
      <span className="w-8 text-center text-lg">{rankLabel(rank)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{player.displayName}</p>
        <p className="text-xs text-warm-gray">{player.totalStrokes} strokes · Hole {player.currentHole}</p>
      </div>
      <span className={`text-xl font-black ${scoreColor(player.scoreToPar)}`}>
        {formatScore(player.scoreToPar)}
      </span>
    </div>
  )
}

function BestPerHoleTable({ players }: { players: PlayerScore[] }) {
  const best = bestPerHole(players)
  const holes = Object.keys(best).map(Number).sort((a, b) => a - b)
  if (holes.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide">
        Best Score Per Hole
      </h2>
      <div className="bg-white border border-cream-dark rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-dark bg-cream">
              <th className="text-left px-4 py-2 font-semibold text-warm-gray">Hole</th>
              <th className="text-center px-4 py-2 font-semibold text-warm-gray">Strokes</th>
              <th className="text-right px-4 py-2 font-semibold text-warm-gray">Player</th>
            </tr>
          </thead>
          <tbody>
            {holes.map((hole, i) => (
              <tr key={hole} className={i < holes.length - 1 ? 'border-b border-cream-dark' : ''}>
                <td className="px-4 py-2 font-medium text-gray-900">#{hole}</td>
                <td className="px-4 py-2 text-center font-bold text-forest">{best[hole].strokes}</td>
                <td className="px-4 py-2 text-right text-warm-gray truncate max-w-[120px]">{best[hole].playerName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function GroupRoundLeaderboard() {
  const navigate = useNavigate()
  const { groupRound, finalStandings, clearGroupRound } = useGroupRoundStore()
  const leaderboardPlayers = useLeaderboardStore(s => s.players)
  const resetLeaderboard = useLeaderboardStore(s => s.reset)

  // Prefer finalStandings from the broadcast payload; fall back to live leaderboard state
  const players: PlayerScore[] = finalStandings ?? leaderboardPlayers

  const sorted = [...players].sort((a, b) => a.scoreToPar - b.scoreToPar)

  function buildShareText(): string {
    const lines = sorted.map((p, i) => `${i + 1}. ${p.displayName}: ${formatScore(p.scoreToPar)} (${p.totalStrokes} strokes)`)
    const code = groupRound?.roomCode ? ` · Room ${groupRound.roomCode}` : ''
    return `⛳ Golf Caddy Group Round Results${code}\n\n${lines.join('\n')}`
  }

  async function handleShare() {
    const text = buildShareText()
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: 'Golf Caddy Round Results', text })
      } catch {
        // User cancelled — ignore
      }
    } else if (nav.clipboard) {
      try {
        await nav.clipboard.writeText(text)
      } catch {
        // Clipboard unavailable — ignore
      }
    }
  }

  function handleDone() {
    clearGroupRound()
    resetLeaderboard()
    navigate('/', { replace: true })
  }

  return (
    <main className="flex flex-col flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-2xl font-black text-forest">Final Standings</h1>
        {groupRound?.roomCode && (
          <p className="text-warm-gray text-sm mt-0.5">Room {groupRound.roomCode}</p>
        )}
      </div>

      {/* Standings */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-warm-gray">
          <p className="text-center">No scores recorded for this round.</p>
          <p className="text-sm text-center">Live scoring requires the score broadcast feature.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide">
            Leaderboard
          </h2>
          {sorted.map((player, i) => (
            <StandingRow key={player.playerId} player={player} rank={i + 1} />
          ))}
        </section>
      )}

      {/* Best per hole */}
      {sorted.length > 0 && <BestPerHoleTable players={sorted} />}

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-3">
        {sorted.length > 0 && (
          <button
            onClick={handleShare}
            className="w-full py-3 rounded-2xl border-2 border-forest text-forest font-semibold touch-target"
          >
            Share Results
          </button>
        )}
        <button
          onClick={handleDone}
          className="w-full py-4 rounded-2xl bg-forest text-cream text-lg font-bold shadow-md touch-target"
        >
          Done
        </button>
      </div>
    </main>
  )
}
