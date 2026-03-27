interface PuttsInputProps {
  value: number | undefined
  onChange: (putts: number) => void
}

export default function PuttsInput({ value, onChange }: PuttsInputProps) {
  const current = value ?? 0

  function decrement() {
    if (current > 0) onChange(current - 1)
  }

  function increment() {
    if (current < 9) onChange(current + 1)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-warm-gray w-14">Putts</span>
      <div className="flex items-center gap-2">
        <button
          onClick={decrement}
          disabled={current === 0}
          aria-label="Decrease putts"
          className="w-10 h-10 rounded-full bg-white border-2 border-cream-dark text-xl font-bold text-forest flex items-center justify-center disabled:opacity-30 active:bg-cream-dark transition-colors touch-target"
        >
          −
        </button>
        <span className="w-8 text-center text-2xl font-bold text-forest tabular-nums">
          {value === undefined ? '—' : current}
        </span>
        <button
          onClick={increment}
          disabled={current === 9}
          aria-label="Increase putts"
          className="w-10 h-10 rounded-full bg-white border-2 border-cream-dark text-xl font-bold text-forest flex items-center justify-center disabled:opacity-30 active:bg-cream-dark transition-colors touch-target"
        >
          +
        </button>
      </div>
    </div>
  )
}
