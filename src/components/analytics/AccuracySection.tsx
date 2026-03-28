import { useMemo } from "react"
import {
  calcFIRPercentage,
  calcGIRPercentage,
  calcPuttsPerRound,
  calcThreePuttPercentage,
} from "../../lib/analytics"
import type { Round } from "../../types"
import type { TimeRange } from "../../lib/analytics"

interface Props {
  rounds: Round[]
  timeRange: TimeRange
}

interface StatCardProps {
  value: string
  label: string
  subtitle: string
}

function StatCard({ value, label, subtitle }: StatCardProps) {
  return (
    <div className="bg-[#f5f0e8] rounded-xl p-3 text-center">
      <div className="text-2xl font-black text-[#2d5a27]">{value}</div>
      <div className="text-xs font-semibold text-[#1a1a1a] mt-0.5">{label}</div>
      <div className="text-xs text-[#6b6b6b] mt-0.5">{subtitle}</div>
    </div>
  )
}

export function AccuracySection({ rounds }: Props) {
  const fir = useMemo(() => calcFIRPercentage(rounds), [rounds])
  const gir = useMemo(() => calcGIRPercentage(rounds), [rounds])
  const puttsPerRound = useMemo(() => calcPuttsPerRound(rounds), [rounds])
  const threePutt = useMemo(() => calcThreePuttPercentage(rounds), [rounds])

  function fmtPct(val: number | null): string {
    if (val === null) return "N/A"
    return `${Math.round(val)}%`
  }

  function fmtDecimal(val: number | null): string {
    if (val === null) return "—"
    return val.toFixed(1)
  }

  return (
    <section>
      <h2 className="text-lg font-black text-[#1a1a1a] mb-3">Accuracy</h2>
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            value={fmtPct(fir)}
            label="FIR %"
            subtitle="Fairways in Regulation"
          />
          <StatCard
            value={fmtPct(gir)}
            label="GIR %"
            subtitle="Greens in Regulation"
          />
          <StatCard
            value={fmtDecimal(puttsPerRound)}
            label="Avg Putts"
            subtitle="Per Round"
          />
          <StatCard
            value={fmtPct(threePutt)}
            label="3-Putt %"
            subtitle="Holes with 3+ putts"
          />
        </div>
      </div>
    </section>
  )
}
