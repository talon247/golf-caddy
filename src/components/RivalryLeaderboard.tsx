import type { RivalryState, RivalryPlayer } from '../hooks/useRivalryLeaderboard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDiff(diff: number | null): string {
  if (diff === null) return '—'
  return diff.toFixed(1)
}

function formatScoreToPar(s: number): string {
  if (s === 0) return 'E'
  return s > 0 ? `+${s}` : `${s}`
}

function scoreColor(s: number): string {
  if (s < 0) return 'text-[#2d5a27] font-bold'
  if (s === 0) return 'text-gray-700'
  return 'text-red-600 font-bold'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlayerHeader({
  player,
  isLeading,
  isMe,
}: {
  player: RivalryPlayer
  isLeading: boolean
  isMe: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 p-3 rounded-2xl ${
        isLeading ? 'bg-[#2d5a27]/10 border-2 border-[#2d5a27]' : 'bg-white border border-[#e5e1d8]'
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {isMe ? 'You' : 'Rival'}
      </span>
      <span className="text-base font-bold text-[#1a1a1a] truncate max-w-[120px] text-center">
        {player.displayName}
      </span>
      {player.courseName && (
        <span className="text-xs text-gray-500 truncate max-w-[130px] text-center">
          {player.courseName}
        </span>
      )}
      {(player.courseRating !== null || player.slopeRating !== null) && (
        <span className="text-[11px] text-gray-400">
          {player.courseRating !== null ? `Rating ${player.courseRating}` : ''}
          {player.courseRating !== null && player.slopeRating !== null ? ' · ' : ''}
          {player.slopeRating !== null ? `Slope ${player.slopeRating}` : ''}
        </span>
      )}
      <div className={`text-3xl font-black mt-1 ${scoreColor(player.scoreToPar)}`}>
        {formatScoreToPar(player.scoreToPar)}
      </div>
      <div className="text-xs text-gray-500">
        Thru {player.holesCompleted === 0 ? '—' : player.holesCompleted}
      </div>
      <div
        className="text-xs text-gray-400 mt-0.5"
        title="Adjusted for course difficulty (WHS differential formula)"
      >
        Diff: {formatDiff(player.projectedDifferential)}
        <span
          className="ml-1 cursor-help text-[10px] text-gray-400 underline decoration-dotted"
          title="Differential = (Gross − Course Rating) × 113 ÷ Slope. Lower is better."
        >
          ?
        </span>
      </div>
      {isLeading && (
        <span className="text-[11px] font-semibold text-[#2d5a27] mt-0.5">Leading ▲</span>
      )}
    </div>
  )
}

function GapBadge({ gap }: { gap: number }) {
  if (gap === 0) {
    return <div className="text-center text-sm font-semibold text-gray-600">Tied</div>
  }
  return (
    <div className="text-center text-sm font-bold text-[#2d5a27]">
      Gap: {gap > 0 ? '+' : ''}{gap}
    </div>
  )
}

function HoleByHoleTable({
  holeCount,
  challenger,
  opponent,
}: {
  holeCount: number
  challenger: RivalryPlayer
  opponent: RivalryPlayer
}) {
  const holes = Array.from({ length: holeCount }, (_, i) => i + 1)

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#f5f0e8]">
            <td className="px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-[#f5f0e8] min-w-[100px]">
              Player
            </td>
            {holes.map((h) => (
              <td key={h} className="px-2 py-2 text-center font-semibold text-gray-500 min-w-[36px]">
                {h}
              </td>
            ))}
            <td className="px-3 py-2 text-center font-bold text-gray-700">Total</td>
          </tr>
        </thead>
        <tbody>
          <HoleRow player={challenger} holeCount={holeCount} />
          <HoleRow player={opponent} holeCount={holeCount} />
        </tbody>
      </table>
    </div>
  )
}

function HoleRow({ player, holeCount }: { player: RivalryPlayer; holeCount: number }) {
  const holes = Array.from({ length: holeCount }, (_, i) => i + 1)
  const totalGross = Object.values(player.holeScores).reduce((s, h) => s + h.gross, 0)

  return (
    <tr className="border-t border-[#e5e1d8]">
      <td className="px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white truncate max-w-[100px]">
        {player.displayName}
      </td>
      {holes.map((h) => {
        const entry = player.holeScores[h]
        if (!entry) {
          return (
            <td key={h} className="px-2 py-2 text-center text-gray-300">
              —
            </td>
          )
        }
        const diff = entry.gross - entry.par
        return (
          <td key={h} className={`px-2 py-2 text-center font-semibold ${scoreColor(diff)}`}>
            {entry.gross}
          </td>
        )
      })}
      <td className="px-3 py-2 text-center font-bold text-gray-800">
        {totalGross === 0 ? '—' : totalGross}
      </td>
    </tr>
  )
}

// ── States ────────────────────────────────────────────────────────────────────

function WaitingState({ rivalry }: { rivalry: RivalryState }) {
  const waitingFor =
    rivalry.challenger.holesCompleted === 0 && rivalry.opponent.holesCompleted === 0
      ? 'Both players'
      : rivalry.challenger.holesCompleted === 0
        ? rivalry.challenger.displayName
        : rivalry.opponent.displayName

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="text-4xl">⏳</div>
      <p className="text-gray-600 font-medium">Waiting for {waitingFor} to tee off</p>
      <p className="text-xs text-gray-400">
        Live scores will appear as holes are completed
      </p>
    </div>
  )
}

