import type { WagerRecord, WagerOutcome } from '../lib/sideGames/history'

interface Props {
  wagers: WagerRecord[]
  netTotal: number
  loading: boolean
  error: string | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function gameTypeLabel(type: string): string {
  const map: Record<string, string> = {
    skins: 'Skins',
    nassau: 'Nassau',
    stableford: 'Stableford',
  }
  return map[type.toLowerCase()] ?? type
}

function OutcomeBadge({ outcome }: { outcome: WagerOutcome }) {
  if (outcome === 'won') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#2d5a27]/10 text-[#2d5a27]">
        Won
      </span>
    )
  }
  if (outcome === 'lost') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">
        Lost
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#e5e1d8] text-[#6b6b6b]">
      Push
    </span>
  )
}

function GameTypePill({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f5f0e8] border border-[#e5e1d8] text-[#1a1a1a]">
      {gameTypeLabel(type)}
    </span>
  )
}

function AmountLabel({ outcome, amount }: { outcome: WagerOutcome; amount: number }) {
  if (outcome === 'push' || amount === 0) {
    return <span className="text-sm font-bold text-[#6b6b6b]">$0</span>
  }
  if (outcome === 'won') {
    return <span className="text-sm font-bold text-[#2d5a27]">+${amount}</span>
  }
  return <span className="text-sm font-bold text-red-500">-${amount}</span>
}

export default function WagerHistoryList({ wagers, netTotal, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3 text-[#6b6b6b]">
          <svg className="animate-spin w-8 h-8 text-[#2d5a27]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-sm">Loading wagers…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-center px-5">
        <div>
          <p className="text-[#6b6b6b] font-semibold">Could not load wager history</p>
          <p className="text-[#6b6b6b] text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (wagers.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-center px-5">
        <div>
          <div className="text-4xl mb-3">🏌️</div>
          <p className="text-[#6b6b6b] font-semibold">No wagers yet</p>
          <p className="text-[#6b6b6b] text-sm mt-1">Start a group round with side games enabled</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Net total summary */}
      <div className="bg-white border border-[#e5e1d8] rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm">
        <span className="text-sm font-semibold text-[#6b6b6b]">Running Net Total</span>
        <span
          className={`text-lg font-black ${
            netTotal > 0 ? 'text-[#2d5a27]' : netTotal < 0 ? 'text-red-500' : 'text-[#1a1a1a]'
          }`}
        >
          {netTotal > 0 ? `+$${netTotal}` : netTotal < 0 ? `-$${Math.abs(netTotal)}` : '$0'}
        </span>
      </div>

      {/* Wager rows */}
      {wagers.map(wager => (
        <div
          key={wager.id}
          className="bg-white border border-[#e5e1d8] rounded-2xl px-4 py-3.5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col min-w-0 gap-1">
              <span className="text-xs font-semibold text-[#6b6b6b]">
                {formatDate(wager.date)}
              </span>
              <span className="font-bold text-sm text-[#1a1a1a] truncate">
                {wager.courseName ?? 'Unknown Course'}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <GameTypePill type={wager.gameType} />
                <OutcomeBadge outcome={wager.outcome} />
              </div>
            </div>
            <div className="shrink-0 pt-1">
              <AmountLabel outcome={wager.outcome} amount={wager.amount} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
