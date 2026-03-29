import type { PlayerScore } from '../types'
import { useLeaderboardStore } from '../store/leaderboardStore'

function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E'
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`
}

function scoreColor(scoreToPar: number): string {
  if (scoreToPar < 0) return 'text-forest-mid font-semibold'
  if (scoreToPar === 0) return 'text-gray-700'
  return 'text-red-600'
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className="px-3 py-3">
        <div className="h-4 w-4 bg-cream-dark rounded animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-4 w-24 bg-cream-dark rounded animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-4 w-12 bg-cream-dark rounded animate-pulse" />
      </td>
      <td className="px-3 py-3">
        <div className="h-4 w-10 bg-cream-dark rounded animate-pulse" />
      </td>
    </tr>
  )
}

function PlayerRow({ player, rank }: { player: PlayerScore; rank: number }) {
  const scoreLabel = formatScoreToPar(player.scoreToPar)
  const color = scoreColor(player.scoreToPar)

  return (
    <tr
      className="border-t border-cream-dark"
      aria-label={`${rank}. ${player.displayName}, hole ${player.currentHole}, ${scoreLabel}`}
    >
      <td className="px-3 py-3 font-bold text-warm-gray text-center w-8" aria-label={`Rank ${rank}`}>
        {rank}
      </td>
      <td className="px-3 py-3">
        <span className="font-medium text-gray-800 truncate block max-w-[140px]">
          {player.displayName}
        </span>
        {!player.isOnline && (
          <span
            className="text-xs text-warm-gray"
            aria-label="offline"
            title="Player is offline"
          >
            ● offline
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-center text-sm text-warm-gray" aria-label={`Hole ${player.currentHole}`}>
        {player.currentHole > 0 ? `Hole ${player.currentHole}` : '—'}
      </td>
      <td className={`px-3 py-3 text-center font-bold text-base ${color}`} aria-label={`Score ${scoreLabel}`}>
        {scoreLabel}
      </td>
    </tr>
  )
}

function sortedPlayers(players: PlayerScore[]): PlayerScore[] {
  return [...players].sort((a, b) => {
    if (a.scoreToPar !== b.scoreToPar) return a.scoreToPar - b.scoreToPar
    // Tie-break: more holes played wins
    return b.currentHole - a.currentHole
  })
}

interface LiveLeaderboardProps {
  spectatorCount?: number
}

export default function LiveLeaderboard({ spectatorCount }: LiveLeaderboardProps = {}) {
  const players = useLeaderboardStore((s) => s.players)
  const isLoading = useLeaderboardStore((s) => s.isLoading)

  const ranked = sortedPlayers(players)

  return (
    <div className="flex flex-col flex-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-forest">Leaderboard</h2>
        <div className="flex items-center gap-2">
          {spectatorCount !== undefined && spectatorCount > 0 && (
            <span className="text-xs text-warm-gray">
              {spectatorCount} watching
            </span>
          )}
          {players.length > 0 && (
            <span className="text-xs text-warm-gray">Live</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white shadow-sm">
        <table
          role="table"
          aria-label="Live group round leaderboard"
          className="w-full text-sm min-w-[320px]"
        >
          <thead>
            <tr className="bg-forest text-cream">
              <th scope="col" className="px-3 py-2 text-center w-8">#</th>
              <th scope="col" className="px-3 py-2 text-left">Player</th>
              <th scope="col" className="px-3 py-2 text-center">Hole</th>
              <th scope="col" className="px-3 py-2 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : ranked.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-warm-gray text-sm"
                >
                  Waiting for players to start scoring…
                </td>
              </tr>
            ) : (
              ranked.map((player, i) => (
                <PlayerRow key={player.playerId} player={player} rank={i + 1} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && players.length > 0 && (
        <p className="text-xs text-warm-gray text-center mt-3">
          Updates automatically as scores come in
        </p>
      )}
    </div>
  )
}
