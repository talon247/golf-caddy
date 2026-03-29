import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { fetchRounds, syncRoundToSupabase } from '../lib/sync'
import { addToQueue } from '../lib/syncQueue'
import { SyncIndicator } from '../components/SyncIndicator'
import ConfirmModal from '../components/ConfirmModal'
import type { Round } from '../types'

type HoleFilter = 'all' | '18' | '9'

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className ?? 'w-4 h-4'}
      aria-label="Locked round"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeScoreVsPar(round: Round): number | null {
  const played = round.holes.slice(0, round.holeCount).filter(h => h.shots.length > 0 || (h.putts ?? 0) > 0)
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
  const markRoundError = useAppStore(s => s.markRoundError)

  const navigate = useNavigate()

  const PAGE_SIZE = 50

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [mergedRounds, setMergedRounds] = useState<Round[]>([])
  const [filter, setFilter] = useState<HoleFilter>('all')
  const [cloudOffset, setCloudOffset] = useState(0)
  const [hasMoreCloud, setHasMoreCloud] = useState(false)
  const [lockedModalOpen, setLockedModalOpen] = useState(false)
  const [showBatchClear, setShowBatchClear] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const deleteRound = useAppStore(s => s.deleteRound)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isAuthenticated || !userId) {
        // Guest: just use store rounds
        const completed = storeRounds
          .filter(r => r.completedAt != null)
          .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        setMergedRounds(completed)
        setHasMoreCloud(false)
        return
      }

      setLoading(true)
      try {
        const cloudRounds = await fetchRounds(userId, { limit: PAGE_SIZE, offset: 0 })
        if (cancelled) return

        setCloudOffset(PAGE_SIZE)
        setHasMoreCloud(cloudRounds.length === PAGE_SIZE)

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
        setHasMoreCloud(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isAuthenticated, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadMore() {
    if (!userId || loadingMore || !hasMoreCloud) return
    setLoadingMore(true)
    try {
      const nextPage = await fetchRounds(userId, { limit: PAGE_SIZE, offset: cloudOffset })
      setCloudOffset(prev => prev + PAGE_SIZE)
      setHasMoreCloud(nextPage.length === PAGE_SIZE)
      setMergedRounds(prev => {
        const existingIds = new Set(prev.map(r => r.id))
        const newRounds = nextPage.filter(r => !existingIds.has(r.id) && r.completedAt != null)
        return [...prev, ...newRounds].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      })
    } catch (err) {
      console.error('[History] loadMore failed:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const allCount = mergedRounds.length
  const count18 = mergedRounds.filter(r => r.holeCount === 18).length
  const count9 = mergedRounds.filter(r => r.holeCount === 9).length

  const filteredRounds = mergedRounds.filter(r => {
    if (filter === '18') return r.holeCount === 18
    if (filter === '9') return r.holeCount === 9
    return true
  })

  function handleFilterChange(newFilter: HoleFilter) {
    setFilter(newFilter)
  }

  function handleRowTap(round: Round) {
    if (isEditMode) return
    navigate(`/summary/${round.id}`, { state: { round } })
  }

  async function handleRetry(roundId: string) {
    if (!userId) return
    const round = mergedRounds.find(r => r.id === roundId)
    if (!round) return
    markRoundPending(roundId)
    try {
      const result = await syncRoundToSupabase(round, userId, 'completed')
      if (result.success) {
        markRoundSynced(roundId)
      } else {
        markRoundError(roundId)
        addToQueue(roundId)
      }
    } catch {
      markRoundError(roundId)
      addToQueue(roundId)
    }
  }

  function handleEditToggle() {
    if (isEditMode) {
      // Cancel — discard pending deletes
      setPendingDeleteIds(new Set())
      setIsEditMode(false)
    } else {
      setIsEditMode(true)
    }
  }

  function handleMinusTap(round: Round) {
    if (round.isLocked) {
      setLockedModalOpen(true)
      return
    }
    setPendingDeleteIds(prev => {
      const next = new Set(prev)
      if (next.has(round.id)) {
        next.delete(round.id)
      } else {
        next.add(round.id)
      }
      return next
    })
  }

  function handleSave() {
    if (pendingDeleteIds.size === 0) {
      setIsEditMode(false)
      return
    }
    setShowSaveConfirm(true)
  }

  function confirmSave() {
    for (const id of pendingDeleteIds) {
      deleteRound(id)
    }
    setMergedRounds(prev => prev.filter(r => !pendingDeleteIds.has(r.id)))
    setPendingDeleteIds(new Set())
    setIsEditMode(false)
    setShowSaveConfirm(false)
  }

  // Identify local-only rounds (not synced to cloud)
  const localOnlyRounds = mergedRounds.filter(r => {
    const status = syncStatus[r.id]
    return !status || status === 'local'
  })

  function handleBatchClearConfirm() {
    const localRoundIds = localOnlyRounds.map(r => r.id)
    setMergedRounds(prev => prev.filter(r => !localRoundIds.includes(r.id)))
    for (const id of localRoundIds) {
      deleteRound(id)
    }
    setShowBatchClear(false)
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
          <h1 className="text-xl font-black text-[#1a1a1a] flex-1">Round History</h1>
          {!loading && mergedRounds.length > 0 && (
            <button
              onClick={handleEditToggle}
              className={`text-sm font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                isEditMode
                  ? 'text-[#6b6b6b] border-[#e5e1d8] bg-white'
                  : 'text-[#2d5a27] border-[#2d5a27] bg-transparent'
              }`}
            >
              {isEditMode ? 'Cancel' : 'Edit'}
            </button>
          )}
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

      {/* Batch clear button for local-only rounds */}
      {localOnlyRounds.length > 0 && !loading && !isEditMode && (
        <div className="px-5 mb-3">
          <button
            onClick={() => setShowBatchClear(true)}
            className="w-full py-2.5 text-red-600 font-semibold text-sm border border-red-200 rounded-2xl bg-red-50 active:scale-[0.98] transition-transform"
          >
            Clear Local Rounds ({localOnlyRounds.length})
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-y-auto px-5 pb-20 gap-2">
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
            {filteredRounds.map(round => {
              const vsParResult = computeScoreVsPar(round)
              const { label: vsParLabel, className: vsParClass } = formatVsPar(vsParResult)
              const status = syncStatus[round.id] ?? 'local'
              const teeLabel = round.teeSet ?? round.tees
              const locked = round.isLocked === true
              const markedForDelete = pendingDeleteIds.has(round.id)

              return (
                <div key={round.id} className="flex items-center gap-2">
                  {/* Edit mode: minus button */}
                  {isEditMode && (
                    <button
                      onClick={() => handleMinusTap(round)}
                      aria-label={locked ? 'Round is locked' : markedForDelete ? 'Unmark for deletion' : 'Mark for deletion'}
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        locked
                          ? 'bg-[#e5e1d8] text-[#aaa] cursor-default'
                          : markedForDelete
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {locked ? (
                        <LockIcon className="w-4 h-4" />
                      ) : (
                        <span className="text-xl leading-none pb-0.5">−</span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleRowTap(round)}
                    disabled={isEditMode}
                    className={`flex-1 text-left rounded-2xl px-4 py-3.5 shadow-sm border transition-all ${
                      locked
                        ? 'bg-[#f5f0e8] border-[#d5d0c8] opacity-90'
                        : markedForDelete
                          ? 'bg-red-50 border-red-300 opacity-70'
                          : 'bg-white border-[#e5e1d8] active:scale-[0.98]'
                    } ${isEditMode ? 'cursor-default' : 'transition-transform'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: date + course + lock */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-[#6b6b6b]">
                            {formatDate(round.completedAt ?? round.startedAt)}
                          </span>
                          {locked && (
                            <LockIcon className="w-3.5 h-3.5 text-[#6b6b6b]" />
                          )}
                        </div>
                        <span className={`font-bold text-sm truncate ${markedForDelete ? 'line-through text-[#6b6b6b]' : 'text-[#1a1a1a]'}`}>
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
                          onRetry={status === 'error' && !isEditMode ? () => handleRetry(round.id) : undefined}
                        />
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}

            {hasMoreCloud && !isEditMode && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 text-[#2d5a27] font-semibold text-sm border border-[#e5e1d8] rounded-2xl bg-white active:scale-[0.98] transition-transform mt-1 disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Edit mode save bar */}
      {isEditMode && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e5e1d8] px-5 py-4 flex gap-3">
          <button
            onClick={handleEditToggle}
            className="flex-1 border border-[#e5e1d8] text-[#6b6b6b] rounded-xl py-3 font-semibold text-base min-h-[48px] active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 rounded-xl py-3 font-bold text-base min-h-[48px] active:scale-95 transition-transform ${
              pendingDeleteIds.size > 0
                ? 'bg-red-600 text-white'
                : 'bg-[#2d5a27] text-white'
            }`}
          >
            {pendingDeleteIds.size > 0 ? `Delete (${pendingDeleteIds.size})` : 'Done'}
          </button>
        </div>
      )}

      {/* Locked round info modal */}
      {lockedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <LockIcon className="w-5 h-5 text-[#2d5a27]" />
              <h2 className="text-lg font-bold text-[#1a1a1a]">Round Locked</h2>
            </div>
            <p className="text-[#6b6b6b] text-sm leading-relaxed">
              This round is part of a group match and cannot be deleted. Contact the match organizer to dispute results.
            </p>
            <button
              onClick={() => setLockedModalOpen(false)}
              className="w-full bg-[#2d5a27] text-white rounded-xl py-3 font-bold text-base min-h-[48px] active:scale-95 transition-transform"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Save confirmation modal */}
      {showSaveConfirm && (
        <ConfirmModal
          title="Delete Rounds"
          message={`Delete ${pendingDeleteIds.size} round${pendingDeleteIds.size === 1 ? '' : 's'}? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onConfirm={confirmSave}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}

      {/* Batch clear confirmation modal */}
      {showBatchClear && (
        <ConfirmModal
          title="Clear Local Rounds"
          message={`Delete ${localOnlyRounds.length} local-only round${localOnlyRounds.length === 1 ? '' : 's'}? This cannot be undone.`}
          confirmLabel="Clear All"
          cancelLabel="Cancel"
          destructive
          onConfirm={handleBatchClearConfirm}
          onCancel={() => setShowBatchClear(false)}
        />
      )}
    </main>
  )
}
