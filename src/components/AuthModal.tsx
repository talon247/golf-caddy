import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store'
import { signIn, signUp, resetPassword } from '../lib/auth'
import { migrateLocalRounds } from '../lib/sync'
import { useToastStore } from '../store/toastStore'
import { MigrationPrompt } from './MigrationPrompt'

type Tab = 'signin' | 'signup'

interface Props {
  isOpen: boolean
  onClose: () => void
  defaultTab?: Tab
}

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: '', color: '', width: '0%' }
  const hasMinLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)

  if (hasMinLength && hasUpper && hasNumber && hasSpecial) {
    return { label: 'Strong', color: '#2d5a27', width: '100%' }
  }
  if (hasMinLength && hasUpper && hasNumber) {
    return { label: 'Fair', color: '#f59e0b', width: '66%' }
  }
  if (hasMinLength) {
    return { label: 'Weak', color: '#ef4444', width: '33%' }
  }
  return { label: 'Weak', color: '#ef4444', width: '15%' }
}

export function AuthModal({ isOpen, onClose, defaultTab = 'signin' }: Props) {
  const setAuthState = useAppStore(s => s.setAuthState)
  const rounds = useAppStore(s => s.rounds)
  const syncStatus = useAppStore(s => s.syncStatus)

  const [tab, setTab] = useState<Tab>(defaultTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Migration prompt state
  const [showMigration, setShowMigration] = useState(false)
  const [migrationUserId, setMigrationUserId] = useState<string | null>(null)
  const [migrationRoundCount, setMigrationRoundCount] = useState(0)

  // Sign In fields
  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')

  // Sign Up fields
  const [suDisplayName, setSuDisplayName] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPassword, setSuPassword] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)
  const lastFocusableRef = useRef<HTMLButtonElement>(null)

  // Reset state on open / tab change
  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab)
      setError('')
      setSuccessMsg('')
    }
  }, [isOpen, defaultTab])

  useEffect(() => {
    setError('')
    setSuccessMsg('')
  }, [tab])

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
      // Focus trap
      if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [isOpen, loading, onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Focus first input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        overlayRef.current?.querySelector<HTMLElement>('input')?.focus()
      }, 50)
    }
  }, [isOpen, tab])

  if (!isOpen && !showMigration) return null

  // Migration prompt shown outside normal modal flow
  if (showMigration) {
    return (
      <MigrationPrompt
        isOpen={showMigration}
        roundCount={migrationRoundCount}
        onConfirm={handleMigrationConfirm}
        onDecline={handleMigrationDecline}
      />
    )
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (loading) return
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const res = await signIn(siEmail, siPassword)
      const user = res.data?.user
      if (user) {
        setAuthState(user.id, null)
        onClose()
        // Non-blocking: after sign-in, if local rounds exist and user hasn't declined migration,
        // the Profile page will show a sync banner (handled in Profile.tsx).
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed'
      if (msg.toLowerCase().includes('invalid')) {
        setError('Invalid email or password')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const res = await signUp(suEmail, suPassword, suDisplayName)
      const user = res.data?.user
      if (user) {
        setAuthState(user.id, null)
        // Check for completed, unsynced local rounds
        const unsyncedRounds = rounds.filter(
          r => r.completedAt != null &&
            syncStatus[r.id] !== 'synced' &&
            syncStatus[r.id] !== 'pending',
        )
        if (unsyncedRounds.length > 0) {
          setMigrationUserId(user.id)
          setMigrationRoundCount(unsyncedRounds.length)
          setShowMigration(true)
          // Don't close modal yet; MigrationPrompt will close it
        } else {
          onClose()
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed'
      if (msg.toLowerCase().includes('already')) {
        setError('Email already in use')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleMigrationConfirm() {
    if (!migrationUserId) return
    setShowMigration(false)
    const currentSyncStatus = useAppStore.getState().syncStatus
    const unsyncedRounds = useAppStore.getState().rounds.filter(
      r => r.completedAt != null &&
        currentSyncStatus[r.id] !== 'synced' &&
        currentSyncStatus[r.id] !== 'pending',
    )
    const { synced, failed } = await migrateLocalRounds(migrationUserId, unsyncedRounds)
    if (failed > 0) {
      useToastStore.getState().addToast(`Synced ${synced} round${synced !== 1 ? 's' : ''}; ${failed} failed — will retry when online`)
    } else if (synced > 0) {
      useToastStore.getState().addToast(`Synced ${synced} round${synced !== 1 ? 's' : ''} successfully`)
    }
    onClose()
  }

  function handleMigrationDecline() {
    try {
      localStorage.setItem('migration_declined', 'true')
    } catch { /* ignore */ }
    setShowMigration(false)
    onClose()
  }

  async function handleForgotPassword() {
    if (!siEmail) {
      setError('Enter your email above to reset your password')
      return
    }
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      await resetPassword(siEmail)
      setSuccessMsg('Check your email for a reset link')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const strength = getPasswordStrength(suPassword)

  const inputClass =
    'border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full'
  const primaryBtn =
    'w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={handleBackdrop}
      aria-modal="true"
      role="dialog"
      aria-label={tab === 'signin' ? 'Sign In' : 'Create Account'}
    >
      <div
        ref={overlayRef}
        className="bg-[#f5f0e8] w-full sm:max-w-md sm:rounded-2xl rounded-none max-h-[95dvh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="text-2xl font-black text-[#2d5a27]">⛳ Golf Caddy</div>
          <button
            ref={firstFocusableRef}
            onClick={() => !loading && onClose()}
            aria-label="Close"
            className="text-[#6b6b6b] text-2xl leading-none hover:text-[#1a1a1a] w-8 h-8 flex items-center justify-center rounded-full"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mx-6 mb-4 bg-[#e5e1d8] rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('signin')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'signin'
                ? 'bg-white text-[#2d5a27] shadow-sm'
                : 'text-[#6b6b6b] hover:text-[#1a1a1a]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('signup')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === 'signup'
                ? 'bg-white text-[#2d5a27] shadow-sm'
                : 'text-[#6b6b6b] hover:text-[#1a1a1a]'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="px-6 pb-8">
          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1">
                <label htmlFor="si-email" className="text-sm font-semibold text-[#1a1a1a]">
                  Email
                </label>
                <input
                  id="si-email"
                  type="email"
                  autoComplete="email"
                  value={siEmail}
                  onChange={e => setSiEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="si-password" className="text-sm font-semibold text-[#1a1a1a]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="si-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={siPassword}
                    onChange={e => setSiPassword(e.target.value)}
                    className={inputClass + ' pr-12'}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#1a1a1a] p-1"
                    tabIndex={0}
                  >
                    {showPassword ? (
                      // Eye-off
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      // Eye
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-red-600 text-sm font-medium text-center">
                  {error}
                </p>
              )}
              {successMsg && (
                <p role="status" className="text-[#2d5a27] text-sm font-medium text-center">
                  {successMsg}
                </p>
              )}

              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign In →'
                )}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-[#2d5a27] text-sm font-semibold underline text-center hover:opacity-80 disabled:opacity-50"
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1">
                <label htmlFor="su-displayname" className="text-sm font-semibold text-[#1a1a1a]">
                  Display Name <span className="text-[#6b6b6b] font-normal">(optional)</span>
                </label>
                <input
                  id="su-displayname"
                  type="text"
                  autoComplete="name"
                  value={suDisplayName}
                  onChange={e => setSuDisplayName(e.target.value)}
                  className={inputClass}
                  placeholder="Your name"
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="su-email" className="text-sm font-semibold text-[#1a1a1a]">
                  Email
                </label>
                <input
                  id="su-email"
                  type="email"
                  autoComplete="email"
                  value={suEmail}
                  onChange={e => setSuEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="su-password" className="text-sm font-semibold text-[#1a1a1a]">
                  Password
                </label>
                <input
                  id="su-password"
                  type="password"
                  autoComplete="new-password"
                  value={suPassword}
                  onChange={e => setSuPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Min 8 characters"
                  required
                  disabled={loading}
                />
                {suPassword.length > 0 && (
                  <div className="mt-1">
                    <div className="h-1.5 w-full bg-[#e5e1d8] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: strength.width, backgroundColor: strength.color }}
                      />
                    </div>
                    <p className="text-xs mt-1 font-semibold" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <p role="alert" className="text-red-600 text-sm font-medium text-center">
                  {error}
                </p>
              )}
              {successMsg && (
                <p role="status" className="text-[#2d5a27] text-sm font-medium text-center">
                  {successMsg}
                </p>
              )}

              <button
                ref={lastFocusableRef}
                type="submit"
                disabled={loading}
                className={primaryBtn}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  'Create Account →'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
