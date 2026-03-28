import { useState } from 'react'
import type { Round } from '../types'

interface Props {
  round: Round
  onResume: () => void
  onDismiss: () => void
}

export function RestoreRoundBanner({ round, onResume, onDismiss }: Props) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const playedHoles = round.holes.filter(h => h.shots.length > 0 || (h.putts ?? 0) > 0)
  const currentHole = playedHoles.length
  const totalShots = round.holes.reduce(
    (sum, h) => sum + h.shots.length + (h.putts ?? 0) + (h.penalties ?? 0),
    0,
  )

  if (confirmDiscard) {
    return (
      <div className="mx-4 mt-3 mb-1 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-red-700 mb-2">
          Discard this round? All progress will be lost.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-bold active:scale-95 transition-transform"
          >
            Yes, discard
          </button>
          <button
            onClick={() => setConfirmDiscard(false)}
            className="flex-1 text-[#6b6b6b] text-sm font-semibold py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-4 mt-3 mb-1 bg-[#2d5a27]/10 border border-[#2d5a27]/20 rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#2d5a27] truncate">
            🔄 In-progress round at {round.courseName}
          </p>
          <p className="text-xs text-[#6b6b6b] mt-0.5">
            Hole {currentHole} of {round.holeCount} — {totalShots} shot{totalShots !== 1 ? 's' : ''} recorded
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <button
          onClick={onResume}
          className="flex-1 bg-[#2d5a27] text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-transform"
        >
          Resume Round
        </button>
        <button
          onClick={() => setConfirmDiscard(true)}
          className="text-[#6b6b6b] text-sm font-semibold underline"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
