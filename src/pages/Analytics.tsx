import { useState } from "react"
import { Link } from "react-router-dom"
import { useRounds } from "../hooks/useRounds"
import { useAppStore } from "../store"
import { filterByTimeRange } from "../lib/analytics"
import type { TimeRange } from "../lib/analytics"
import { HandicapSection } from "../components/analytics/HandicapSection"
import { ScoringSection } from "../components/analytics/ScoringSection"
import { AccuracySection } from "../components/analytics/AccuracySection"
import { ClubUsageSection } from "../components/analytics/ClubUsageSection"

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "Last 10", value: "last10" },
  { label: "30 Days", value: "last30d" },
  { label: "90 Days", value: "last90d" },
  { label: "All Time", value: "alltime" },
]

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>("last10")
  const { rounds, loading } = useRounds()
  const profile = useAppStore(s => s.profile)
  const clubBag = useAppStore(s => s.clubBag)

  const completedRounds = rounds.filter(r => r.completedAt != null)
  const filteredRounds = filterByTimeRange(completedRounds, timeRange)

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
      active
        ? "bg-[#2d5a27] text-white border-[#2d5a27]"
        : "bg-white text-[#2d5a27] border-[#e5e1d8]"
    }`

  return (
    <main className="flex flex-col flex-1 bg-[#f5f0e8] pb-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-black text-[#1a1a1a] mb-4">Analytics</h1>
        {/* Time range filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TIME_RANGES.map(r => (
            <button
              key={r.value}
              className={tabClass(timeRange === r.value)}
              onClick={() => setTimeRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-[#6b6b6b]">
            <svg className="animate-spin w-8 h-8 text-[#2d5a27]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm">Loading rounds…</span>
          </div>
        </div>
      )}

      {!loading && filteredRounds.length < 3 && (
        <div className="flex flex-col flex-1 items-center justify-center px-6 py-16 text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-[#1a1a1a] font-bold text-lg mb-2">Not enough data yet</p>
          <p className="text-[#6b6b6b] text-sm mb-6">
            Play at least 3 rounds in this time range to see your stats.
          </p>
          <Link
            to="/setup"
            className="bg-[#2d5a27] text-white rounded-xl px-6 py-3 font-bold text-sm active:scale-95 transition-transform"
          >
            Start a Round
          </Link>
        </div>
      )}

      {!loading && filteredRounds.length >= 3 && (
        <div className="px-5 flex flex-col gap-6 pb-6">
          <HandicapSection rounds={filteredRounds} profile={profile} timeRange={timeRange} />
          <ScoringSection rounds={filteredRounds} timeRange={timeRange} />
          <AccuracySection rounds={filteredRounds} timeRange={timeRange} />
          <ClubUsageSection rounds={filteredRounds} timeRange={timeRange} clubs={clubBag} />
        </div>
      )}
    </main>
  )
}
