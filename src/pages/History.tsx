import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { fetchRounds } from '../lib/sync'
import { SyncIndicator } from '../components/SyncIndicator'
import type { Round } from '../types'

type HoleFilter = 'all' | '18' | '9'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeScoreVsPar(round: Round): number | null {
  const played = round.holes.filter(h => h.shots.length > 0 || (h.putts ?? 0) > 0)
  if (played.length === 0) return null
  const totalStrokes = played.reduce(
    (s, h) => s + h.shots.length + (h.putts ?? 0) + (h.penalties ?? 0),
    0,
  )
  const totalPar = played.reduce((s, h) => s + h.par, 0)
  return totalStrokes - totalPar
}

function formatVsPar(val: number | null): { label: string; className: string } {
  if (val === null) return { label: '—', className: 'text-gray-400' }
  if (val === 0) return { label: 'E', className: 'text-[#1a1a1a] font-bold' }
  if (val > 0) return { label: `+${val}`, className: 'text-red-500 font-bold' }
  return { label: `${val}`, className: 'text-[#2d5a27] font-bold' }
}

export default function History() {
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const userId = useAppStore(s => s.userId)
  const storeRounds = useAppStore(s => s.rounds)
  const syncStatus = useAppStore(s => s.syncStatus)
  const markRoundPending = useAppStore(s => s.markRoundPending)
  const markRoundSynced = useAppStore(s => s.markRoundSynced)


  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [mergedRounds, setMergedRounds] = useState<Round[]>([])
  const [filter, setFilter] = useState<HoleFilter>('all')
  const [visibleCount, setVisibleCount] = useState<number>(20)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isAuthenticated || !userId) {
        // Guest: just use store rounds
        const completed = storeRounds
          .filter(r => r.completedAt != null)
          .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        setMergedRounds(completed)
        return
      }

      setLoading(true)
      try {
        const cloudRounds = await fetchRounds(userId)
        if (cancelled) return

        // Merge: dedup by id, prefer cloud version
        const cloudMap = new Map<string, Round>(cloudRounds.map(r => [r.id, r]))
        const localOnly = storeRounds.filter(r => !cloudMap.has(r.id))
        const merged = [...cloudRounds, ...localOnly]
          .filter(r => r.completedAt != null)
          .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

        setMergedRounds(merged)
      } catch (err) {
        console.error('[History] fetchRounds failed:', err)
        // Fall back to local store
        const completed = storeRounds
          .filter(r => r.completedAt != null)
          .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        setMergedRounds(completed)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isAuthenticated, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const allCount = mergedRounds.length
  const count18 = mergedRounds.filter(r => r.holeCount === 18).length
  const count9 = mergedRounds.filter(r => r.holeCount === 9).length

  const filteredRounds = mergedRounds.filter(r => {
    if (filter === '18') return r.holeCount === 18
    if (filter === '9') return r.holeCount === 9
    return true
  })

  const visibleRounds = filteredRounds.slice(0, visibleCount)
  const hasMore = visibleCount < filteredRounds.length

  function handleFilterChange(newFilter: HoleFilter) {
    setFilter(newFilter)
    setVisibleCount(20)
  }

  function handleRowTap(round: Round) {
    console.log('[History] tapped round:', round.id)
    navigate(`/summary/${round.id}`)
  }

  function handleRetry(roundId: string) {
    console.log('[History] retry sync for round:', roundId)
    markRoundPending(roundId)
    // The actual sync trigger would be handled by the sync layer
    // Optimistically mark, real retry logic TBD by SE1
    setTimeout(() => {
      // Stub: in real impl, call syncRoundToSupabase then markRoundSynced/markRoundError
      markRoundSynced(roundId)
    }, 1500)
  }

  const filterBtnClass = (active: boolean) =>
    `px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
      active
        ? 'bg-[#2d5a27] text-white border-[#2d5a27]'
        : 'bg-white text-[#2d5a27] border-[#e5e1d8]'
    }`

  return (
    <main className="flex flex-col flex-1 bg-[#f5f0e8] min-h-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/profile" className="text-[#2d5a27] font-semibold text-sm">← Back</Link>
          <h1 className="text-xl font-black text-[#1a1a1a]">Round History</h1>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          <button className={filterBtnClass(filter === 'all')} onClick={() => handleFilterChange('all')}>
            All ({allCount})
          </button>
          <button className={filterBtnClass(filter === '18')} onClick={() => handleFilterChange('18')}>
            18-hole ({count18})
          </button>
          <button className={filterBtnClass(filter === '9')} onClick={() => handleFilterChange('9')}>
            9-hole ({count9})
          </button>
        </div>
      </div>

      {/* Guest banner */}
      {!isAuthenticated && (
        <div className="mx-5 mb-3 bg-[#2d5a27]/10 border border-[#2d5a27]/20 rounded-2xl px-4 py-3">
          <p className="text-sm text-[#2d5a27] font-semibold text-center">
            Sign in to access your full history across devices
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-y-auto px-5 pb-6 gap-2">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-[#6b6b6b]">
              <svg className="animate-spin w-8 h-8 text-[#2d5a27]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-sm">Loading rounds…</span>
            </div>
          </div>
        ) : filteredRounds.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16 text-center">
            <div>
              <div className="text-4xl mb-3">⛳</div>
              <p className="text-[#6b6b6b] font-semibold">No rounds yet.</p>
              <p className="text-[#6b6b6b] text-sm mt-1">Start your first round!</p>
              <Link
                to="/setup"
                className="inline-block mt-4 bg-[#2d5a27] text-white rounded-xl px-6 py-3 font-bold text-sm active:scale-95 transition-transform"
              >
                New Round
              </Link>
            </div>
          </div>
        ) : (
          <>
            {visibleRounds.map(round => {
              const vsParResult = computeScoreVsPar(round)
              const { label: vsParLabel, className: vsParClass } = formatVsPar(vsParResult)
              const status = syncStatus[round.id] ?? 'local'
              const teeLabel = round.teeSet ?? round.tees

              return (
                <button
                  key={round.id}
                  onClick={() => handleRowTap(round)}
                  className="w-full text-left bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-[#e5e1d8] active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: date + course */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[#6b6b6b] mb-0.5">
                        {formatDate(round.completedAt ?? round.startedAt)}
                      </span>
                      <span className="text-[#1a1a1a] font-bold text-sm truncate">
                        {round.courseName}
                      </span>
                      <span className="text-xs text-[#6b6b6b] mt-0.5">
                        {round.holeCount}H · {teeLabel}
                      </span>
                    </div>

                    {/* Right: score + sync */}
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className={`text-lg ${vsParClass}`}>{vsParLabel}</span>
                      <SyncIndicator
                        status={status}
                        onRetry={status === 'error' ? () => handleRetry(round.id) : undefined}
                      />
                    </div>
                  </div>
                </button>
              )
            })}

            {hasMore && (
              <button
                onClick={() => setVisibleCount(c => c + 20)}
                className="w-full py-3 text-[#2d5a27] font-semibold text-sm border border-[#e5e1d8] rounded-2xl bg-white active:scale-[0.98] transition-transform mt-1"
              >
                Load more ({filteredRounds.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
