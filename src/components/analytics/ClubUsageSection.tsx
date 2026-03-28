import { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { calcClubUsage } from "../../lib/analytics"
import type { Round } from "../../types"
import type { TimeRange } from "../../lib/analytics"

interface Props {
  rounds: Round[]
  timeRange: TimeRange
}

export function ClubUsageSection({ rounds }: Props) {
  const usage = useMemo(() => calcClubUsage(rounds), [rounds])

  // Separate putter from main chart
  const putterUsage = usage.find(u =>
    u.clubName.toLowerCase().includes("putter") || u.clubName.toLowerCase() === "putter"
  )
  const nonPutterUsage = usage.filter(u => u !== putterUsage)

  // Top 8
  const top8 = nonPutterUsage.slice(0, 8)
  const others = nonPutterUsage.slice(8)
  const othersShots = others.reduce((acc, u) => acc + u.shots, 0)

  const totalNonPutt = nonPutterUsage.reduce((acc, u) => acc + u.shots, 0)

  const chartData = [
    ...top8.map(u => ({
      name: u.clubName.length > 12 ? u.clubName.slice(0, 12) + "…" : u.clubName,
      shots: u.shots,
      pct: u.percentage,
    })),
    ...(othersShots > 0 ? [{ name: "Others", shots: othersShots, pct: Math.round((othersShots / (totalNonPutt || 1)) * 100) }] : []),
  ]

  const mostUsed = top8[0] ?? null

  if (usage.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-black text-[#1a1a1a] mb-3">Club Usage</h2>
        <div className="bg-white rounded-2xl border border-[#e5e1d8] p-6 text-center">
          <p className="text-[#6b6b6b] text-sm">No shot data yet. Start tracking clubs when you play.</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-lg font-black text-[#1a1a1a] mb-3">Club Usage</h2>
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
        {mostUsed && (
          <div className="mb-3 bg-[#f5f0e8] rounded-xl px-4 py-2.5">
            <p className="text-sm font-bold text-[#1a1a1a]">
              Most Used: {mostUsed.clubName} · {mostUsed.percentage}% of shots
            </p>
          </div>
        )}

        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 32)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 30, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#6b6b6b" }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b6b6b" }}
                width={80}
              />
              <Tooltip
                formatter={(value: number, _: string, props: { payload?: { pct?: number } }) => [
                  `${value} shots (${props.payload?.pct ?? 0}%)`,
                  "Usage",
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e1d8" }}
              />
              <Bar dataKey="shots" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill="#22c55e" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {putterUsage && (
          <div className="mt-3 pt-3 border-t border-[#e5e1d8]">
            <p className="text-sm text-[#6b6b6b]">
              🏌️ Putter: <span className="font-bold text-[#1a1a1a]">{putterUsage.shots} putts</span>
              {" "}({putterUsage.percentage}% of all shots)
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
