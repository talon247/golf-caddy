import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { syncRoundToSupabase } from '../../lib/sync'
import { useToastStore } from '../../store/toastStore'
import { useAppStore } from '../../store'
import type { Round } from '../../types'

interface Props {
  round: Round
  playerId: string
  playerName: string
  totalStrokes: number
  totalPar: number
}

/** Saved to localStorage before OAuth redirect so migration can run after returning. */
interface PendingConversion {
  playerId: string
  roundId: string
}

const PENDING_KEY = 'guest_conv_pending'

function dismissedKey(playerId: string) {
  return `guest_conv_dismissed_${playerId}`
}

/** Update group_round_players.user_id to link the guest record to the new auth user. */
async function linkGuestPlayer(playerId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('group_round_players')
      .update({ user_id: userId })
      .eq('id', playerId)
  } catch {
    // best-effort; non-blocking
  }
}

/**
 * Run guest → account migration after OAuth signup:
 * 1. Link group_round_players record to new userId
 * 2. Sync the round to Supabase
 * 3. Show success toast
 * 4. Clear the pending key from localStorage
 */
export async function runGuestConversionIfPending(round: Round, userId: string): Promise<void> {
  let pending: PendingConversion | null = null
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw) pending = JSON.parse(raw) as PendingConversion
  } catch {
    return
  }

  if (!pending || pending.roundId !== round.id) return

  // Clear immediately to prevent double-run across hot-reloads
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch { /* ignore */ }

  await linkGuestPlayer(pending.playerId, userId)
  await syncRoundToSupabase(round, userId, 'completed')
  useAppStore.getState().markRoundSynced(round.id)
  useToastStore.getState().addToast('Round saved to your account!')
}

export default function GuestConversionPrompt({
  round,
  playerId,
  playerName,
  totalStrokes,
  totalPar,
}: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissedKey(playerId)) === 'true'
    } catch {
      return false
    }
  })
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // If the user comes back from OAuth in the same session without a full page reload
  // (unlikely but possible with popups), detect sign-in and run migration.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await runGuestConversionIfPending(round, session.user.id)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [round])

  if (dismissed) return null

  function handleDismiss() {
    try {
      localStorage.setItem(dismissedKey(playerId), 'true')
    } catch { /* ignore */ }
    setDismissed(true)
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthStatus('loading')
    setErrorMsg('')

    // Persist pending conversion so migration runs after redirect
    try {
      const pending: PendingConversion = { playerId, roundId: round.id }
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    } catch { /* ignore */ }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.href,
      },
    })

    if (error) {
      setOauthStatus('error')
      setErrorMsg(error.message)
      try {
        localStorage.removeItem(PENDING_KEY)
      } catch { /* ignore */ }
    }
    // On success the browser redirects — no further action needed here
  }

  const diff = totalStrokes - totalPar

  return (
    <div className="rounded-2xl border border-[#2d5a27]/30 bg-[#f5f0e8] overflow-hidden shadow-sm">
      {/* Score banner */}
      <div className="bg-[#2d5a27] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[#f5f0e8] text-base font-black leading-tight">{playerName}</p>
          <p className="text-[#a8c9a0] text-xs">{round.courseName}</p>
        </div>
        {totalStrokes > 0 && (
          <div className="text-right">
            <div className="text-[#f5f0e8] text-2xl font-black leading-none">{totalStrokes}</div>
            <div
              className={`text-sm font-bold ${
                diff > 0 ? 'text-red-300' : diff < 0 ? 'text-green-300' : 'text-[#f5f0e8]'
              }`}
            >
              {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
            </div>
          </div>
        )}
      </div>

      {/* CTA body */}
      <div className="px-4 py-4 flex flex-col gap-3">
        <div>
          <p className="text-[#1a1a1a] text-base font-black">
            Save your round — create a free account
          </p>
          <p className="text-[#6b7280] text-sm mt-0.5">
            Keep your history, track your handicap, and access your stats anywhere.
          </p>
        </div>

        {errorMsg && (
          <p role="alert" className="text-red-600 text-sm font-medium">
            {errorMsg}
          </p>
        )}

        {/* Google */}
        <button
          onClick={() => handleOAuth('google')}
          disabled={oauthStatus === 'loading'}
          className="w-full flex items-center justify-center gap-2 bg-white border border-[#e5e1d8] rounded-xl py-3 text-sm font-semibold text-[#1a1a1a] min-h-[48px] active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Apple */}
        <button
          onClick={() => handleOAuth('apple')}
          disabled={oauthStatus === 'loading'}
          className="w-full flex items-center justify-center gap-2 bg-[#1a1a1a] rounded-xl py-3 text-sm font-semibold text-white min-h-[48px] active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
        >
          <svg width="16" height="19" viewBox="0 0 814 1000" fill="white" aria-hidden="true">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 439.8 0 315.4 0 200.9 0 84.5 54.1 26.1 124.2 26.1c61.6 0 108.1 42.8 144.9 42.8 34.7 0 89.1-46.3 160.7-46.3 27 0 108.2 2.6 163.8 111.6zm-234.5-181.6c25.5 27.3 44.2 65.5 44.2 103.7 0 5.2-.6 10.4-1.3 16.3-51.4-1.9-99.6-28.5-127.3-54.6-22.7-22.1-43.4-60.3-43.4-98.5 0-4.5.6-9.1 1.3-13.6 51.4 1.9 98.5 29.2 126.5 46.7z" />
          </svg>
          Continue with Apple
        </button>

        <button
          onClick={handleDismiss}
          disabled={oauthStatus === 'loading'}
          className="text-sm text-[#6b7280] font-medium min-h-[44px] self-center px-4 active:opacity-70 transition-opacity"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
