import { Link } from 'react-router-dom'
import { useHandicapEstimate } from '../hooks/useHandicapEstimate'

function SparklineSVG({ values }: { values: number[] }) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const w = 120
  const h = 36
  const pad = 4

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = pad + ((max - v) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#2d5a27"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - pad * 2)
        const y = pad + ((max - v) / range) * (h - pad * 2)
        return (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#2d5a27" />
        )
      })}
    </svg>
  )
}

export default function HandicapHistory() {
  const { result, differentials } = useHandicapEstimate()

  const sparklineValues = [...differentials]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(d => d.differential)

  return (
    <main className="flex flex-col flex-1 p-4 gap-5 max-w-lg mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold text-forest">Handicap Estimate</h1>
        <p className="text-warm-gray text-sm mt-0.5">Based on WHS formula — unofficial estimate</p>
      </div>

      {/* Current estimate card */}
      <div className="bg-forest rounded-2xl p-5 text-cream shadow-md">
        {result.estimate !== null ? (
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-forest-light mb-1">
                Handicap Estimate
              </div>
              <div className="text-6xl font-black">{result.estimate.toFixed(1)}</div>
              <div className="text-forest-light text-sm mt-2">
                Based on {result.roundsUsed} best of {result.totalRounds} rounds
                {result.isCapped && (
                  <span className="ml-1 text-yellow-300">
                    · {result.capType === 'hard' ? 'Hard' : 'Soft'} cap applied
                  </span>
                )}
              </div>
            </div>
            <div className="pb-1">
              <SparklineSVG values={sparklineValues} />
              <div className="text-forest-light text-xs text-right mt-1">trend</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-forest-light mb-2">
              Handicap Estimate
            </div>
            <div className="text-cream text-base">
              {differentials.length === 0
                ? 'Log rounds with course rating & slope to see your estimate.'
                : `${3 - differentials.length} more round${3 - differentials.length === 1 ? '' : 's'} with course info needed.`}
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-warm-gray text-center px-2">
        This is an unofficial estimate based on the WHS formula. Not affiliated with USGA or R&amp;A.
      </p>

      {/* Round history */}
      {differentials.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide mb-3">
            Round History
          </h2>
          <ul className="flex flex-col gap-2">
            {differentials.map(d => {
              const date = new Date(d.date).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              return (
                <li key={d.roundId}>
                  <Link
                    to={`/summary/${d.roundId}`}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 shadow-sm touch-target border ${
                      d.usedInEstimate
                        ? 'bg-forest/5 border-forest/30'
                        : 'bg-white border-cream-dark'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {d.usedInEstimate && (
                        <span className="text-forest text-xs font-bold" title="Used in estimate">✓</span>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{d.courseName}</div>
                        <div className="text-warm-gray text-xs">{date}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-forest">{d.differential.toFixed(1)}</div>
                      <div className="text-warm-gray text-xs">differential</div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
          {result.roundsUsed > 0 && (
            <p className="text-xs text-warm-gray text-center mt-3">
              ✓ rounds used in current estimate
            </p>
          )}
        </div>
      ) : (
        <div className="text-center text-warm-gray py-8">
          <p>No rounds with course data yet.</p>
          <p className="text-sm mt-1">Add course rating &amp; slope when starting a round.</p>
        </div>
      )}

      <div className="mt-auto">
        <Link
          to="/"
          className="block text-center border-2 border-forest text-forest py-3 rounded-xl font-semibold touch-target"
        >
          Home
        </Link>
      </div>
    </main>
  )
}
