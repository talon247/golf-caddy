interface FairwayToggleProps {
  value: boolean | undefined
  onChange: (hit: boolean) => void
}

export default function FairwayToggle({ value, onChange }: FairwayToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-warm-gray w-14">Fairway</span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          aria-label="Fairway hit"
          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors touch-target min-h-[44px] ${
            value === true
              ? 'bg-forest text-cream border-forest'
              : 'bg-white text-forest border-cream-dark'
          }`}
        >
          Hit
        </button>
        <button
          onClick={() => onChange(false)}
          aria-label="Fairway missed"
          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors touch-target min-h-[44px] ${
            value === false
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-warm-gray border-cream-dark'
          }`}
        >
          Miss
        </button>
      </div>
    </div>
  )
}
