import { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { calcHandicapTrend } from "../../lib/analytics"
import type { Round } from "../../types"
import type { UserProfile } from "../../types"
import type { TimeRange } from "../../lib/analytics"

interface Props {
  rounds: Round[]
  profile: UserProfile | null
  timeRange: TimeRange
}

export function HandicapSection({ rounds, profile }: Props) {
  const trend = useMemo(() => calcHandicapTrend(rounds), [rounds])

  const currentHI = profile?.handicapIndex ?? null

  const lowHI = useMemo(() => {
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
    const recent = trend.filter(t => t.date >= oneYearAgo)
    if (recent.length === 0) return null
    return Math.min(...recent.map(t => t.differential))
  }, [trend])

  const trendDelta = useMemo(() => {
    if (trend.length < 2) return null
    const recent = trend.slice(-1)[0].differential
    const older30 = (() => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const older = trend.filter(t => t.date < thirtyDaysAgo)
      return older.length > 0 ? older[older.length - 1].differential : null
    })()
    if (older30 === null) return null
    return recent - older30
  }, [trend])

  const chartData = trend.slice(-20).map(t => ({
    date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    differential: parseFloat(t.differential.toFixed(1)),
  }))

  return (
    <section>
      <h2 className="text-lg font-black text-[#1a1a1a] mb-3">Handicap</h2>
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
        {/* Stats row */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 text-center">
            <div className="text-3xl font-black text-[#2d5a27]">
              {currentHI !== null ? currentHI.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-[#6b6b6b] mt-0.5">Current Index</div>
            {currentHI === null && (
              <div className="text-xs text-[#6b6b6b] mt-0.5">Not yet calculated</div>
            )}
          </div>
          <div className="flex-1 text-center">
            <div className="text-3xl font-black text-[#2d5a27]">
              {lowHI !== null ? lowHI.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-[#6b6b6b] mt-0.5">12-Month Low</div>
          </div>
          {trendDelta !== null && (
            <div className="flex-1 text-center">
              <div className={`text-2xl font-black ${trendDelta < 0 ? "text-green-600" : trendDelta > 0 ? "text-red-500" : "text-[#6b6b6b]"}`}>
                {trendDelta > 0 ? "↑" : trendDelta < 0 ? "↓" : "→"} {Math.abs(trendDelta).toFixed(1)}
              </div>
              <div className="text-xs text-[#6b6b6b] mt-0.5">vs 30 days ago</div>
            </div>
          )}
        </div>

        {/* Chart */}
        {chartData.length >= 2 ? (
          <div>
            <p className="text-xs text-[#6b6b6b] mb-2">Score differential (lower = better)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d8" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b6b6b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6b6b6b" }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e1d8" }}
                />
                <Line
                  type="monotone"
                  dataKey="differential"
                  stroke="#2d5a27"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2d5a27" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[#6b6b6b] text-center py-4">Play more rounds to see your trend</p>
        )}

        <p className="text-xs text-[#6b6b6b] mt-2">
          Rounds used: {trend.length}
        </p>
      </div>
    </section>
  )
}
