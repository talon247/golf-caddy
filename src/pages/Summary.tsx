
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAppStore } from '../store'
import { calcPuttsAvg, calcGIR, calcFairwaysHit } from '../utils/scoring'
import { useHandicapEstimate, computeRoundDifferential } from '../hooks/useHandicapEstimate'
import { SaveRoundBanner } from '../components/SaveRoundBanner'
import DiscordInviteBanner from '../components/DiscordInviteBanner'
import SettlementScreen from '../components/group-round/SettlementScreen'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { CANNY_WISH_LIST_URL } from '../lib/config'

function scoreDiff(strokes: number, par: number): string {
  const d = strokes - par
  if (d === 0) return 'E'
  return d > 0 ? `+${d}` : `${d}`
}

function scoreColor(strokes: number, par: number): string {
  const d = strokes - par
  if (strokes === 1 || d <= -2) return 'text-gold font-bold'
  if (d === -1) return 'text-forest-mid font-semibold'
  if (d === 0) return 'text-gray-700'
  if (d === 1) return 'text-orange-600'
  return 'text-red-600 font-semibold'
}

export default function Summary() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const rounds = useAppStore(s => s.rounds)
  const bag = useAppStore(s => s.clubBag)
  const deleteRound = useAppStore(s => s.deleteRound)
  const setActiveRoundId = useAppStore(s => s.setActiveRoundId)
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const groupRound = useGroupRoundStore(s => s.groupRound)
  const sideGameConfig = useGroupRoundStore(s => s.sideGameConfig)

  const putterIds = new Set(bag.filter(c => c.name.toLowerCase() === 'putter').map(c => c.id))
  const round = rounds.find(r => r.id === id)

  if (!round) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6">
        <p className="text-warm-gray text-lg mb-4">Round not found.</p>
        <Link to="/" className="text-forest underline">Go home</Link>
      </main>
    )
  }

  const date = new Date(round.startedAt).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

  const playedHoles = round.holes.filter(h => h.shots.length > 0)
  const totalStrokes = playedHoles.reduce((s, h) => s + h.shots.filter(shot => !putterIds.has(shot.clubId)).length + (h.putts ?? 0), 0)
  const totalPar = round.holes.slice(0, round.holeCount).reduce((s, h) => s + h.par, 0)
  const playedPar = playedHoles.reduce((s, h) => s + h.par, 0)
  const diff = totalStrokes - playedPar

  // Score breakdown
  const counts = { ace: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, worse: 0 }
  for (const h of playedHoles) {
    const d = (h.shots.filter(s => !putterIds.has(s.clubId)).length + (h.putts ?? 0)) - h.par
    if (h.shots.length === 1) counts.ace++
    else if (d <= -2) counts.eagle++
    else if (d === -1) counts.birdie++
    else if (d === 0) counts.par++
    else if (d === 1) counts.bogey++
    else if (d === 2) counts.double++
    else counts.worse++
  }

  const puttsAvg = calcPuttsAvg(round.holes)
  const gir = calcGIR(round.holes, putterIds)
  const fairways = calcFairwaysHit(round.holes)
  const hasStats = puttsAvg !== null || gir !== null || fairways !== null

  // Handicap data
  const { result: handicapResult, differentials } = useHandicapEstimate()
  const thisRoundDifferential = computeRoundDifferential(round, putterIds)
  // Previous estimate: compute from all rounds except this one
  const prevEstimate = (() => {
    const others = differentials.filter(d => d.roundId !== round.id)
    if (others.length < 3) return null
    // approximate: use current estimate if this round is not in differentials
    const isInHistory = differentials.some(d => d.roundId === round.id)
    if (!isInHistory) return handicapResult.estimate
    return null // can't easily compute prior without re-running engine; skip delta
  })()

  const [cannyDismissed, setCannyDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('canny_banner_dismissed') === 'true'
    } catch {
      return false
    }
  })

  function dismissCanny() {
    try {
      sessionStorage.setItem('canny_banner_dismissed', 'true')
    } catch { /* ignore */ }
    setCannyDismissed(true)
  }

  function handleDelete() {
    deleteRound(round!.id)
    navigate('/')
  }

  function handleResume() {
    setActiveRoundId(round!.id)
    navigate('/round')
  }

  return (
    <main className="flex flex-col flex-1 p-4 pb-24 gap-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-forest">{round.courseName}</h1>
        <p className="text-warm-gray text-sm">{round.playerName} · {date} · {round.tees} tees</p>
      </div>

      {/* Score summary card */}
      <div className="bg-forest rounded-2xl p-5 text-cream flex items-center justify-between shadow-md">
        <div>
          <div className="text-5xl font-black">{totalStrokes || '—'}</div>
          <div className="text-forest-light text-sm mt-1">
            {playedHoles.length} of {round.holeCount} holes · Par {playedPar}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black ${diff > 0 ? 'text-red-300' : diff < 0 ? 'text-green-300' : 'text-cream'}`}>
            {totalStrokes > 0 ? scoreDiff(totalStrokes, playedPar) : '—'}
          </div>
          <div className="text-forest-light text-sm mt-1">vs par {playedPar}</div>
        </div>
      </div>

      {/* Score breakdown */}
      {totalStrokes > 0 && (
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          {counts.ace > 0 && <div className="bg-gold/20 rounded-xl p-2"><div className="font-bold text-gold">{counts.ace}</div><div className="text-warm-gray text-xs">Ace</div></div>}
          {counts.eagle > 0 && <div className="bg-gold/10 rounded-xl p-2"><div className="font-bold text-gold">{counts.eagle}</div><div className="text-warm-gray text-xs">Eagle</div></div>}
          {counts.birdie > 0 && <div className="bg-forest/10 rounded-xl p-2"><div className="font-bold text-forest-mid">{counts.birdie}</div><div className="text-warm-gray text-xs">Birdie</div></div>}
          <div className="bg-cream-dark rounded-xl p-2"><div className="font-bold text-gray-700">{counts.par}</div><div className="text-warm-gray text-xs">Par</div></div>
          {counts.bogey > 0 && <div className="bg-orange-50 rounded-xl p-2"><div className="font-bold text-orange-600">{counts.bogey}</div><div className="text-warm-gray text-xs">Bogey</div></div>}
          {counts.double > 0 && <div className="bg-red-50 rounded-xl p-2"><div className="font-bold text-red-600">{counts.double}</div><div className="text-warm-gray text-xs">Double</div></div>}
          {counts.worse > 0 && <div className="bg-red-100 rounded-xl p-2"><div className="font-bold text-red-700">{counts.worse}</div><div className="text-warm-gray text-xs">Worse</div></div>}
        </div>
      )}

      {/* Enhanced stats */}
      {hasStats && (
        <div>
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide mb-2">Stats</h2>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {puttsAvg !== null && (
              <div className="bg-white rounded-xl border border-cream-dark p-3">
                <div className="text-xl font-black text-forest">{puttsAvg.toFixed(1)}</div>
                <div className="text-warm-gray text-xs mt-0.5">Putts / hole</div>
                <div className="text-warm-gray text-xs">
                  {round.holes.filter(h => h.putts !== undefined).length} of {round.holeCount} tracked
                </div>
              </div>
            )}
            {gir !== null && (
              <div className="bg-white rounded-xl border border-cream-dark p-3">
                <div className="text-xl font-black text-forest">{Math.round(gir.pct)}%</div>
                <div className="text-warm-gray text-xs mt-0.5">GIR</div>
                <div className="text-warm-gray text-xs">{gir.hits} of {gir.total} holes</div>
              </div>
            )}
            {fairways !== null && (
              <div className="bg-white rounded-xl border border-cream-dark p-3">
                <div className="text-xl font-black text-forest">{Math.round(fairways.pct)}%</div>
                <div className="text-warm-gray text-xs mt-0.5">Fairways</div>
                <div className="text-warm-gray text-xs">{fairways.hits} of {fairways.total} holes</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Handicap estimate */}
      {(thisRoundDifferential !== null || handicapResult.estimate !== null) && round.completedAt && (
        <div>
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide mb-2">
            Handicap Estimate
          </h2>
          <div className="bg-white rounded-xl border border-cream-dark p-4 flex items-center justify-between gap-4">
            {thisRoundDifferential !== null && (
              <div className="text-center">
                <div className="text-xl font-black text-forest">{thisRoundDifferential.toFixed(1)}</div>
                <div className="text-warm-gray text-xs mt-0.5">This round's differential</div>
              </div>
            )}
            {handicapResult.estimate !== null && (
              <div className="text-center">
                <div className="text-xl font-black text-forest">{handicapResult.estimate.toFixed(1)}</div>
                <div className="text-warm-gray text-xs mt-0.5">Current estimate</div>
                {prevEstimate !== null && prevEstimate !== handicapResult.estimate && (
                  <div className={`text-xs font-semibold mt-0.5 ${handicapResult.estimate < prevEstimate ? 'text-forest-mid' : 'text-orange-600'}`}>
                    {handicapResult.estimate < prevEstimate ? '▼' : '▲'} {Math.abs(handicapResult.estimate - prevEstimate).toFixed(1)}
                  </div>
                )}
              </div>
            )}
            <Link to="/handicap" className="text-forest text-xs underline whitespace-nowrap">
              Full history →
            </Link>
          </div>
          <p className="text-xs text-warm-gray mt-1 px-1">
            Unofficial WHS estimate. Not affiliated with USGA or R&amp;A.
          </p>
        </div>
      )}

      {/* Canny wish list nudge — signed-in users only, dismissable per session */}
      {isAuthenticated && !cannyDismissed && (
        <div className="bg-white rounded-xl border border-[#e5e1d8] px-4 py-3 flex items-center justify-between gap-3">
          <a
            href={CANNY_WISH_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#2d5a27] font-semibold"
          >
            💡 Got ideas? Help shape Golf Caddy →
          </a>
          <button
            onClick={dismissCanny}
            aria-label="Dismiss"
            className="text-[#6b6b6b] text-lg leading-none shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Hole-by-hole scorecard */}
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
              const s = h.shots.filter(shot => !putterIds.has(shot.clubId)).length + (h.putts ?? 0) + (h.penalties ?? 0)
              return (
                <tr key={h.number} className="border-t border-cream-dark">
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
              <td className="px-3 py-2 text-center">{totalPar}</td>
              <td className="px-3 py-2 text-center">{totalStrokes || '—'}</td>
              <td className={`px-3 py-2 text-center ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-forest-mid' : 'text-gray-700'}`}>
                {totalStrokes > 0 ? scoreDiff(totalStrokes, playedPar) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Settlement (group round with side games) */}
      {round.completedAt && groupRound?.status === 'completed' && sideGameConfig?.sideGamesEnabled && (
        <SettlementScreen />
      )}

      {/* Discord invite nudge */}
      <DiscordInviteBanner />

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        {!round.completedAt && (
          <button
            onClick={handleResume}
            className="flex-1 bg-forest text-cream py-3 rounded-xl font-semibold touch-target"
          >
            Resume Round
          </button>
        )}
        <Link
          to="/"
          className="flex-1 border-2 border-forest text-forest py-3 rounded-xl font-semibold text-center touch-target"
        >
          Home
        </Link>
        <button
          onClick={handleDelete}
          className="px-4 py-3 text-red-600 border-2 border-red-200 rounded-xl font-semibold touch-target"
        >
          Delete
        </button>
      </div>

      {round.completedAt && <SaveRoundBanner roundId={round.id} isAuthenticated={isAuthenticated} />}
    </main>
  )
}


