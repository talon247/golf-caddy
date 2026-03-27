import { useState } from 'react'

interface Props {
  holeCount: 9 | 18
  pars: number[]
  onChange: (index: number, par: number) => void
}

function cellBorderClass(par: number): string {
  if (par === 3) return 'border-[#4a7c59]'
  if (par === 5) return 'border-[#2d5a27]'
  return 'border-[#e5e1d8]'
}

export default function ParGridEditor({ holeCount, pars, onChange }: Props) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)

  const holes = Array.from({ length: holeCount }, (_, i) => i)

  function pickPar(par: number) {
    if (pickerIndex !== null) {
      onChange(pickerIndex, par)
    }
    setPickerIndex(null)
  }

  return (
    <>
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Par per Hole</div>
        <div className="text-xs text-gray-400 mb-3">
          Default is Par 4 for all holes. Tap any hole to change.
        </div>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}
        >
          {holes.map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setPickerIndex(i)}
              className={`flex flex-col items-center justify-center rounded-lg bg-white border py-2 text-center transition-colors ${cellBorderClass(pars[i] ?? 4)}`}
            >
              <span className="text-[10px] text-gray-400 leading-none">{i + 1}</span>
              <span className="text-sm font-bold text-[#1a1a1a] leading-none mt-0.5">
                {pars[i] ?? 4}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Par picker bottom sheet */}
      {pickerIndex !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setPickerIndex(null)}
          />
          <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl p-6 pb-8 shadow-2xl z-50 transition-transform duration-300 ease-out">
            <div className="text-base font-semibold text-[#1a1a1a] mb-4">
              Par for Hole {pickerIndex + 1}
            </div>
            <div className="flex gap-3">
              {([3, 4, 5] as const).map(par => (
                <button
                  key={par}
                  type="button"
                  onClick={() => pickPar(par)}
                  className={`flex-1 py-5 rounded-xl text-2xl font-black border-2 min-h-[72px] transition-colors ${
                    (pars[pickerIndex] ?? 4) === par
                      ? 'bg-[#2d5a27] border-[#2d5a27] text-white'
                      : 'bg-[#faf7f2] border-[#e5e1d8] text-[#1a1a1a]'
                  }`}
                >
                  {par}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