function CompletedState({
  winner,
  loser,
  gap,
}: {
  winner: RivalryPlayer
  loser: RivalryPlayer
  gap: number
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center bg-[#2d5a27]/5 rounded-2xl">
      <div className="text-3xl">🏆</div>
      <p className="text-lg font-bold text-[#1a1a1a]">{winner.displayName} wins!</p>
      <p className="text-sm text-gray-600">
        {formatScoreToPar(winner.scoreToPar)} vs {formatScoreToPar(loser.scoreToPar)} ({gap > 0 ? `+${gap}` : gap} strokes)
      </p>
    </div>
  )
}

function IncompleteState() {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <div className="text-3xl">⏰</div>
      <p className="text-gray-600 font-medium">Rivalry expired — no winner declared</p>
      <p className="text-xs text-gray-400">One or both players did not complete their round in time</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  rivalry: RivalryState
  /** Current user's ID to label "You" vs "Rival" */
  currentUserId?: string | null
}

export function RivalryLeaderboard({ rivalry, currentUserId }: Props) {
  const { challenger, opponent } = rivalry

  const challengerIsMe = currentUserId === challenger.userId
  const opponentIsMe = currentUserId === opponent.userId

  const scoreDiff = challenger.scoreToPar - opponent.scoreToPar
  // Negative scoreDiff = challenger is leading (lower score to par wins)
  const challengerLeading = scoreDiff < 0
  const opponentLeading = scoreDiff > 0
  const tied = scoreDiff === 0

  const gap = Math.abs(scoreDiff)

  const winner =
    rivalry.status === 'completed'
      ? challengerLeading
        ? challenger
        : opponentLeading
          ? opponent
          : null
      : null
  const loser = winner
    ? winner.userId === challenger.userId
      ? opponent
      : challenger
    : null

  const bothStarted =
    challenger.holesCompleted > 0 || opponent.holesCompleted > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Status banner */}
      {rivalry.status === 'completed' && winner && loser && (
        <CompletedState winner={winner} loser={loser} gap={gap} />
      )}
      {rivalry.status === 'completed' && !winner && (
        <div className="text-center py-3 rounded-2xl bg-gray-50 text-gray-600 font-medium">
          Round complete — it's a tie!
        </div>
      )}
      {rivalry.status === 'incomplete' && <IncompleteState />}

      {/* Head-to-head cards */}
      {rivalry.status !== 'incomplete' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <PlayerHeader
              player={challenger}
              isLeading={challengerLeading && bothStarted}
              isMe={challengerIsMe}
            />
            <PlayerHeader
              player={opponent}
              isLeading={opponentLeading && bothStarted}
              isMe={opponentIsMe}
            />
          </div>

          {bothStarted && (
            <div className="text-center">
              {tied ? (
                <GapBadge gap={0} />
              ) : (
                <GapBadge gap={challengerLeading ? -gap : gap} />
              )}
            </div>
          )}

          {/* Waiting overlay */}
          {rivalry.status === 'waiting' && <WaitingState rivalry={rivalry} />}
        </>
      )}

      {/* Per-hole breakdown */}
      {bothStarted && (
        <div className="mt-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">Hole-by-hole</h3>
          <HoleByHoleTable
            holeCount={rivalry.holeCount}
            challenger={challenger}
            opponent={opponent}
          />
        </div>
      )}
    </div>
  )
}
