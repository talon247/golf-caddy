import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'

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
  const { rounds, activeRoundId, addShot, removeLastShot, setHolePar, completeRound } = useAppStore()
  const bag = useAppStore(s => s.clubBag).sort((a, b) => a.order - b.order)

  const round = rounds.find(r => r.id === activeRoundId)
  const [currentHole, setCurrentHole] = useState(1)
  const [showScorecard, setShowScorecard] = useState(false)

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
  const strokes = hole.shots.length
  const totalHoles = round.holeCount

  // Running totals
  const playedHoles = round.holes.filter(h => h.shots.length > 0)
  const totalStrokes = playedHoles.reduce((sum, h) => sum + h.shots.length, 0)
  const totalPar = playedHoles.reduce((sum, h) => sum + h.par, 0)
  const runningDiff = totalStrokes - totalPar

  function handleClubTap(clubId: string) {
    addShot(round!.id, currentHole, { clubId, timestamp: Date.now() })
  }

  function handleUndo() {
    removeLastShot(round!.id, currentHole)
  }

  function handlePar(par: number) {
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

  if (showScorecard) {
    return (
      <main className="flex flex-col flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-forest">Scorecard</h2>
          <button
            onClick={() => setShowScorecard(false)}
            className="text-warm-gray underline text-sm touch-target flex items-center"
          >
            ← Back
          </button>
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
                const s = h.shots.length
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
        <button
          onClick={handleFinish}
          className="mt-6 bg-gold text-white py-4 rounded-xl text-lg font-bold shadow touch-target"
        >
          Finish Round
        </button>
      </main>
    )
  }

  return (
    <main className="flex flex-col flex-1 p-4 gap-4">
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
            className={`w-10 h-10 rounded-full text-sm font-bold border-2 transition-colors touch-target ${
              hole.par === p
                ? 'bg-forest text-cream border-forest'
                : 'bg-white text-forest border-cream-dark'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stroke counter */}
      <div className="bg-white rounded-2xl border border-cream-dark p-5 flex flex-col items-center gap-2 shadow-sm">
        <div className="text-6xl font-black text-forest">{strokes}</div>
        <div className={`text-lg font-semibold ${strokes > 0 ? scoreColor(strokes, hole.par) : 'text-warm-gray'}`}>
          {strokes > 0 ? scoreName(strokes, hole.par) : 'Tap a club to start'}
        </div>
        {strokes > 0 && (
          <button
            onClick={handleUndo}
            className="mt-1 text-sm text-warm-gray underline touch-target"
          >
            Undo last shot
          </button>
        )}
      </div>

      {/* Club quick-tap grid */}
      <div>
        <p className="text-xs text-warm-gray uppercase tracking-wide mb-2">Tap club used</p>
        <div className="grid grid-cols-4 gap-2">
          {bag.map(club => (
            <button
              key={club.id}
              onClick={() => handleClubTap(club.id)}
              className="bg-white border-2 border-cream-dark rounded-xl py-3 text-sm font-semibold text-forest active:bg-forest active:text-cream active:border-forest transition-colors touch-target"
            >
              {club.name}
            </button>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex gap-3 mt-auto pt-2">
        <button
          onClick={() => setShowScorecard(true)}
          className="flex-1 border-2 border-forest text-forest py-3 rounded-xl font-semibold touch-target"
        >
          Scorecard
        </button>
        {currentHole === totalHoles ? (
          <button
            onClick={handleFinish}
            className="flex-1 bg-gold text-white py-3 rounded-xl font-bold shadow touch-target"
          >
            Finish
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
    </main>
  )
}
