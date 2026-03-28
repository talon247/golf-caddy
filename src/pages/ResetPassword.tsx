import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()

  const [hasRecoveryToken, setHasRecoveryToken] = useState<boolean | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasRecoveryToken(true)
      }
    })

    // Give the token a moment to arrive via URL hash
    const timer = setTimeout(() => {
      setHasRecoveryToken(prev => (prev === null ? false : prev))
    }, 1500)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full'
  const primaryBtn =
    'w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100'

  // Still waiting for auth state change event
  if (hasRecoveryToken === null) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 bg-[#f5f0e8]">
        <div className="text-[#6b6b6b] text-sm">Verifying link…</div>
      </main>
    )
  }

  // No recovery token found
  if (hasRecoveryToken === false) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 bg-[#f5f0e8]">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">⛳</div>
          <h1 className="text-2xl font-black text-[#2d5a27] mb-2">Link Expired</h1>
          <p className="text-[#6b6b6b] mb-6">This link has expired. Please request a new one.</p>
          <button
            onClick={() => navigate('/')}
            className={primaryBtn}
          >
            Back to sign in
          </button>
        </div>
      </main>
    )
  }

  if (success) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 bg-[#f5f0e8]">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-black text-[#2d5a27] mb-2">Password Updated!</h1>
          <p className="text-[#6b6b6b]">Redirecting…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-col flex-1 items-center justify-center p-6 bg-[#f5f0e8]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">⛳</div>
          <h1 className="text-2xl font-black text-[#2d5a27]">Set New Password</h1>
          <p className="text-[#6b6b6b] mt-1 text-sm">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="new-password" className="text-sm font-semibold text-[#1a1a1a]">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="Min 8 characters"
              required
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-password" className="text-sm font-semibold text-[#1a1a1a]">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Repeat password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p role="alert" className="text-red-600 text-sm font-medium text-center">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className={primaryBtn}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Updating…
              </span>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
