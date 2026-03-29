import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { XCircle, RotateCcw } from 'lucide-react'
import { useAppStore } from '../store'
import { calcTotalStrokes } from '../utils/scoring'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useGroupRoundBroadcast } from '../hooks/useGroupRoundBroadcast'
import { useSpectatorCount } from '../hooks/useSpectatorCount'
import ConfirmModal from '../components/ConfirmModal'
import PuttsInput from '../components/PuttsInput'
import PenaltiesInput from '../components/PenaltiesInput'
import FairwayToggle from '../components/FairwayToggle'
import LiveLeaderboard from '../components/LiveLeaderboard'
import SideGamePanel from '../components/group-round/SideGamePanel'
import SettlementScreen from '../components/group-round/SettlementScreen'
import { useSideGameState } from '../hooks/useSideGameState'
import { syncActiveRound, syncRoundToSupabase } from '../lib/sync'
import { lockSideGameConfig as lockSideGameConfigInDb } from '../lib/sideGames/config'

type Tab = 'round' | 'scorecard' | 'leaderboard' | 'sidegames'

function scoreDiff(strokes: number, par: number): string {
  const d = strokes - par
  if (d === 0) return 'E'
  return d > 0 ? `+${d}` : `${d}`
}

function scoreName(strokes: number, par: number): string {
  const d = strokes - par
  if (strokes === 1) return 'Hole-in-one'
  if (d <= -3) return 'Albatross'
  if (d === -2) return 'Eagle'
  if (d === -1) return 'Birdie'
  if (d === 0) return 'Par'
  if (d === 1) return 'Bogey'
  if (d === 2) return 'Double'
  if (d === 3) return 'Triple'
  return `+${d}`
}

function scoreColor(strokes: number, par: number): string {
  const d = strokes - par
  if (strokes === 1 || d <= -2) return 'text-gold font-bold'
  if (d === -1) return 'text-forest-mid font-semibold'
  if (d === 0) return 'text-gray-700'
  if (d === 1) return 'text-orange-600'
  return 'text-red-600 font-semibold'
}

