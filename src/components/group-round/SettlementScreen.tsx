import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useSideGameState } from '../../hooks/useSideGameState'
import { useLeaderboardStore } from '../../store/leaderboardStore'
import { useGroupRoundStore } from '../../store/groupRoundStore'
import { aggregateSettlement } from '../../lib/sideGames/settlement'
import type { NetAmount } from '../../lib/sideGames/settlement'

function fmt(amount: number): string {
  if (amount === 0) return '$0'
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

interface PairCardProps {
  net: NetAmount
  playerName: (id: string) => string
}

function PairCard({ net, playerName }: PairCardProps) {
  const [expanded, setExpanded] = useState(false)

  const hasMonetaryBreakdown = net.breakdown.some((e) => e.amount > 0)

  return (
    <div className="rounded-2xl border border-[#e5e1d8] bg-white overflow-hidden">
      {/* Main line */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex flex-col gap-0.5 min-w-0 mr-3">
          <span className="text-xs text-[#6b7280] font-medium truncate">
            {playerName(net.fromPlayerId)} owes {playerName(net.toPlayerId)}
          </span>
          <span className="text-2xl font-black text-red-600 leading-tight">
            {fmt(net.totalAmount)}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-1 text-[#2d5a27]">
          <span className="text-xs font-medium">{expanded ? 'Hide' : 'Details'}</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Breakdown */}
      {expanded && (
        <div className="border-t border-[#e5e1d8] px-4 py-3 flex flex-col gap-2">
          {net.breakdown.map((entry, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[#6b7280]">{entry.description}</span>
              {entry.amount > 0 ? (
                <span className="font-semibold text-[#1a1a1a]">{fmt(entry.amount)}</span>
              ) : (
                <span className="text-xs text-[#6b7280] italic">no stake</span>
              )}
            </div>
          ))}
          {!hasMonetaryBreakdown && (
            <p className="text-xs text-[#6b7280] italic">No monetary stakes — informational only</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Settlement screen shown at the end of a group round with side games.
 * Aggregates all game-engine results into net per-player-pair amounts.
 */
export default function SettlementScreen() {
  const { skins, nassau, press, stableford, processedHoles } = useSideGameState()
  const players = useLeaderboardStore((s) => s.players)
  const sideGameConfig = useGroupRoundStore((s) => s.sideGameConfig)

  if (!sideGameConfig || !sideGameConfig.sideGamesEnabled) return null

  const playerIds = players.map((p) => p.playerId)

  const netAmounts = aggregateSettlement(
    { skins, nassau, press, stableford, processedHoles },
    sideGameConfig,
    playerIds,
  )

  function playerName(id: string): string {
    return players.find((p) => p.playerId === id)?.displayName ?? id.slice(0, 6)
  }

  const allSquare = netAmounts.length === 0

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-[#2d5a27]">Settlement</h2>
        <p className="text-sm text-[#6b7280]">
          {processedHoles.length} hole{processedHoles.length !== 1 ? 's' : ''} · Net totals across all games
        </p>
      </div>

      {allSquare ? (
        <div className="rounded-2xl border border-[#e5e1d8] bg-white px-4 py-6 text-center">
          <div className="text-4xl font-black text-[#2d5a27] mb-1">All Square</div>
          <p className="text-sm text-[#6b7280]">No money changes hands — everyone is even.</p>
        </div>
      ) : (
        <>
          {netAmounts.map((net, i) => (
            <PairCard key={i} net={net} playerName={playerName} />
          ))}
        </>
      )}

      {/* Winning side summary */}
      {!allSquare && (
        <div className="rounded-2xl border border-[#e5e1d8] bg-[#f5f0e8] px-4 py-3">
          <p className="text-xs text-[#6b7280] font-medium uppercase tracking-wide mb-2">Winners</p>
          <div className="flex flex-col gap-1">
            {getWinners(netAmounts, playerName).map(({ id, amount }) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[#2d5a27]">{playerName(id)}</span>
                <span className="font-bold text-[#2d5a27]">+{fmt(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface WinnerSummary {
  id: string
  amount: number
}

function getWinners(nets: NetAmount[], _playerName: (id: string) => string): WinnerSummary[] {
  // Sum net gains per player: toPlayerId gains totalAmount, fromPlayerId loses it
  const gains: Record<string, number> = {}

  for (const net of nets) {
    gains[net.toPlayerId] = (gains[net.toPlayerId] ?? 0) + net.totalAmount
    gains[net.fromPlayerId] = (gains[net.fromPlayerId] ?? 0) - net.totalAmount
  }

  return Object.entries(gains)
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({ id, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
}
