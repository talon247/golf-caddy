import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useHandicapEstimate } from '../hooks/useHandicapEstimate'

const DISCLAIMER_KEY = 'gc-handicap-disclaimer-dismissed'

function HandicapWidget() {
  const { result, differentials } = useHandicapEstimate()
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISCLAIMER_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [showDisclaimer, setShowDisclaimer] = useState(false)

  useEffect(() => {
    if (result.estimate !== null && !dismissed) {
      setShowDisclaimer(true)
    }
  }, [result.estimate, dismissed])

  function dismiss() {
    try {
      localStorage.setItem(DISCLAIMER_KEY, 'true')
    } catch { /* ignore */ }
    setDismissed(true)
    setShowDisclaimer(false)
  }

  return (
    <Link
      to="/handicap"
      className="block bg-white border-2 border-forest/20 rounded-2xl p-4 shadow-sm touch-target"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-warm-gray mb-1">
            Handicap Estimate
          </div>
          {result.estimate !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-forest">{result.estimate.toFixed(1)}</span>
              <span className="text-warm-gray text-xs">{result.roundsUsed} of {result.totalRounds} rounds</span>
            </div>
          ) : (
            <div className="text-warm-gray text-sm">
              {differentials.length === 0
                ? 'Log 3+ rounds with course info to see your estimate'
                : `${3 - differentials.length} more round${3 - differentials.length === 1 ? '' : 's'} needed`}
            </div>
          )}
        </div>
        <div className="text-forest opacity-40 text-xl">›</div>
      </div>

      {showDisclaimer && (
        <div
          className="mt-3 pt-3 border-t border-forest/10 text-xs text-warm-gray"
          onClick={e => e.preventDefault()}
        >
          <p>This is an unofficial estimate based on the WHS formula. Not affiliated with USGA or R&amp;A.</p>
          <button
            onClick={dismiss}
            className="mt-1 text-forest font-semibold underline text-xs"
          >
            Got it
          </button>
        </div>
      )}
    </Link>
  )
}

function scoreDiff(strokes: number, par: number): string {
  const d = strokes - par
  if (d === 0) return 'E'
  return d > 0 ? `+${d}` : `${d}`
}

export default function Home() {
  const navigate = useNavigate()
  const rounds = useAppStore(s => s.rounds)
  const activeRoundId = useAppStore(s => s.activeRoundId)
  const bag = useAppStore(s => s.clubBag)
  const putterIds = new Set(bag.filter(c => c.name.toLowerCase() === 'putter').map(c => c.id))

  const activeRound = rounds.find(r => r.id === activeRoundId)
  const pastRounds = rounds.filter(r => r.completedAt)

  return (
    <main className="flex flex-col flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      {/* Hero */}
      <div className="text-center pt-4">
        <div className="text-5xl mb-2">⛳</div>
        <h1 className="text-3xl font-black text-forest">Golf Caddy</h1>
        <p className="text-warm-gray mt-1">Your digital round companion</p>
      </div>

      {/* Active round card or start CTA */}
      {activeRound ? (
        <div className="bg-forest rounded-2xl p-5 text-cream shadow-md">
          <div className="text-xs font-semibold uppercase tracking-widest text-forest-light mb-1">
            Round in progress
          </div>
          <div className="text-xl font-bold">{activeRound.courseName}</div>
          <div className="text-forest-light text-sm mt-0.5">
            {activeRound.playerName} · {activeRound.tees} tees
          </div>
          {(() => {
            const played = activeRound.holes.filter(h => h.shots.length > 0)
            const totalStrokes = played.reduce((s, h) => s + h.shots.filter(shot => !putterIds.has(shot.clubId)).length + (h.putts ?? 0), 0)
            const playedPar = played.reduce((s, h) => s + h.par, 0)
            return (
              <div className="flex items-center justify-between mt-3">
                <span className="text-forest-light text-sm">
                  {played.length}/{activeRound.holeCount} holes
                </span>
                {totalStrokes > 0 && (
                  <span className="font-bold text-lg">
                    {totalStrokes} ({scoreDiff(totalStrokes, playedPar)})
                  </span>
                )}
              </div>
            )
          })()}
          <button
            onClick={() => navigate('/round')}
            className="mt-4 w-full bg-cream text-forest py-3 rounded-xl font-bold text-base touch-target"
          >
            Continue Round →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            to="/setup"
            className="flex items-center justify-center bg-gold text-white py-5 rounded-2xl text-xl font-bold shadow-md touch-target"
          >
            Start New Round
          </Link>
          <Link
            to="/group-round/host"
            className="flex items-center justify-center bg-forest text-cream py-4 rounded-2xl text-base font-bold shadow-md touch-target"
          >
            👥 Start Group Round
          </Link>
          <Link
            to="/group-round/join"
            className="flex items-center justify-center border-2 border-forest text-forest py-4 rounded-2xl text-lg font-bold touch-target"
          >
            Join Round
          </Link>
        </div>
      )}

      {/* Handicap estimate widget */}
      <HandicapWidget />

      {/* Past rounds */}
      {pastRounds.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide mb-3">
            Past Rounds
          </h2>
          <ul className="flex flex-col gap-2">
            {pastRounds.map(round => {
              const played = round.holes.filter(h => h.shots.length > 0)
              const totalStrokes = played.reduce((s, h) => s + h.shots.filter(shot => !putterIds.has(shot.clubId)).length + (h.putts ?? 0), 0)
              const playedPar = played.reduce((s, h) => s + h.par, 0)
              const diff = totalStrokes - playedPar
              const date = new Date(round.startedAt).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric',
              })
              return (
                <li key={round.id}>
                  <Link
                    to={`/summary/${round.id}`}
                    className="flex items-center justify-between bg-white border border-cream-dark rounded-xl px-4 py-3 shadow-sm touch-target"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{round.courseName}</div>
                      <div className="text-warm-gray text-sm">{date} · {round.tees}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-forest">{totalStrokes || '—'}</div>
                      {totalStrokes > 0 && (
                        <div
                          className={`text-sm font-semibold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-forest-mid' : 'text-warm-gray'}`}
                        >
                          {scoreDiff(totalStrokes, playedPar)}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3 mt-auto flex-wrap">
        <Link
          to="/bag"
          className="flex-1 text-center border-2 border-cream-dark bg-white text-forest py-3 rounded-xl font-semibold touch-target"
        >
          🏌️ My Bag
        </Link>
        <Link
          to="/courses"
          className="flex-1 text-center border-2 border-cream-dark bg-white text-forest py-3 rounded-xl font-semibold touch-target"
        >
          📋 Courses
        </Link>
        {activeRound && (
          <Link
            to="/setup"
            className="flex-1 text-center border-2 border-cream-dark bg-white text-forest py-3 rounded-xl font-semibold touch-target"
          >
            + New Round
          </Link>
        )}
      </div>
    </main>
  )
}

