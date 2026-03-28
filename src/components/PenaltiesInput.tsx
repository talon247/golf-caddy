interface PenaltiesInputProps {
  value: number | undefined
  onChange: (penalties: number) => void
}

export default function PenaltiesInput({ value, onChange }: PenaltiesInputProps) {
  const current = value ?? 0

  function decrement() {
    if (current > 0) onChange(current - 1)
  }

  function increment() {
    if (current < 9) onChange(current + 1)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-warm-gray w-14">Penalty</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); decrement() }}
          disabled={current === 0}
          aria-label="Decrease penalty strokes"
          className="w-10 h-10 rounded-full bg-white border-2 border-cream-dark text-xl font-bold text-forest flex items-center justify-center disabled:opacity-30 active:bg-cream-dark transition-colors touch-target"
        >
          −
        </button>
        <span className={`w-8 text-center text-2xl font-bold tabular-nums ${current > 0 ? 'text-red-600' : 'text-forest'}`}>
          {value === undefined || current === 0 ? '—' : current}
        </span>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); increment() }}
          disabled={current === 9}
          aria-label="Increase penalty strokes"
          className="w-10 h-10 rounded-full bg-white border-2 border-cream-dark text-xl font-bold text-forest flex items-center justify-center disabled:opacity-30 active:bg-cream-dark transition-colors touch-target"
        >
          +
        </button>
      </div>
    </div>
  )
}
