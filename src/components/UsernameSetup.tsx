import { useState, useEffect, useRef } from 'react'
import { checkUsernameAvailable, setUsername } from '../lib/friends'

interface Props {
  userId: string
  onComplete: (username: string) => void
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/

/**
 * Modal shown on first Friends page visit when the user has no username set.
 * Allows picking a unique username (3-20 chars, lowercase alphanumeric + underscore).
 */
export function UsernameSetup({ userId, onComplete }: Props) {
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFormatValid = USERNAME_REGEX.test(value)

  // Debounced availability check
  useEffect(() => {
    if (!isFormatValid) {
      setAvailable(null)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setChecking(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const avail = await checkUsernameAvailable(value)
        setAvailable(avail)
      } catch {
        setAvailable(null)
      } finally {
        setChecking(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, isFormatValid])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isFormatValid || !available) return
    setSaving(true)
    setError(null)
    try {
      await setUsername(userId, value)
      onComplete(value)
    } catch (err) {
      setError((err as Error).message ?? 'Failed to save username')
    } finally {
      setSaving(false)
    }
  }

  function statusText() {
    if (!value) return null
    if (!isFormatValid) return { text: '3–20 chars, lowercase letters, numbers, underscore only', ok: false }
    if (checking) return { text: 'Checking…', ok: null }
    if (available === true) return { text: '@' + value + ' is available', ok: true }
    if (available === false) return { text: '@' + value + ' is taken', ok: false }
    return null
  }

  const status = statusText()
  const canSubmit = isFormatValid && available === true && !saving && !checking

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-[#1a1a1a] mb-1">Choose your username</h2>
        <p className="text-sm text-[#6b6b6b] mb-5">
          Friends can find and add you by username. You can change it later in settings.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b6b6b] text-base select-none">@</span>
              <input
                type="text"
                value={value}
                onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="your_username"
                maxLength={20}
                autoComplete="off"
                autoCapitalize="none"
                className="border border-[#e5e1d8] rounded-xl pl-8 pr-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
              />
            </div>

            {status && (
              <p className={`mt-1.5 text-xs ${
                status.ok === true ? 'text-[#2d5a27]' :
                status.ok === false ? 'text-red-600' :
                'text-[#6b6b6b]'
              }`}>
                {status.text}
              </p>
            )}
          </div>

          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Set username'}
          </button>
        </form>
      </div>
    </div>
  )
}
