import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthModal } from '../components/AuthModal'
import { useAppStore } from '../store'
import type { TournamentType, TournamentStatus } from '../lib/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament RPCs return opaque Json
const db = supabase as unknown as any

const INPUT_CLASS =
  'border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full'

const PRIMARY_BTN =
  'w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100'

interface TournamentInfo {
  id: string
  type: TournamentType
  name: string
  status: TournamentStatus
  memberCount: number
  fieldSize: number | null
  hostName: string | null
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; info: TournamentInfo }
  | { kind: 'already_member'; info: TournamentInfo }
  | { kind: 'success'; tournamentId: string; tournamentType: TournamentType }

async function fetchTournamentByCode(inviteCode: string): Promise<TournamentInfo | null> {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select('id, type, name, status')
    .eq('join_code', inviteCode)
    .single()

  if (error || !tournament) return null

  const [membersRes, configRes, creatorRes] = await Promise.all([
    supabase
      .from('tournament_members')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)
      .is('removed_at', null),
    supabase
      .from('tournament_config')
      .select('field_size')
      .eq('tournament_id', tournament.id)
      .maybeSingle(),
    supabase
      .from('tournament_members')
      .select('user_id, guest_name')
      .eq('tournament_id', tournament.id)
      .eq('role', 'commissioner')
      .maybeSingle(),
  ])

  let hostName: string | null = null
  if (creatorRes.data) {
    if (creatorRes.data.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', creatorRes.data.user_id)
        .single()
      hostName = profile?.display_name ?? null
    } else {
      hostName = creatorRes.data.guest_name ?? null
    }
  }

  return {
    id: tournament.id,
    type: tournament.type as TournamentType,
    name: tournament.name,
    status: tournament.status as TournamentStatus,
    memberCount: membersRes.count ?? 0,
    fieldSize: configRes.data?.field_size ?? null,
    hostName,
  }
}