export default function Round() {
  const navigate = useNavigate()
  const { rounds, activeRoundId, addShot, removeShot, removeLastShot, setHolePar, setPutts, setPenalties, setFairwayHit, completeRound, abandonRound } = useAppStore()
  const bag = useAppStore(s => s.clubBag).sort((a, b) => a.order - b.order)
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const userId = useAppStore(s => s.userId)

  const round = rounds.find(r => r.id === activeRoundId)
  const [currentHole, setCurrentHole] = useState<number>(() => {
    const { rounds: rs, activeRoundId: aid } = useAppStore.getState()
    const r = rs.find(x => x.id === aid)
    if (!r) return 1
    let lastActive = 1
    for (const h of r.holes) {
      if (h.shots.length > 0 || (h.putts ?? 0) > 0 || (h.penalties ?? 0) > 0) {
        lastActive = h.number
      }
    }
    return lastActive
  })
  const [activeTab, setActiveTab] = useState<Tab>('round')
  const [showAbandonModal, setShowAbandonModal] = useState(false)

  // ── Group round broadcast ─────────────────────────────────────────────────
  // All hooks must appear before any early returns (Rules of Hooks).
  const groupRound = useGroupRoundStore((s) => s.groupRound)
  const sideGameConfig = useGroupRoundStore((s) => s.sideGameConfig)
  const sideGameConfigLocked = useGroupRoundStore((s) => s.sideGameConfigLocked)
  const lockSideGameConfig = useGroupRoundStore((s) => s.lockSideGameConfig)
  const { processedHoles } = useSideGameState()
  const updateLeaderboard = useLeaderboardStore((s) => s.updateScore)
  const myPlayerId = round?.id ?? ''
  const { broadcastScore, isOffline } = useGroupRoundBroadcast(groupRound?.id ?? null, myPlayerId)
  const spectatorCount = useSpectatorCount(groupRound?.id ?? null)

  // Compute score values with null-safe guards (needed for the effect below).
  const putterIds = new Set(bag.filter(c => c.name.toLowerCase() === 'putter').map(c => c.id))
  const holeForEffect = round?.holes.find(h => h.number === currentHole) ?? null
  const strokesForEffect = holeForEffect ? calcTotalStrokes(holeForEffect, putterIds) : 0

  const prevBroadcastRef = useRef<{ holeNumber: number; strokes: number; putts: number } | null>(null)
  useEffect(() => {
    if (!groupRound || !round || !holeForEffect) return
    const putts = holeForEffect.putts ?? 0
    const prev = prevBroadcastRef.current
    if (
      prev &&
      prev.holeNumber === currentHole &&
      prev.strokes === strokesForEffect &&
      prev.putts === putts
    ) return
    // Don't broadcast until at least 1 shot is logged on this hole
    if (strokesForEffect === 0) return
    prevBroadcastRef.current = { holeNumber: currentHole, strokes: strokesForEffect, putts }
    const delta = {
      playerId: myPlayerId,
      playerName: round.playerName,
      holeNumber: currentHole,
      strokes: strokesForEffect,
      putts,
      par: holeForEffect.par,
      timestamp: new Date().toISOString(),
    }
    updateLeaderboard(delta)
    broadcastScore(delta)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokesForEffect, holeForEffect?.putts, currentHole, groupRound?.id])
  // ─────────────────────────────────────────────────────────────────────────

  // ── Auto-switch to settlement when all holes are processed in a group round
  useEffect(() => {
    if (
      groupRound &&
      sideGameConfig?.sideGamesEnabled &&
      round &&
      processedHoles.length >= round.holeCount
    ) {
      setActiveTab('sidegames')
    }
  // Run once when processedHoles count reaches holeCount; stable round/groupRound refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedHoles.length])
  // ─────────────────────────────────────────────────────────────────────────

  // ── THEA-232: Lock side game config after first score is entered ──────────
  // Derive whether any score has been entered across all holes.
  const anyScoreEntered = round
    ? round.holes.some(
        (h) => h.shots.length > 0 || (h.putts ?? 0) > 0 || (h.penalties ?? 0) > 0,
      )
    : false

  useEffect(() => {
    if (
      groupRound &&
      sideGameConfig?.sideGamesEnabled &&
      anyScoreEntered &&
      !sideGameConfigLocked
    ) {
      lockSideGameConfig()
      // Best-effort DB persist — silently ignore errors (non-critical path)
      void lockSideGameConfigInDb(groupRound.id).catch(() => undefined)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyScoreEntered])
  // ─────────────────────────────────────────────────────────────────────────

  // ── THEA-144 + THEA-146: Active round background persistence ─────────────
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Clear any existing interval first (handles sign-out: userId becomes null)
    if (syncIntervalRef.current !== null) {
      clearInterval(syncIntervalRef.current)
      syncIntervalRef.current = null
    }

    if (!isAuthenticated || !userId || !round || round.completedAt) {
      return
    }

    const roundId = round.id

    // Immediate sync on mount / round change
    void syncActiveRound(roundId, userId)

    // Periodic sync every 5 minutes
    const intervalId = setInterval(() => {
      void syncActiveRound(roundId, userId)
    }, 5 * 60 * 1000)
    syncIntervalRef.current = intervalId

    // Sync on visibility restored (tab/app comes back to foreground)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void syncActiveRound(roundId, userId!)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Best-effort final sync before unload (fire-and-forget)
    function handleBeforeUnload() {
      const currentRound = useAppStore.getState().rounds.find(r => r.id === roundId)
      if (currentRound && userId) {
        // Fire-and-forget — don't await; keep it fast
        void syncRoundToSupabase(currentRound, userId, 'active')
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(intervalId)
      syncIntervalRef.current = null
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, userId, isAuthenticated])
  // ─────────────────────────────────────────────────────────────────────────

  if (!round) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6">
        <p className="text-warm-gray text-lg mb-4">No active round.</p>
        <button
          onClick={() => navigate('/setup')}
          className="bg-forest text-cream px-6 py-3 rounded-xl font-semibold touch-target"
        >
          Start a Round
        </button>
      </main>
    )
  }

  // round is non-null below — compute derived values for rendering.
  const hole = round.holes.find(h => h.number === currentHole)!
  const nonPutterShots = hole.shots.filter(s => !putterIds.has(s.clubId)).length
  const strokes = calcTotalStrokes(hole, putterIds)
  const totalHoles = round.holeCount
  const parLocked = hole.shots.length > 0

  // GIR: derived, never entered directly
  const gir =
    nonPutterShots > 0 && hole.putts !== undefined
      ? nonPutterShots <= hole.par - 2
      : undefined

  // Running totals
  const playedHoles = round.holes.filter(h => h.shots.length > 0)
  const totalStrokes = playedHoles.reduce((sum, h) => sum + calcTotalStrokes(h, putterIds), 0)
  const totalPar = playedHoles.reduce((sum, h) => sum + h.par, 0)
  const runningDiff = totalStrokes - totalPar

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }

  function handleClubTap(clubId: string) {
    if (putterIds.has(clubId)) {
      // Putter tap = increment putt counter (not a shot)
      const current = hole.putts ?? 0
      if (current < 9) setPutts(round!.id, currentHole, current + 1)
      vibrate(40)
    } else {
      addShot(round!.id, currentHole, { clubId, timestamp: Date.now() })
      vibrate(40)
    }
  }

  function handleBadgeTap(e: React.MouseEvent, clubId: string) {
    e.stopPropagation()
    if (putterIds.has(clubId)) {
      // Putter badge tap = decrement putt counter
      const current = hole.putts ?? 0
      if (current > 0) setPutts(round!.id, currentHole, current - 1)
      vibrate([20, 20])
    } else {
      const clubShots = hole.shots
        .map((s, i) => ({ ...s, index: i }))
        .filter(s => s.clubId === clubId)
      if (clubShots.length > 0) {
        removeShot(round!.id, currentHole, clubShots[clubShots.length - 1].index)
        vibrate([20, 20])
      }
    }
  }

  function handlePar(par: number) {
    if (parLocked) return
    setHolePar(round!.id, currentHole, par)
  }

  function handleNext() {
    if (currentHole < totalHoles) setCurrentHole(h => h + 1)
  }

  function handlePrev() {
    if (currentHole > 1) setCurrentHole(h => h - 1)
  }

  function handleUndo() {
    if (hole.shots.length > 0) {
      removeLastShot(round!.id, currentHole)
      vibrate([20, 20])
    } else if ((hole.putts ?? 0) > 0) {
      setPutts(round!.id, currentHole, (hole.putts ?? 0) - 1)
      vibrate([20, 20])
    }
  }

  function handleFinish() {
    completeRound(round!.id)
    navigate(`/summary/${round!.id}`)
  }

  function handleAbandonConfirm() {
    abandonRound(round!.id)
    navigate('/')
  }

  return (
    <main className="flex flex-col flex-1">
      {/* Tab bar */}
      <div className="flex border-b border-cream-dark bg-white">
        <button
          onClick={() => setActiveTab('round')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors touch-target ${
            activeTab === 'round'
              ? 'text-forest border-b-2 border-forest'
              : 'text-warm-gray'
          }`}
        >
          Round
        </button>
        <button
          onClick={() => setActiveTab('scorecard')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors touch-target ${
            activeTab === 'scorecard'
              ? 'text-forest border-b-2 border-forest'
              : 'text-warm-gray'
          }`}
        >
          Scorecard
        </button>
        {groupRound && (
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors touch-target ${
              activeTab === 'leaderboard'
                ? 'text-forest border-b-2 border-forest'
                : 'text-warm-gray'
            }`}
          >
            Leaderboard
          </button>
        )}
        {groupRound && sideGameConfig?.sideGamesEnabled && (
          <button
            onClick={() => setActiveTab('sidegames')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors touch-target ${
              activeTab === 'sidegames'
                ? 'text-forest border-b-2 border-forest'
                : 'text-warm-gray'
            }`}
          >
            Side Games
          </button>
        )}
      </div>

      {activeTab === 'leaderboard' && <LiveLeaderboard spectatorCount={spectatorCount} />}

      {activeTab === 'sidegames' && (
        <div className="flex flex-col flex-1 overflow-y-auto pb-6">
          {round && processedHoles.length >= round.holeCount && sideGameConfig?.sideGamesEnabled ? (
            <SettlementScreen />
          ) : (
            <SideGamePanel />
          )}
        </div>
      )}

      {activeTab === 'round' && (
        <div className={`flex flex-col flex-1 p-4 gap-4${strokes > 0 ? ' pb-28' : ''}`}>
          {/* Offline banner — only shown during group rounds */}
          {groupRound && isOffline && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-amber-800 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              Offline — scores are saved locally and will sync when you reconnect
            </div>
          )}
          {/* Course / Running score banner */}
          <div className="flex items-center justify-between text-sm text-warm-gray">
            <span className="font-medium text-gray-700 truncate">{round.courseName}</span>
            {totalStrokes > 0 && (
              <span className={`font-bold text-base ${runningDiff > 0 ? 'text-red-600' : runningDiff < 0 ? 'text-forest-mid' : 'text-gray-700'}`}>
                {scoreDiff(totalStrokes, totalPar)} ({totalStrokes})
              </span>
            )}
          </div>

          {/* Hole header + navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={currentHole === 1}
              className="touch-target flex items-center justify-center w-12 h-12 rounded-full bg-cream-dark disabled:opacity-30 text-xl font-bold"
            >
              ‹
            </button>
            <div className="flex-1 text-center">
              <div className="text-4xl font-black text-forest">Hole {currentHole}</div>
              <div className="text-warm-gray text-sm mt-0.5">of {totalHoles}</div>
            </div>
            <button
              onClick={handleNext}
              disabled={currentHole === totalHoles}
              className="touch-target flex items-center justify-center w-12 h-12 rounded-full bg-cream-dark disabled:opacity-30 text-xl font-bold"
            >
              ›
            </button>
          </div>

          {/* Par selector */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-warm-gray text-sm">Par:</span>
            {[3, 4, 5].map(p => (
              <button
                key={p}
                onClick={() => handlePar(p)}
                disabled={parLocked}
                className={`w-11 h-11 rounded-full text-sm font-bold border-2 transition-colors touch-target ${
                  hole.par === p
                    ? parLocked
                      ? 'bg-gray-400 text-white border-gray-400'
                      : 'bg-forest text-cream border-forest'
                    : parLocked
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-forest border-cream-dark'
                }`}
              >
                {p}
              </button>
            ))}
            {parLocked && (
              <span className="text-xs text-warm-gray ml-1">locked</span>
            )}
          </div>

          {/* Stroke counter */}
          <div className="relative bg-[#faf7f2] rounded-2xl border border-[#e5e1d8] p-5 h-36 flex flex-col items-center justify-center gap-1 shadow-sm">
            {strokes > 0 && (
              <button
                onClick={handleUndo}
                aria-label="Undo last shot"
                className="absolute top-1 right-1 min-w-[44px] min-h-[44px] flex items-center justify-center gap-1 text-warm-gray hover:text-forest active:scale-95 transition-all px-2"
              >
                <RotateCcw size={16} />
                <span className="text-xs font-medium">Undo</span>
              </button>
            )}
            <div className={`text-6xl font-black leading-none h-16 flex items-center justify-center ${strokes > 0 ? 'text-[#2d5a27]' : 'text-gray-500'}`}>
              {strokes}
            </div>
            <div className={`text-lg font-semibold h-7 flex items-center justify-center text-center ${strokes > 0 ? scoreColor(strokes, hole.par) : 'text-gray-500'}`}>
              {strokes > 0 ? scoreName(strokes, hole.par) : 'Tap a club to start'}
            </div>
          </div>

          {/* Club quick-tap grid */}
          <div>
            <p className="text-xs text-warm-gray uppercase tracking-wide mb-2">Tap club used</p>
            {bag.length === 0 ? (
              <p className="text-warm-gray text-sm">
                Your bag is empty — <Link to="/bag" className="underline text-forest">go to Bag</Link> to add clubs.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 pt-4">
                {bag.map(club => {
                  const clubShots = hole.shots
                    .map((s, i) => ({ ...s, index: i }))
                    .filter(s => s.clubId === club.id)
                  const isPutter = putterIds.has(club.id)
                  // Putter: driven by hole.putts counter, not shots array
                  const putterCount = isPutter ? (hole.putts ?? 0) : 0
                  const isUsed = isPutter ? putterCount > 0 : clubShots.length > 0
                  // Show shot numbers in the overall sequence (e.g. Driver=1, PW=3,4)
                  const shotNums = clubShots.map(s => s.index + 1)
                  // Badge: putter shows putt count; other clubs show last shot sequence number
                  const badgeLabel = isPutter
                    ? (putterCount >= 10 ? '9+' : String(putterCount))
                    : shotNums.length === 0 ? '' : shotNums[shotNums.length - 1] >= 10 ? '9+' : String(shotNums[shotNums.length - 1])
                  return (
                    <button
                      key={club.id}
                      onClick={() => handleClubTap(club.id)}
                      className={`relative h-[52px] w-full rounded-xl text-sm font-semibold border-2 active:scale-95 transition-transform flex items-center justify-center touch-target ${
                        isUsed
                          ? 'bg-[#2d5a27] text-white border-[#2d5a27]'
                          : 'bg-white border-cream-dark text-forest'
                      }`}
                    >
                      {club.name}
                      {isUsed && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleBadgeTap(e, club.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBadgeTap(e as unknown as React.MouseEvent, club.id) }}
                          className="absolute -top-[22px] -right-[22px] w-11 h-11 flex items-center justify-center z-10"
                        >
                          <span className="w-7 h-7 rounded-full bg-white text-[#2d5a27] border-2 border-[#2d5a27] text-xs font-bold shadow-sm flex items-center justify-center active:scale-110 transition-transform">
                            {badgeLabel}
                          </span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Per-hole stats */}
          <div className="bg-white rounded-2xl border border-cream-dark px-4 py-3 flex flex-col gap-3 shadow-sm">
            <PuttsInput
              value={hole.putts}
              onChange={(putts) => setPutts(round!.id, currentHole, putts)}
            />
            <PenaltiesInput
              value={hole.penalties}
              onChange={(penalties) => setPenalties(round!.id, currentHole, penalties)}
            />
            {hole.par >= 4 && (
              <FairwayToggle
                value={hole.fairwayHit}
                onChange={(hit) => setFairwayHit(round!.id, currentHole, hit)}
              />
            )}
            {gir !== undefined && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-warm-gray w-14">GIR</span>
                <span className={`text-sm font-semibold ${gir ? 'text-forest-mid' : 'text-red-600'}`}>
                  {gir ? 'Yes' : 'No'}
                </span>
              </div>
            )}
          </div>

          {/* Footer actions — shown only when sticky bar is not active */}
          <div className="flex flex-col gap-2 mt-auto pt-2">
            {strokes === 0 && (
              <div className="flex gap-3">
                {currentHole === totalHoles ? (
                  <button
                    onClick={handleFinish}
                    className="flex-1 bg-gold text-white py-3 rounded-xl font-bold shadow touch-target"
                  >
                    Finish Round
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-forest text-cream py-3 rounded-xl font-semibold touch-target"
                  >
                    Next Hole →
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowAbandonModal(true)}
              className="flex items-center gap-1.5 text-xs text-[#a89880] min-h-[44px] self-center px-2 hover:underline active:opacity-70 active:scale-95 transition-all"
            >
              <XCircle size={14} />
              Abandon round
            </button>
          </div>
        </div>
      )}

      {/* Sticky action bar — visible when strokes > 0 on the Round tab */}
      {activeTab === 'round' && strokes > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-dark px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center gap-3 shadow-lg z-50">
          <div className="flex flex-col leading-tight flex-1">
            <span className="text-xs text-warm-gray font-medium">Hole {currentHole}</span>
            <span className={`text-base font-bold ${scoreColor(strokes, hole.par)}`}>
              {scoreName(strokes, hole.par)} ({strokes})
            </span>
          </div>
          {currentHole === totalHoles ? (
            <button
              onClick={handleFinish}
              className="bg-gold text-white px-5 py-3 rounded-xl font-bold touch-target shadow"
            >
              Finish Round
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="bg-forest text-cream px-5 py-3 rounded-xl font-semibold touch-target"
            >
              Hole {currentHole + 1} →
            </button>
          )}
        </div>
      )}

      {activeTab === 'scorecard' && (
        <div className="flex flex-col flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-forest">Scorecard</h2>
            <span className="text-sm text-warm-gray">{round.courseName}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-cream-dark bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-forest text-cream">
                  <th className="px-3 py-2 text-left">Hole</th>
                  <th className="px-3 py-2 text-center">Par</th>
                  <th className="px-3 py-2 text-center">Score</th>
                  <th className="px-3 py-2 text-center">+/-</th>
                </tr>
              </thead>
              <tbody>
                {round.holes.map(h => {
                  const s = calcTotalStrokes(h, putterIds)
                  return (
                    <tr
                      key={h.number}
                      className={`border-t border-cream-dark ${h.number === currentHole ? 'bg-forest/10' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium">{h.number}</td>
                      <td className="px-3 py-2 text-center text-warm-gray">{h.par}</td>
                      <td className="px-3 py-2 text-center font-bold">{s > 0 ? s : '—'}</td>
                      <td className={`px-3 py-2 text-center ${s > 0 ? scoreColor(s, h.par) : 'text-warm-gray'}`}>
                        {s > 0 ? scoreDiff(s, h.par) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-forest bg-cream-dark font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-center">{round.holes.slice(0, round.holeCount).reduce((s, h) => s + h.par, 0)}</td>
                  <td className="px-3 py-2 text-center">{totalStrokes || '—'}</td>
                  <td className={`px-3 py-2 text-center ${runningDiff > 0 ? 'text-red-600' : runningDiff < 0 ? 'text-forest-mid' : 'text-gray-700'}`}>
                    {totalStrokes > 0 ? scoreDiff(totalStrokes, totalPar) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-col gap-2 mt-6">
            <button
              onClick={handleFinish}
              className="bg-gold text-white py-4 rounded-xl text-lg font-bold shadow touch-target"
            >
              Finish Round
            </button>
            <button
              type="button"
              onClick={() => setShowAbandonModal(true)}
              className="flex items-center gap-1.5 text-xs text-[#a89880] min-h-[44px] self-center px-2 hover:underline active:opacity-70 active:scale-95 transition-all"
            >
              <XCircle size={14} />
              Abandon round
            </button>
          </div>
        </div>
      )}

      {showAbandonModal && (
        <ConfirmModal
          title="Abandon Round?"
          message="This cannot be undone. The round will not be saved to your history."
          confirmLabel="Abandon"
          cancelLabel="Keep Playing"
          destructive
          onConfirm={handleAbandonConfirm}
          onCancel={() => setShowAbandonModal(false)}
        />
      )}
    </main>
  )
}

