import { useState, useEffect } from 'react'
import {
  fetchRoundSettlement,
  type PostRoundSettlementPair,
} from '../../lib/sideGames/fetchRoundSettlement'

function fmt(amount: number): string {
  if (amount === 0) return '$0'
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`
}

interface Props {
  roundId: string
}

/**
 * Read-only post-round settlement view loaded from Supabase settlement_history.
 * Returns null if no settlement data exists for this round (solo round,
 * unauthenticated, or not yet persisted).
 */
export default function PostRoundSettlementView({ roundId }: Props) {
  const [pairs, setPairs] = useState<PostRoundSettlementPair[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchRoundSettlement(roundId).then((result) => {
      if (!cancelled) {
        setPairs(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [roundId])

  if (loading || !pairs || pairs.length === 0) return null

  // Build a name map for display
  const nameMap = new Map<string, string>()
  for (const pair of pairs) {
    nameMap.set(pair.fromUserId, pair.fromDisplayName)
    nameMap.set(pair.toUserId, pair.toDisplayName)
  }

  const activePairs = pairs.filter((p) => p.amount > 0)
  const allSquare = activePairs.length === 0

  // Compute net gains per player for the winners summary
  const gains: Record<string, number> = {}
  for (const pair of activePairs) {
    gains[pair.toUserId] = (gains[pair.toUserId] ?? 0) + pair.amount
    gains[pair.fromUserId] = (gains[pair.fromUserId] ?? 0) - pair.amount
  }
  const winners = Object.entries(gains)
    .filter(([, amt]) => amt > 0)
    .map(([id, amount]) => ({ id, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-[#2d5a27]">Settlement</h2>
        <p className="text-sm text-[#6b7280]">Net totals across all games</p>
      </div>

      {allSquare ? (
        <div className="rounded-2xl border border-[#e5e1d8] bg-white px-4 py-6 text-center">
          <div className="text-4xl font-black text-[#2d5a27] mb-1">All Square</div>
          <p className="text-sm text-[#6b7280]">No money changes hands — everyone is even.</p>
        </div>
      ) : (
        activePairs.map((pair, i) => (
          <div key={i} className="rounded-2xl border border-[#e5e1d8] bg-white px-4 py-4">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs text-[#6b7280] font-medium truncate">
                {pair.fromDisplayName} owes {pair.toDisplayName}
              </span>
              <span className="text-2xl font-black text-red-600 leading-tight">
                {fmt(pair.amount)}
              </span>
            </div>
          </div>
        ))
      )}

      {/* Winners summary */}
      {!allSquare && winners.length > 0 && (
        <div className="rounded-2xl border border-[#e5e1d8] bg-[#f5f0e8] px-4 py-3">
          <p className="text-xs text-[#6b7280] font-medium uppercase tracking-wide mb-2">
            Winners
          </p>
          <div className="flex flex-col gap-1">
            {winners.map(({ id, amount }) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[#2d5a27]">
                  {nameMap.get(id) ?? id}
                </span>
                <span className="font-bold text-[#2d5a27]">+{fmt(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
