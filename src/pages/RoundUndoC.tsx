import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { XCircle, ChevronDown, X } from 'lucide-react'
import { useAppStore } from '../store'
import ConfirmModal from '../components/ConfirmModal'
import PuttsInput from '../components/PuttsInput'
import FairwayToggle from '../components/FairwayToggle'

type Tab = 'round' | 'scorecard'

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

export default function RoundUndoC() {
  const navigate = useNavigate()
  const { rounds, activeRoundId, addShot, removeShot, setHolePar, setPutts, setFairwayHit, completeRound, abandonRound } = useAppStore()
  const bag = useAppStore(s => s.clubBag).sort((a, b) => a.order - b.order)

  const round = rounds.find(r => r.id === activeRoundId)
  const [currentHole, setCurrentHole] = useState(1)
  const [activeTab, setActiveTab] = useState<Tab>('round')
  const [showAbandonModal, setShowAbandonModal] = useState(false)
  const [trayOpen, setTrayOpen] = useState(false)

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

  const hole = round.holes.find(h => h.number === currentHole)!
  const putterIds = new Set(bag.filter(c => c.name.toLowerCase() === 'putter').map(c => c.id))
  const nonPutterShots = hole.shots.filter(s => !putterIds.has(s.clubId)).length
  const strokes = nonPutterShots + (hole.putts ?? 0) + (hole.penalties ?? 0)
  const totalHoles = round.holeCount
  const parLocked = hole.shots.length > 0

  const gir =
    nonPutterShots > 0 && hole.putts !== undefined
      ? nonPutterShots <= hole.par - 2
      : undefined

  const playedHoles = round.holes.filter(h => h.shots.length > 0)
  const totalStrokes = playedHoles.reduce((sum, h) => sum + h.shots.filter(s => !putterIds.has(s.clubId)).length + (h.putts ?? 0) + (h.penalties ?? 0), 0)
  const totalPar = playedHoles.reduce((sum, h) => sum + h.par, 0)
  const runningDiff = totalStrokes - totalPar

  const hasShots = hole.shots.length > 0

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }

  function handleClubTap(clubId: string) {
    if (putterIds.has(clubId)) {
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

  function handleRemoveShotAtIndex(index: number) {
    removeShot(round!.id, currentHole, index)
    vibrate([20, 20])
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

  function handleFinish() {
    completeRound(round!.id)
    navigate(`/summary/${round!.id}`)
  }

  function handleAbandonConfirm() {
    abandonRound(round!.id)
    navigate('/')
  }

  function getClubInitials(clubId: string): string {
    const club = bag.find(c => c.id === clubId)
    if (!club) return '??'
    return club.name.slice(0, 2)
  }

  function getClubName(clubId: string): string {
    const club = bag.find(c => c.id === clubId)
    return club?.name ?? 'Unknown'
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
      </div>

      {activeTab === 'round' ? (
        <div className="flex flex-col flex-1 p-4 gap-4">
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
                className={`w-10 h-10 rounded-full text-sm font-bold border-2 transition-colors touch-target ${
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

          {/* Score box + slide-out tray */}
          <div>
            {/* Score box */}
            <div className="relative bg-[#faf7f2] rounded-2xl border border-[#e5e1d8] p-5 h-36 flex flex-col items-center justify-center gap-1 shadow-sm">
              <div className={`text-6xl font-black leading-none h-16 flex items-center justify-center ${strokes > 0 ? 'text-[#2d5a27]' : 'text-gray-500'}`}>
                {strokes}
              </div>
              <div className={`text-lg font-semibold h-7 flex items-center justify-center text-center ${strokes > 0 ? scoreColor(strokes, hole.par) : 'text-gray-400'}`}>
                {strokes > 0 ? scoreName(strokes, hole.par) : 'Tap a club to start'}
              </div>

              {/* Pull-tab handle */}
              <button
                onClick={() => hasShots && setTrayOpen(o => !o)}
                aria-label={trayOpen ? 'Hide shot history' : 'Show shot history'}
                className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 min-h-[44px] min-w-[80px] justify-end pb-1 transition-opacity ${
                  hasShots ? 'opacity-60 hover:opacity-90' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div className="w-8 h-1 rounded-full bg-[#e5e1d8]" />
                <ChevronDown
                  size={14}
                  className={`text-gray-400 transition-transform duration-200 ${trayOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* Slide-out tray */}
            <div
              className={`overflow-hidden transition-all duration-[250ms] ease-out ${trayOpen ? 'max-h-[64px]' : 'max-h-0'}`}
            >
              <div
                role="list"
                className="bg-white border border-[#e5e1d8] border-t-0 rounded-b-2xl px-3 py-2 flex flex-row items-center gap-2 overflow-x-auto"
              >
                {hole.shots.map((shot, index) => (
                  <div key={index} role="listitem" className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-[#2d5a27] bg-[#f0f7ee] flex items-center justify-center">
                      <span className="text-xs font-bold text-[#2d5a27]">{getClubInitials(shot.clubId)}</span>
                    </div>
                    {/* Expanded tap zone */}
                    <button
                      aria-label={`Remove shot ${index + 1} (${getClubName(shot.clubId)})`}
                      onClick={() => handleRemoveShotAtIndex(index)}
                      className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#dc2626] flex items-center justify-center">
                        <X size={10} className="text-white" />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
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
                  const putterCount = isPutter ? (hole.putts ?? 0) : 0
                  const isUsed = isPutter ? putterCount > 0 : clubShots.length > 0
                  const shotNums = clubShots.map(s => s.index + 1)
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

          {/* Footer actions */}
          <div className="flex flex-col gap-2 mt-auto pt-2">
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
      ) : (
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
                  const s = h.shots.filter(s => !putterIds.has(s.clubId)).length + (h.putts ?? 0) + (h.penalties ?? 0)
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
                  <td className="px-3 py-2 text-center">{round.holes.reduce((s, h) => s + h.par, 0)}</td>
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
