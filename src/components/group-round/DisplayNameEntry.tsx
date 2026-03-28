import type { ChangeEvent } from 'react'

interface DisplayNameEntryProps {
  displayName: string
  onChange: (name: string) => void
  onSubmit: () => void
  onBack: () => void
  error: string | null
  loading: boolean
}

export default function DisplayNameEntry({
  displayName, onChange, onSubmit, onBack, error, loading
}: DisplayNameEntryProps) {
  const trimmed = displayName.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 20

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value.slice(0, 20))
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-black text-forest text-center">Your Name</h2>
        <p className="text-warm-gray text-sm text-center mt-1">
          This is how other players will see you
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          autoFocus
          value={displayName}
          onChange={handleChange}
          onKeyDown={e => { if (e.key === 'Enter' && valid) onSubmit() }}
          placeholder="e.g. Tiger"
          maxLength={20}
          className="w-full border-2 border-cream-dark rounded-2xl px-4 py-4 text-lg font-semibold text-gray-900 focus:border-forest focus:outline-none bg-white"
          aria-label="Display name"
        />
        <p className="text-xs text-warm-gray text-right">{trimmed.length}/20</p>
      </div>

      {error && (
        <p className="text-red-600 text-sm text-center font-medium">{error}</p>
      )}

      <button
        onClick={onSubmit}
        disabled={loading || !valid}
        className="w-full bg-forest text-cream py-4 rounded-2xl font-bold text-lg touch-target disabled:opacity-40"
      >
        {loading ? 'Joining…' : 'Continue'}
      </button>

      <button
        onClick={onBack}
        className="text-center text-warm-gray text-sm touch-target"
      >
        ← Back to code entry
      </button>
    </div>
  )
}