function TypeBadge({ type }: { type: TournamentType }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
      type === 'league'
        ? 'bg-[#2d5a27]/10 text-[#2d5a27]'
        : 'bg-amber-100 text-amber-800'
    }`}>
      {type === 'league' ? '📅 League' : '🏆 Event'}
    </span>
  )
}

function TournamentCard({ info }: { info: TournamentInfo }) {
  const isFull = info.fieldSize !== null && info.memberCount >= info.fieldSize

  return (
    <div className="bg-white rounded-2xl border border-[#e5e1d8] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-black text-[#1a1a1a] leading-tight">{info.name}</h2>
        <TypeBadge type={info.type} />
      </div>
      {info.hostName && (
        <p className="text-sm text-[#6b7280]">
          Hosted by <span className="font-semibold text-[#1a1a1a]">{info.hostName}</span>
        </p>
      )}
      <div className="flex items-center gap-4 text-sm text-[#6b7280]">
        <span>
          <span className="font-semibold text-[#1a1a1a]">{info.memberCount}</span>
          {info.fieldSize !== null ? `/${info.fieldSize}` : ''} member{info.memberCount !== 1 ? 's' : ''}
        </span>
        {isFull && (
          <span className="text-red-600 font-semibold">Tournament full</span>
        )}
      </div>
    </div>
  )
}

export default function TournamentJoin() {
  const { inviteCode } = useParams<{ inviteCode: string }>()
  const navigate = useNavigate()
  const userId = useAppStore(s => s.userId)
  const isAuthenticated = useAppStore(s => s.isAuthenticated)

  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [guestName, setGuestName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    if (!inviteCode) {
      setPageState({ kind: 'error', message: 'Invalid invite link.' })
      return
    }
    let cancelled = false
    fetchTournamentByCode(inviteCode)
      .then((info) => {
        if (cancelled) return
        if (!info) {
          setPageState({ kind: 'error', message: 'This invite link is invalid or has expired.' })
          return
        }
        if (info.status !== 'active') {
          setPageState({ kind: 'error', message: 'This tournament is no longer accepting new members.' })
          return
        }
        setPageState({ kind: 'ready', info })
      })
      .catch(() => {
        if (!cancelled) {
          setPageState({ kind: 'error', message: 'Failed to load tournament. Check your connection and try again.' })
        }
      })
    return () => { cancelled = true }
  }, [inviteCode])

  // After auth completes, re-check if already member and auto-proceed
  useEffect(() => {
    if (!isAuthenticated || pageState.kind !== 'ready') return
    // Re-check already-member status when auth state changes
    const info = pageState.info
    if (!userId) return
    supabase
      .from('tournament_members')
      .select('id')
      .eq('tournament_id', info.id)
      .eq('user_id', userId)
      .is('removed_at', null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPageState({ kind: 'already_member', info })
        }
      }, () => { /* non-critical */ })
  }, [isAuthenticated, userId, pageState.kind])

  const handleJoin = useCallback(async () => {
    if (!inviteCode) return
    if (pageState.kind !== 'ready') return
    const { info } = pageState

    // League requires auth
    if (info.type === 'league' && !isAuthenticated) {
      setShowAuth(true)
      return
    }

    // Event guest requires a name
    if (info.type === 'event' && !isAuthenticated) {
      if (!guestName.trim()) {
        setJoinError('Please enter your name to join as a guest.')
        return
      }
    }

    // Check if full
    if (info.fieldSize !== null && info.memberCount >= info.fieldSize) {
      setJoinError('This tournament is full.')
      return
    }

    setJoinError(null)
    setJoining(true)

    try {
      const args: { p_invite_code: string; p_guest_name?: string } = {
        p_invite_code: inviteCode,
      }
      if (info.type === 'event' && !isAuthenticated) {
        args.p_guest_name = guestName.trim()
      }

      const { data, error: rpcError } = await db.rpc('join_tournament', args)

      if (rpcError) {
        const msg = rpcError.message ?? ''
        if (msg.includes('already') || msg.includes('member')) {
          setPageState({ kind: 'already_member', info })
          return
        }
        if (msg.includes('full')) {
          setJoinError('This tournament is full.')
          return
        }
        setJoinError('Failed to join. Please try again.')
        return
      }

      const result = data as { tournament_id?: string; error?: string; already_member?: boolean } | null

      if (result?.error) {
        if (result.error.includes('already') || result.already_member) {
          setPageState({ kind: 'already_member', info })
          return
        }
        if (result.error.includes('full')) {
          setJoinError('This tournament is full.')
          return
        }
        setJoinError(result.error)
        return
      }

      const tournamentId = result?.tournament_id ?? info.id
      setPageState({ kind: 'success', tournamentId, tournamentType: info.type })
    } catch {
      setJoinError('Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }, [inviteCode, pageState, isAuthenticated, guestName])

  const navigateToDashboard = useCallback((tournamentId: string, tournamentType: TournamentType) => {
    const path = tournamentType === 'league'
      ? `/tournament/league/${tournamentId}/dashboard`
      : `/tournament/event/${tournamentId}/dashboard`
    navigate(path, { replace: true })
  }, [navigate])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState.kind === 'loading') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-[#2d5a27]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-[#6b7280] text-sm">Loading tournament…</p>
        </div>
      </main>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (pageState.kind === 'error') {
    return (
      <main className="flex flex-col flex-1 max-w-lg mx-auto w-full p-6 gap-6">
        <div className="pt-2">
          <button type="button" onClick={() => navigate('/')} className="text-[#2d5a27] font-semibold">
            ← Home
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 pt-8 text-center">
          <span className="text-5xl">⛳</span>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Tournament Not Found</h1>
          <p className="text-[#6b7280]">{pageState.message}</p>
          <button type="button" onClick={() => navigate('/')} className={PRIMARY_BTN + ' max-w-xs'}>
            Go Home
          </button>
        </div>
      </main>
    )
  }

  // ── Already Member ────────────────────────────────────────────────────────
  if (pageState.kind === 'already_member') {
    const { info } = pageState
    return (
      <main className="flex flex-col flex-1 max-w-lg mx-auto w-full p-6 gap-6">
        <div className="pt-2">
          <button type="button" onClick={() => navigate('/')} className="text-[#2d5a27] font-semibold">
            ← Home
          </button>
        </div>
        <TournamentCard info={info} />
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-4xl">✅</span>
          <p className="text-[#1a1a1a] font-semibold text-lg">You're already a member of this tournament.</p>
          <button
            type="button"
            onClick={() => navigateToDashboard(info.id, info.type)}
            className={PRIMARY_BTN}
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (pageState.kind === 'success') {
    const { tournamentId, tournamentType } = pageState
    return (
      <main className="flex flex-col flex-1 max-w-lg mx-auto w-full p-6 gap-6 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🎉</span>
          <h1 className="text-2xl font-black text-[#1a1a1a]">You're in!</h1>
          <p className="text-[#6b7280]">You've successfully joined the tournament.</p>
          <button
            type="button"
            onClick={() => navigateToDashboard(tournamentId, tournamentType)}
            className={PRIMARY_BTN + ' max-w-xs'}
          >
            View Tournament →
          </button>
        </div>
      </main>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const { info } = pageState
  const isFull = info.fieldSize !== null && info.memberCount >= info.fieldSize
  const isLeague = info.type === 'league'
  const isEvent = info.type === 'event'

  return (
    <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20 p-6 gap-6">
      <div className="pt-2">
        <button type="button" onClick={() => navigate('/')} className="text-[#2d5a27] font-semibold">
          ← Home
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-black text-[#1a1a1a]">Join Tournament</h1>
        <p className="text-[#6b7280] mt-1 text-sm">You've been invited to join</p>
      </div>

      <TournamentCard info={info} />

      {/* League: requires account */}
      {isLeague && (
        <div className="flex flex-col gap-4">
          {!isAuthenticated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              Leagues require a Golf Caddy account to track standings across rounds.
            </div>
          )}

          {isFull ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 text-center font-semibold">
              This league is full and not accepting new members.
            </div>
          ) : (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className={PRIMARY_BTN}
            >
              {joining ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Joining…
                </span>
              ) : isAuthenticated ? (
                'Join League →'
              ) : (
                'Sign In to Join League →'
              )}
            </button>
          )}
        </div>
      )}

      {/* Event: supports guests */}
      {isEvent && (
        <div className="flex flex-col gap-4">
          {!isAuthenticated && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[#6b7280]">Join as a guest or sign in to use your profile.</p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="guest-name" className="text-sm font-medium text-[#1a1a1a]">
                  Your name
                </label>
                <input
                  id="guest-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Jordan Smith"
                  className={INPUT_CLASS}
                  autoComplete="name"
                  maxLength={50}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="text-[#2d5a27] text-sm font-semibold underline text-center"
              >
                Sign in instead
              </button>
            </div>
          )}

          {isFull ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 text-center font-semibold">
              This event is full and not accepting new entries.
            </div>
          ) : (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining || (!isAuthenticated && !guestName.trim())}
              className={PRIMARY_BTN}
            >
              {joining ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Joining…
                </span>
              ) : isAuthenticated ? (
                'Join Event →'
              ) : (
                'Join as Guest →'
              )}
            </button>
          )}
        </div>
      )}

      {joinError && (
        <p role="alert" className="text-red-600 text-sm font-medium text-center">
          {joinError}
        </p>
      )}

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        defaultTab="signin"
      />
    </main>
  )
}
