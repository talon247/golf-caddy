import { useRef } from 'react'
import type { KeyboardEvent, ClipboardEvent } from 'react'

interface CodeEntryProps {
  code: string[]
  onChange: (code: string[]) => void
  onSubmit: () => void
  error: string | null
  loading: boolean
}

export default function CodeEntry({ code, onChange, onSubmit, error, loading }: CodeEntryProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function handleInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[index] = digit
    onChange(next)
    if (digit && index < 3) {
      inputs.current[index + 1]?.focus()
    }
    if (digit && index === 3) {
      // Auto-submit on 4th digit
      const filled = next.every(d => d !== '')
      if (filled) setTimeout(onSubmit, 50)
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4).split('')
    if (!digits.length) return
    const next = ['', '', '', '']
    digits.forEach((d, i) => { next[i] = d })
    onChange(next)
    const lastFilled = Math.min(digits.length, 3)
    inputs.current[lastFilled]?.focus()
    if (digits.length === 4) setTimeout(onSubmit, 50)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div>
        <h2 className="text-2xl font-black text-forest text-center">Enter Room Code</h2>
        <p className="text-warm-gray text-sm text-center mt-1">
          Ask the host for their 4-digit code
        </p>
      </div>

      <div className="flex gap-3">
        {[0, 1, 2, 3].map(i => (
          <input
            key={i}
            ref={el => { inputs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={code[i]}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={e => e.target.select()}
            className="w-16 h-20 text-center text-3xl font-black border-2 border-cream-dark rounded-2xl bg-white focus:border-forest focus:outline-none text-gray-900 shadow-sm"
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-600 text-sm text-center font-medium">{error}</p>
      )}

      <button
        onClick={onSubmit}
        disabled={loading || code.some(d => !d)}
        className="w-full bg-forest text-cream py-4 rounded-2xl font-bold text-lg touch-target disabled:opacity-40"
      >
        {loading ? 'Checking…' : 'Join Round'}
      </button>
    </div>
  )
}
