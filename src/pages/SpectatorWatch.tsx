import { useParams, Link } from 'react-router-dom'
import { useSpectatorChannel } from '../hooks/useSpectatorChannel'
import type { PlayerScore } from '../types'

function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E'
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`
}

function scoreColor(scoreToPar: number): string {
  if (scoreToPar < 0) return 'text-[#2d5a27] font-semibold'
  if (scoreToPar === 0) return 'text-gray-700'
  return 'text-red-600'
}

function sortedPlayers(players: PlayerScore[]): PlayerScore[] {
  return [...players].sort((a, b) => {
    if (a.scoreToPar !== b.scoreToPar) return a.scoreToPar - b.scoreToPar
    return b.currentHole - a.currentHole
  })
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className="px-3 py-3"><div className="h-4 w-4 bg-[#e5e1d8] rounded animate-pulse" /></td>
      <td className="px-3 py-3"><div className="h-4 w-28 bg-[#e5e1d8] rounded animate-pulse" /></td>
      <td className="px-3 py-3"><div className="h-4 w-12 bg-[#e5e1d8] rounded animate-pulse" /></td>
      <td className="px-3 py-3"><div className="h-4 w-10 bg-[#e5e1d8] rounded animate-pulse" /></td>
    </tr>
  )
}

function PlayerRow({ player, rank }: { player: PlayerScore; rank: number }) {
  const scoreLabel = formatScoreToPar(player.scoreToPar)
  const color = scoreColor(player.scoreToPar)
  return (
    <tr className="border-t border-[#e5e1d8]">
      <td className="px-3 py-3 font-bold text-gray-500 text-center w-8">{rank}</td>
      <td className="px-3 py-3">
        <span className="font-medium text-gray-800 truncate block max-w-[140px]">
          {player.displayName}
        </span>
      </td>
      <td className="px-3 py-3 text-center text-sm text-gray-500">
        {player.currentHole > 0 ? `Hole ${player.currentHole}` : '—'}
      </td>
      <td className={`px-3 py-3 text-center font-bold text-base ${color}`}>
        {scoreLabel}
      </td>
    </tr>
  )
}

export default function SpectatorWatch() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { roundInfo, players, spectatorCount, isLoading, error } = useSpectatorChannel(
    roomCode ?? '',
  )

  if (!roomCode) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4 text-center">
        <p className="text-gray-600">Invalid spectator link.</p>
        <Link to="/" className="text-[#2d5a27] font-semibold underline">Go home</Link>
      </main>
    )
  }

  if (isLoading) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4">
        <div className="text-4xl animate-pulse">⛳</div>
        <p className="text-gray-500 text-lg font-medium">Loading round…</p>
      </main>
    )
  }

  if (error === 'not_found') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-bold text-gray-800">Round not found</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          This link may have expired or the room code is incorrect.
        </p>
        <Link to="/" className="mt-2 text-[#2d5a27] font-semibold underline">Go home</Link>
      </main>
    )
  }

  if (error === 'spectators_disabled') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold text-gray-800">Spectators not enabled</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          The host hasn't enabled spectator access for this round.
        </p>
        <Link to="/" className="mt-2 text-[#2d5a27] font-semibold underline">Go home</Link>
      </main>
    )
  }

  if (error === 'network') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4 text-center">
        <div className="text-5xl">📡</div>
        <h1 className="text-xl font-bold text-gray-800">Connection error</h1>
        <p className="text-gray-500 text-sm">Check your connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 py-2 px-6 bg-[#2d5a27] text-white rounded-xl font-semibold"
        >
          Retry
        </button>
      </main>
    )
  }

  const ranked = sortedPlayers(players)

  return (
    <main className="flex flex-col flex-1 p-4 pb-20 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-4 pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-[#2d5a27]">
            {roundInfo?.courseName ?? 'Live Round'}
          </h1>
          {spectatorCount > 0 && (
            <span className="text-xs text-gray-500 font-medium">
              {spectatorCount} watching
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2d5a27] bg-[#eaf4e8] rounded-full px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2d5a27] animate-pulse inline-block" />
            Live
          </span>
          {roundInfo?.holeCount && (
            <span className="text-xs text-gray-500">{roundInfo.holeCount} holes</span>
          )}
          <span className="text-xs text-gray-400">Room {roomCode.toUpperCase()}</span>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="overflow-x-auto rounded-xl border border-[#e5e1d8] bg-white shadow-sm">
        <table
          role="table"
          aria-label="Live spectator leaderboard"
          className="w-full text-sm min-w-[320px]"
        >
          <thead>
            <tr className="bg-[#2d5a27] text-[#f5f0e8]">
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
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400 text-sm">
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

      <p className="text-xs text-gray-400 text-center mt-3">
        Updates automatically as scores come in
      </p>

      {/* Download CTA */}
      <div className="mt-6 bg-[#f5f0e8] rounded-2xl border border-[#e5e1d8] p-4 text-center">
        <p className="text-sm font-semibold text-gray-700">Track your own rounds</p>
        <p className="text-xs text-gray-500 mt-0.5">Golf Caddy — free for iOS &amp; Android</p>
      </div>
    </main>
  )
}
