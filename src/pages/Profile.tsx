import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store'
import { signOut } from '../lib/auth'
import { fetchProfile, syncClubs, migrateLocalRounds, updateProfile } from '../lib/sync'
import { AuthModal } from '../components/AuthModal'
import { UsernameSetup } from '../components/UsernameSetup'
import { CANNY_WISH_LIST_URL } from '../lib/config'
import type { Round } from '../types'

function computeStats(rounds: Round[]) {
  const completed = rounds.filter(r => r.completedAt != null)
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
  const userId = useAppStore(s => s.userId)
  const profile = useAppStore(s => s.profile)
  const rounds = useAppStore(s => s.rounds)
  const clubBag = useAppStore(s => s.clubBag)
  const setAuthState = useAppStore(s => s.setAuthState)
  const setProfile = useAppStore(s => s.setProfile)

  const syncStatus = useAppStore(s => s.syncStatus)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signin')
  const [signingOut, setSigningOut] = useState(false)
  const [showSyncBanner, setShowSyncBanner] = useState(false)
  const [syncingLocal, setSyncingLocal] = useState(false)
  const [showUsernameSetup, setShowUsernameSetup] = useState(false)
  const [editingHomeCourse, setEditingHomeCourse] = useState(false)
  const [homeCourseInput, setHomeCourseInput] = useState('')
  const [savingHomeCourse, setSavingHomeCourse] = useState(false)

  // THEA-139: Fetch profile from Supabase on mount (when signed in)
  // THEA-140: Trigger club bag sync once when authenticated
  useEffect(() => {
    if (!isAuthenticated || !userId) return

    let cancelled = false

    fetchProfile(userId)
      .then(remoteProfile => {
        if (cancelled) return
        if (remoteProfile) {
          setProfile(remoteProfile)
        }
      })
      .catch(err => console.error('[Profile] fetchProfile failed:', err))

    // Fire-and-forget club sync
    syncClubs(userId, clubBag).catch(err =>
      console.error('[Profile] syncClubs failed:', err),
    )

    // Show sync banner if user signed in and has local rounds and hasn't declined/completed migration
    try {
      const migrationCompleted = localStorage.getItem('migration_completed') === 'true'
      const migrationDeclined = localStorage.getItem('migration_declined') === 'true'
      if (!migrationCompleted && !migrationDeclined) {
        const unsyncedCount = rounds.filter(
          r => r.completedAt != null &&
            syncStatus[r.id] !== 'synced' &&
            syncStatus[r.id] !== 'pending',
        ).length
        if (unsyncedCount > 0) {
          setShowSyncBanner(true)
        }
      }
    } catch { /* ignore */ }

    return () => { cancelled = true }
  }, [isAuthenticated, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSyncNow() {
    if (!userId) return
    setSyncingLocal(true)
    const unsyncedRounds = rounds.filter(
      r => r.completedAt != null &&
        syncStatus[r.id] !== 'synced' &&
        syncStatus[r.id] !== 'pending',
    )
    const { failed } = await migrateLocalRounds(userId, unsyncedRounds)
    setSyncingLocal(false)
    setShowSyncBanner(false)
    if (failed === 0) {
      try {
        localStorage.setItem('migration_completed', 'true')
      } catch { /* ignore */ }
    }
  }

  function handleUsernameSet(username: string) {
    if (profile) setProfile({ ...profile, username })
    setShowUsernameSetup(false)
  }

  async function handleHomeCourseEdit() {
    setHomeCourseInput(profile?.homeCourse ?? '')
    setEditingHomeCourse(true)
  }

  async function handleHomeCourseSave() {
    if (!userId || !profile) return
    const trimmed = homeCourseInput.trim()
    setSavingHomeCourse(true)
    try {
      await updateProfile(userId, { homeCourse: trimmed || undefined })
      setProfile({ ...profile, homeCourse: trimmed || undefined })
      setEditingHomeCourse(false)
    } catch {
      // save failed — input stays open so user can retry
    } finally {
      setSavingHomeCourse(false)
    }
  }

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
        <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 bg-[#f5f0e8] text-center">
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

  const unsyncedCount = rounds.filter(
    r => r.completedAt != null &&
      syncStatus[r.id] !== 'synced' &&
      syncStatus[r.id] !== 'pending',
  ).length

  return (
    <>
      <main className="flex flex-col flex-1 p-6 pb-20 gap-6 max-w-lg mx-auto w-full bg-[#f5f0e8]">
        {/* Post-sign-in sync banner */}
        {showSyncBanner && unsyncedCount > 0 && (
          <div className="bg-[#2d5a27]/10 border border-[#2d5a27]/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-[#2d5a27] font-semibold flex-1">
              You have {unsyncedCount} local round{unsyncedCount !== 1 ? 's' : ''}. Sync them to your account?
            </p>
            <button
              onClick={handleSyncNow}
              disabled={syncingLocal}
              className="bg-[#2d5a27] text-white rounded-xl px-4 py-2 text-sm font-bold active:scale-95 transition-transform disabled:opacity-60 shrink-0"
            >
              {syncingLocal ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        )}

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
            {profile?.username ? (
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <span className="text-[#6b6b6b] text-sm">@{profile.username}</span>
                <button
                  onClick={() => setShowUsernameSetup(true)}
                  aria-label="Edit username"
                  className="text-[#6b6b6b] hover:text-[#2d5a27] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 max-w-xs mx-auto">
                <p className="text-sm text-amber-800">Set a username so friends can find you</p>
                <button
                  onClick={() => setShowUsernameSetup(true)}
                  className="text-sm font-semibold text-[#2d5a27] underline shrink-0"
                >
                  Set Username
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Home course */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e1d8]">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b] mb-0.5">
            Home Course
          </div>
          {editingHomeCourse ? (
            <div className="flex flex-col gap-2 mt-1">
              <input
                type="text"
                value={homeCourseInput}
                onChange={e => setHomeCourseInput(e.target.value)}
                placeholder="e.g. Pine Valley Golf Club"
                autoFocus
                className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleHomeCourseSave()
                  if (e.key === 'Escape') setEditingHomeCourse(false)
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleHomeCourseSave}
                  disabled={savingHomeCourse}
                  className="flex-1 bg-[#2d5a27] text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-transform disabled:opacity-60"
                >
                  {savingHomeCourse ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingHomeCourse(false)}
                  disabled={savingHomeCourse}
                  className="flex-1 border border-[#e5e1d8] text-[#6b6b6b] rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-transform disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-[#1a1a1a] font-semibold">
                {homeCourse ?? (
                  <span className="text-[#6b6b6b] font-normal">Not set</span>
                )}
              </div>
              <button
                onClick={handleHomeCourseEdit}
                className="text-[#2d5a27] text-sm font-semibold border border-[#2d5a27] rounded-xl px-3 py-1.5 active:scale-95 transition-transform"
              >
                Edit
              </button>
            </div>
          )}
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

        {/* Canny wish list link */}
        <a
          href={CANNY_WISH_LIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-4 py-3 rounded-xl border border-[#e5e1d8] bg-white text-sm text-[#2d5a27] font-semibold"
        >
          <span>💡 Vote on what we build next</span>
          <span className="text-[#6b6b6b]">→</span>
        </a>

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

      {showUsernameSetup && userId && (
        <UsernameSetup userId={userId} onComplete={handleUsernameSet} />
      )}
    </>
  )
}
