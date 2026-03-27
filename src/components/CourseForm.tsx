import { useState } from 'react'
import type { Course, CourseHole } from '../types'
import ParGridEditor from './ParGridEditor'

interface Props {
  initial?: Course
  onSave: (name: string, holes: CourseHole[]) => void
  onCancel: () => void
}

function buildDefaultPars(count: 9 | 18): number[] {
  return Array(count).fill(4)
}

export default function CourseForm({ initial, onSave, onCancel }: Props) {
  const editingCount = initial
    ? ((initial.holes.length === 9 ? 9 : 18) as 9 | 18)
    : 18
  const editingPars = initial
    ? Array.from({ length: 18 }, (_, i) => initial.holes[i]?.par ?? 4)
    : buildDefaultPars(18)

  const [name, setName] = useState(initial?.name ?? '')
  const [holeCount, setHoleCount] = useState<9 | 18>(editingCount)
  const [pars, setPars] = useState<number[]>(editingPars)

  function handleHoleCountChange(n: 9 | 18) {
    setHoleCount(n)
    // Reset second 9 pars to 4 when switching from 18 to 9 and back
    if (n === 18 && holeCount === 9) {
      setPars(prev => {
        const next = [...prev]
        for (let i = 9; i < 18; i++) next[i] = 4
        return next
      })
    }
  }

  function handleParChange(index: number, par: number) {
    setPars(prev => {
      const next = [...prev]
      next[index] = par
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const holes: CourseHole[] = Array.from({ length: holeCount }, (_, i) => ({
      number: i + 1,
      par: pars[i] ?? 4,
    }))
    onSave(trimmed, holes)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Course name */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-500 mb-1">Course Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Augusta National"
          required
          className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
        />
      </div>

      {/* Holes */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-gray-500 mb-2">Holes</div>
        <div className="flex gap-3">
          {([9, 18] as const).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => handleHoleCountChange(n)}
              className={`flex-1 py-4 rounded-xl text-lg font-bold border-2 min-h-[56px] transition-colors ${
                holeCount === n
                  ? 'bg-[#2d5a27] text-white border-[#2d5a27]'
                  : 'bg-white text-[#2d5a27] border-[#e5e1d8]'
              }`}
            >
              {n} holes
            </button>
          ))}
        </div>
      </div>

      {/* Par grid */}
      <ParGridEditor holeCount={holeCount} pars={pars} onChange={handleParChange} />

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border-2 border-[#e5e1d8] bg-white text-[#1a1a1a] font-semibold min-h-[48px]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-3 rounded-xl bg-[#2d5a27] text-white font-bold min-h-[48px]"
        >
          {initial ? 'Save Changes' : 'Save Course'}
        </button>
      </div>
    </form>
  )
}
