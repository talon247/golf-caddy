import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store'
import { fetchSettlementHistory } from '../lib/sideGames/history'
import type { FriendRivalry } from '../lib/sideGames/history'

function formatAmount(amount: number): string {
  const abs = Math.abs(amount)
  return `$${abs.toFixed(2)}`
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function BalanceBadge({ amount }: { amount: number }) {
  if (amount === 0) {
    return (
      <span className="text-sm font-semibold text-gray-500">Even</span>
    )
  }
  const positive = amount > 0
  return (
    <span
      className={`text-sm font-bold tabular-nums ${
        positive ? 'text-[#2d5a27]' : 'text-red-600'
      }`}
    >
      {positive ? '+' : '-'}{formatAmount(amount)}
    </span>
  )
}

function RivalryCard({ rivalry }: { rivalry: FriendRivalry }) {
  const [expanded, setExpanded] = useState(false)
  const initials = rivalry.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left min-h-[64px]"
      >
        <div className="w-10 h-10 rounded-full bg-[#2d5a27] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1a1a1a] truncate">{rivalry.displayName}</p>
          <p className="text-xs text-[#6b6b6b]">
            {rivalry.roundsPlayed} round{rivalry.roundsPlayed !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <BalanceBadge amount={rivalry.netBalance} />
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#e5e1d8] divide-y divide-[#f0ece4]">
          {rivalry.rounds.map((round) => (
            <div key={round.roundId} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-sm font-medium text-[#1a1a1a] truncate">
                  {round.courseName ?? 'Group Round'}
                </p>
                <p className="text-xs text-[#6b6b6b]">{formatDate(round.date)}</p>
              </div>
              <BalanceBadge amount={round.netAmount} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SettlementHistory() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusFriendId = searchParams.get('friend')

  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const userId = useAppStore((s) => s.userId)

  const [rivalries, setRivalries] = useState<FriendRivalry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    fetchSettlementHistory(userId)
      .then((data) => {
        // If deep-linking to a specific friend, sort them to the top
        if (focusFriendId) {
          const idx = data.findIndex((r) => r.userId === focusFriendId)
          if (idx > 0) {
            const [target] = data.splice(idx, 1)
            data.unshift(target)
          }
        }
        setRivalries(data)
      })
      .catch(() => setError('Failed to load settlement history.'))
      .finally(() => setLoading(false))
  }, [isAuthenticated, userId, focusFriendId])

  if (!isAuthenticated) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="text-[#1a1a1a] font-semibold text-lg mb-2">Sign in to view rivalry history</p>
        <p className="text-[#6b6b6b] text-sm">Settlement records are only available for signed-in players.</p>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col pb-24">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-[#2d5a27] font-semibold touch-target"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Rivalry History</h1>
      </div>

      <div className="px-4 flex flex-col gap-3">
        {loading && (
          <div className="flex items-center justify-center py-16 text-[#6b6b6b] text-sm">
            Loading…
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && rivalries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[#1a1a1a] font-semibold">No settlement records yet</p>
            <p className="text-[#6b6b6b] text-sm mt-1">
              Play side games with friends to build a rivalry record.
            </p>
          </div>
        )}

        {!loading && !error && rivalries.map((rivalry) => (
          <RivalryCard key={rivalry.userId} rivalry={rivalry} />
        ))}
      </div>
    </main>
  )
}
