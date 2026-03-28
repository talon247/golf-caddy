import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store'
import { signOut } from '../lib/auth'
import { AuthModal } from '../components/AuthModal'
import type { Round } from '../types'

function computeStats(rounds: Round[]) {
  const completed = rounds.filter(r => r.completedAt)
  if (completed.length === 0) {
    return { played: 0, bestVsPar: null as number | null, avgVsPar: null as number | null }
  }

  const scoreDiffs = completed.map(round => {
    const played = round.holes.filter(h => h.shots.length > 0 || (h.putts ?? 0) > 0)
    if (played.length === 0) return null
    const totalStrokes = played.reduce(
      (s, h) => s + h.shots.length + (h.putts ?? 0) + (h.penalties ?? 0),
      0,
    )
    const totalPar = played.reduce((s, h) => s + h.par, 0)
    return totalStrokes - totalPar
  }).filter((d): d is number => d !== null)

  if (scoreDiffs.length === 0) {
    return { played: completed.length, bestVsPar: null, avgVsPar: null }
  }

  const best = Math.min(...scoreDiffs)
  const avg = scoreDiffs.reduce((s, d) => s + d, 0) / scoreDiffs.length

  return {
    played: completed.length,
    bestVsPar: best,
    avgVsPar: Math.round(avg * 10) / 10,
  }
}

function formatVsPar(val: number | null): string {
  if (val === null) return '—'
  if (val === 0) return 'E'
  return val > 0 ? `+${val}` : `${val}`
}

function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Profile() {
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const profile = useAppStore(s => s.profile)
  const rounds = useAppStore(s => s.rounds)
  const setAuthState = useAppStore(s => s.setAuthState)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signin')
  const [signingOut, setSigningOut] = useState(false)

  const stats = computeStats(rounds)

  function openSignIn() {
    setAuthModalTab('signin')
    setShowAuthModal(true)
  }

  function openSignUp() {
    setAuthModalTab('signup')
    setShowAuthModal(true)
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      setAuthState(null, null)
    } catch {
      // Sign out anyway client-side
      setAuthState(null, null)
    } finally {
      setSigningOut(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <>
        <main className="flex flex-col flex-1 items-center justify-center p-6 bg-[#f5f0e8] text-center">
          <div className="text-6xl mb-4">⛳</div>
          <h1 className="text-2xl font-black text-[#2d5a27] mb-2">Sign in to save your rounds</h1>
          <p className="text-[#6b6b6b] mb-8 max-w-xs">
            Create an account to sync your rounds across devices, track your handicap, and view your
            round history.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={openSignIn}
              className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform"
            >
              Sign In
            </button>
            <button
              onClick={openSignUp}
              className="w-full border-2 border-[#2d5a27] text-[#2d5a27] rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform bg-transparent"
            >
              Create Account
            </button>
            <Link
              to="/"
              className="text-[#6b6b6b] text-sm font-semibold underline mt-2 text-center"
            >
              Continue as guest →
            </Link>
          </div>
        </main>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultTab={authModalTab}
        />
      </>
    )
  }

  // Signed in view
  const displayName = profile?.displayName ?? 'Golfer'
  const initials = getInitials(profile?.displayName)
  const handicap = profile?.handicapIndex != null ? profile.handicapIndex.toFixed(1) : '—'
  const homeCourse = profile?.homeCourse ?? null

  return (
    <>
      <main className="flex flex-col flex-1 p-6 gap-6 max-w-lg mx-auto w-full bg-[#f5f0e8]">
        {/* Avatar + name + handicap */}
        <div className="flex flex-col items-center pt-4 gap-3">
          <div className="w-20 h-20 rounded-full bg-[#2d5a27] flex items-center justify-center text-white text-2xl font-black shadow-md">
            {initials}
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-[#1a1a1a]">{displayName}</div>
            <div className="text-[#6b6b6b] text-sm mt-0.5">
              Handicap Index: <span className="font-semibold text-[#2d5a27]">{handicap}</span>
            </div>
          </div>
        </div>

        {/* Home course */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e1d8]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b] mb-0.5">
                Home Course
              </div>
              <div className="text-[#1a1a1a] font-semibold">
                {homeCourse ?? (
                  <span className="text-[#6b6b6b] font-normal">Not set</span>
                )}
              </div>
            </div>
            <Link
              to="/courses"
              className="text-[#2d5a27] text-sm font-semibold border border-[#2d5a27] rounded-xl px-3 py-1.5"
            >
              Edit
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e1d8]">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b] mb-3">
            Your Stats
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-black text-[#2d5a27]">{stats.played}</div>
              <div className="text-xs text-[#6b6b6b] mt-0.5">Rounds</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#2d5a27]">{formatVsPar(stats.bestVsPar)}</div>
              <div className="text-xs text-[#6b6b6b] mt-0.5">Best vs Par</div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#2d5a27]">{formatVsPar(stats.avgVsPar)}</div>
              <div className="text-xs text-[#6b6b6b] mt-0.5">Avg vs Par</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            to="/history"
            className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm border border-[#e5e1d8] font-semibold text-[#1a1a1a]"
          >
            <span>View Round History</span>
            <span className="text-[#6b6b6b]">→</span>
          </Link>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full border-2 border-red-400 text-red-500 rounded-xl py-4 text-base font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed bg-transparent"
          >
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultTab={authModalTab}
      />
    </>
  )
}
