import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useSideGameState } from '../../hooks/useSideGameState'
import { useLeaderboardStore } from '../../store/leaderboardStore'
import { useGroupRoundStore } from '../../store/groupRoundStore'

function fmt(amount: number | null): string {
  if (!amount) return ''
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

export default function SideGamePanel() {
  const [expanded, setExpanded] = useState(false)
  const { skins, nassau, press, stableford, processedHoles } = useSideGameState()
  const players = useLeaderboardStore((s) => s.players)
  const sideGameConfig = useGroupRoundStore((s) => s.sideGameConfig)
  const groupRoundStatus = useGroupRoundStore((s) => s.status)

  // Explicitly disabled — hide panel
  if (sideGameConfig && !sideGameConfig.sideGamesEnabled) return null

  // No group round active — hide panel
  if (groupRoundStatus !== 'active' && groupRoundStatus !== 'completed') {
    if (!sideGameConfig) return null
  }

  // Config not yet received (race window for late-joining guests) — show skeleton
  if (!sideGameConfig) {
    return (
      <div className="mx-4 mt-3 rounded-2xl border border-[#e5e1d8] bg-white shadow-sm overflow-hidden">
        <div className="w-full flex items-center justify-between px-4 py-3 bg-[#2d5a27] text-white">
          <span className="font-semibold text-sm">Side Games · Loading…</span>
        </div>
        <div className="px-4 py-3 flex flex-col gap-2">
          <div className="h-4 w-3/4 rounded bg-[#e5e1d8] animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-[#e5e1d8] animate-pulse" />
        </div>
      </div>
    )
  }

  const lastHole = processedHoles.length > 0 ? processedHoles[processedHoles.length - 1] : 0
  const activeGames = sideGameConfig.gameTypes
  if (activeGames.length === 0) return null

  function playerName(playerId: string): string {
    return players.find((p) => p.playerId === playerId)?.displayName ?? playerId.slice(0, 6)
  }

  function nassauSegmentLabel(standing: Record<string, number>): string {
    const ids = Object.keys(standing)
    if (ids.length === 2) {
      const [a, b] = ids
      const diff = standing[a] - standing[b]
      if (diff === 0) return 'All square'
      const leader = diff > 0 ? a : b
      return `${playerName(leader)} +${Math.abs(diff)}`
    }
    return Object.entries(standing)
      .sort(([, x], [, y]) => y - x)
      .map(([id, wins]) => `${playerName(id)}: ${wins}`)
      .join(' · ')
  }

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-[#e5e1d8] bg-white shadow-sm overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#2d5a27] text-white touch-target"
        aria-expanded={expanded}
      >
        <span className="font-semibold text-sm">
          Side Games{lastHole > 0 ? ` · Thru ${lastHole}` : ' · Not started'}
        </span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {/* Compact summary */}
      {!expanded && (
        <div className="px-4 py-2 flex flex-col gap-1">
          {skins && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-warm-gray w-20 shrink-0">Skins</span>
              <span className="font-medium text-[#1a1a1a]">
                {skins.currentCarry > 1
                  ? `${skins.currentCarry} carry${fmt(skins.potValue) ? ` · ${fmt(skins.potValue)} pot` : ''}`
                  : 'No carry'}
              </span>
            </div>
          )}
          {nassau && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-warm-gray w-20 shrink-0">Nassau</span>
              <span className="font-medium text-[#1a1a1a]">{nassauSegmentLabel(nassau.overallStanding)}</span>
            </div>
          )}
          {stableford && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-warm-gray w-20 shrink-0">Stableford</span>
              <span className="font-medium text-[#1a1a1a]">
                {Object.entries(stableford.totals)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 2)
                  .map(([id, pts]) => `${playerName(id)}: ${pts}`)
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="divide-y divide-[#e5e1d8]">
          {skins && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#2d5a27]">Skins</span>
                <span className="text-xs text-warm-gray">
                  {skins.currentCarry} in carry
                  {skins.potValue > 0 ? ` · ${fmt(skins.potValue)} pot` : ''}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {Object.entries(skins.skinsWon)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([id, entry]) => (
                    <div key={id} className="flex items-center justify-between text-sm">
                      <span className="text-[#1a1a1a]">{playerName(id)}</span>
                      <span className="font-semibold text-[#2d5a27]">
                        {entry.count} skin{entry.count !== 1 ? 's' : ''}
                        {entry.holes.length > 0 ? ` (h${entry.holes.join(', ')})` : ''}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {nassau && (
            <div className="px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-[#2d5a27] block mb-2">Nassau</span>
              <div className="flex flex-col gap-1 text-sm">
                {(
                  [
                    { label: 'Front 9', stake: sideGameConfig.nassauStakeFront, standing: nassau.frontStanding, winner: nassau.frontWinner },
                    { label: 'Back 9', stake: sideGameConfig.nassauStakeBack, standing: nassau.backStanding, winner: nassau.backWinner },
                    { label: 'Overall', stake: sideGameConfig.nassauStakeOverall, standing: nassau.overallStanding, winner: nassau.overallWinner },
                  ] as const
                ).map(({ label, stake, standing, winner }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-warm-gray">
                      {label}{stake ? ` · ${fmt(stake)}` : ''}
                    </span>
                    <span className="font-medium text-[#1a1a1a]">
                      {winner ? `${playerName(winner)} wins` : nassauSegmentLabel(standing)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {press && press.presses.length > 0 && (
            <div className="px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-[#2d5a27] block mb-2">
                Presses ({press.presses.length})
              </span>
              <div className="flex flex-col gap-1 text-sm">
                {press.presses.map((p) => {
                  const pressIds = Object.keys(p.standing)
                  const betLabel =
                    p.parentBet === 'nassau_front' ? 'Front' :
                    p.parentBet === 'nassau_back' ? 'Back' : 'Overall'
                  let standingStr = ''
                  if (pressIds.length === 2) {
                    const [a, b] = pressIds
                    const diff = p.standing[a] - p.standing[b]
                    standingStr = diff === 0 ? 'AS' : `${playerName(diff > 0 ? a : b)} +${Math.abs(diff)}`
                  }
                  return (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-warm-gray">
                        {betLabel} h{p.startHole}–{p.endHole}
                      </span>
                      <span className="font-medium text-[#1a1a1a]">
                        {p.winner ? `${playerName(p.winner)} wins` : standingStr}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {stableford && (
            <div className="px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wide text-[#2d5a27] block mb-2">Stableford</span>
              <div className="flex flex-col gap-1 text-sm">
                {Object.entries(stableford.totals)
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, pts], rank) => (
                    <div key={id} className="flex items-center justify-between">
                      <span className="text-[#1a1a1a]">{rank + 1}. {playerName(id)}</span>
                      <span className="font-semibold text-[#2d5a27]">{pts} pts</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
