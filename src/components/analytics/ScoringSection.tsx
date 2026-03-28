import { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  calcAverageScore,
  calcBestRound,
  calcScoringTrend,
} from "../../lib/analytics"
import type { Round } from "../../types"
import type { TimeRange } from "../../lib/analytics"

interface Props {
  rounds: Round[]
  timeRange: TimeRange
}

function totalStrokes(round: Round): number {
  return round.holes.reduce((acc, h) => acc + h.shots.length + (h.putts ?? 0) + (h.penalties ?? 0), 0)
}

export function ScoringSection({ rounds }: Props) {
  const avgScore = useMemo(() => calcAverageScore(rounds), [rounds])
  const bestRound = useMemo(() => calcBestRound(rounds), [rounds])
  const trend = useMemo(() => calcScoringTrend(rounds), [rounds])

  // Score distribution (18-hole only)
  const distribution = useMemo(() => {
    const rounds18 = rounds.filter(r => r.holeCount === 18)
    const bins = { "<80": 0, "80-89": 0, "90-99": 0, "100+": 0 }
    for (const r of rounds18) {
      const s = totalStrokes(r)
      if (s < 80) bins["<80"]++
      else if (s <= 89) bins["80-89"]++
      else if (s <= 99) bins["90-99"]++
      else bins["100+"]++
    }
    return Object.entries(bins).map(([name, count]) => ({ name, count }))
  }, [rounds])

  const trendColor = trend.label === "Improving" ? "text-green-600" : trend.label === "Worsening" ? "text-red-500" : "text-[#6b6b6b]"
  const trendArrow = trend.label === "Improving" ? "↓" : trend.label === "Worsening" ? "↑" : "→"

  return (
    <section>
      <h2 className="text-lg font-black text-[#1a1a1a] mb-3">Scoring</h2>
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
        {/* 2-up stat grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-black text-[#2d5a27]">
              {avgScore !== null ? avgScore.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-[#6b6b6b] mt-0.5">Avg Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-[#2d5a27]">
              {bestRound !== null ? bestRound.strokes : "—"}
            </div>
            <div className="text-xs text-[#6b6b6b] mt-0.5">Best Round (18H)</div>
          </div>
        </div>

        {/* Trend */}
        <div className={`text-sm font-semibold mb-4 ${trendColor}`}>
          {trendArrow} {Math.abs(trend.slope).toFixed(1)} strokes/round · {trend.label}
        </div>

        {/* Distribution chart */}
        {distribution.some(d => d.count > 0) && (
          <div>
            <p className="text-xs text-[#6b6b6b] mb-2">Score distribution (18 holes)</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={distribution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d8" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b6b6b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6b6b6b" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e1d8" }} />
                <Bar dataKey="count" fill="#2d5a27" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}
