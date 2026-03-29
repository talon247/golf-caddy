import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'
import { AuthModal } from '../components/AuthModal'
import type { SeasonStatus } from '../lib/database.types'

const PRIMARY_BTN =
  'w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100'

interface SeasonInfo {
  id: string
  name: string
  status: SeasonStatus
  memberCount: number
  creatorName: string | null
  startDate: string | null
  endDate: string | null
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; info: SeasonInfo }
  | { kind: 'already_member'; info: SeasonInfo }
  | { kind: 'success'; seasonId: string; seasonName: string }

async function fetchSeasonInfo(seasonId: string): Promise<SeasonInfo | null> {
  const { data: season, error } = await supabase
    .from('seasons')
    .select('id, name, status, start_date, end_date, creator_id')
    .eq('id', seasonId)
    .maybeSingle()

  if (error || !season) return null

  const [membersRes, creatorRes] = await Promise.all([
    supabase
      .from('season_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('season_id', seasonId)
      .is('left_at', null),
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', season.creator_id)
      .maybeSingle(),
  ])

  return {
    id: season.id,
    name: season.name,
    status: season.status,
    memberCount: membersRes.count ?? 0,
    creatorName: creatorRes.data?.display_name ?? null,
    startDate: season.start_date,
    endDate: season.end_date,
  }
}

function StatusBadge({ status }: { status: SeasonStatus }) {
  const config: Record<SeasonStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    active: { label: 'Active', className: 'bg-[#2d5a27]/10 text-[#2d5a27]' },
    completed: { label: 'Completed', className: 'bg-amber-100 text-amber-800' },
    archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500' },
  }
  const c = config[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.className}`}>
      {c.label}
    </span>
  )
}

function SeasonCard({ info }: { info: SeasonInfo }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e1d8] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-black text-[#1a1a1a] leading-tight">{info.name}</h2>
        <StatusBadge status={info.status} />
      </div>
      {info.creatorName && (
        <p className="text-sm text-[#6b7280]">
          Created by <span className="font-semibold text-[#1a1a1a]">{info.creatorName}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-4 text-sm text-[#6b7280]">
        <span>
          <span className="font-semibold text-[#1a1a1a]">{info.memberCount}</span>{' '}
          member{info.memberCount !== 1 ? 's' : ''}
        </span>
        {info.startDate && (
          <span>
            Starts <span className="font-semibold text-[#1a1a1a]">{info.startDate}</span>
          </span>
        )}
        {info.endDate && (
          <span>
            Ends <span className="font-semibold text-[#1a1a1a]">{info.endDate}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default function SeasonJoin() {
  const { id: seasonId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const userId = useAppStore(s => s.userId)

  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    if (!seasonId) {
      setPageState({ kind: 'error', message: 'Invalid invite link.' })
      return
    }
    let cancelled = false
    fetchSeasonInfo(seasonId)
      .then(info => {
        if (cancelled) return
        if (!info) {
          setPageState({ kind: 'error', message: 'This invite link is invalid or the season no longer exists.' })
          return
        }
        if (info.status === 'archived') {
          setPageState({ kind: 'error', message: 'This season has been archived and is no longer accepting members.' })
          return
        }
        setPageState({ kind: 'ready', info })
      })
      .catch(() => {
        if (!cancelled) {
          setPageState({ kind: 'error', message: 'Failed to load season. Check your connection and try again.' })
        }
      })
    return () => { cancelled = true }
  }, [seasonId])

  // Re-check membership when auth changes
  useEffect(() => {
    if (!isAuthenticated || !userId || pageState.kind !== 'ready') return
    const { info } = pageState
    supabase
      .from('season_members')
      .select('user_id')
      .eq('season_id', info.id)
      .eq('user_id', userId)
      .is('left_at', null)
      .maybeSingle()
      .then(
        ({ data }) => { if (data) setPageState({ kind: 'already_member', info }) },
        () => { /* non-critical */ }
      )
  }, [isAuthenticated, userId, pageState.kind])

  const handleJoin = useCallback(async () => {
    if (!seasonId || pageState.kind !== 'ready') return
    const { info } = pageState

    if (!isAuthenticated) {
      setShowAuth(true)
      return
    }

    setJoinError(null)
    setJoining(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('join_season', {
        p_season_id: seasonId,
      })

      if (rpcError) {
        const msg = rpcError.message ?? ''
        if (msg.toLowerCase().includes('already')) {
          setPageState({ kind: 'already_member', info })
          return
        }
        setJoinError('Failed to join. Please try again.')
        return
      }

      const result = data as { error?: string; already_member?: boolean } | null
      if (result?.error) {
        if (result.error.toLowerCase().includes('already') || result.already_member) {
          setPageState({ kind: 'already_member', info })
          return
        }
        setJoinError(result.error)
        return
      }

      setPageState({ kind: 'success', seasonId, seasonName: info.name })
    } catch {
      setJoinError('Something went wrong. Please try again.')
    } finally {
      setJoining(false)
    }
  }, [seasonId, pageState, isAuthenticated])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState.kind === 'loading') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-[#2d5a27]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-[#6b7280] text-sm">Loading season…</p>
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
          <h1 className="text-2xl font-black text-[#1a1a1a]">Season Not Found</h1>
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
        <SeasonCard info={info} />
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-4xl">✅</span>
          <p className="text-[#1a1a1a] font-semibold text-lg">You're already a member of this season.</p>
          <button
            type="button"
            onClick={() => navigate(`/season/${info.id}`)}
            className={PRIMARY_BTN}
          >
            View Season →
          </button>
        </div>
      </main>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (pageState.kind === 'success') {
    const { seasonId: sid, seasonName } = pageState
    return (
      <main className="flex flex-col flex-1 max-w-lg mx-auto w-full p-6 gap-6 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🎉</span>
          <h1 className="text-2xl font-black text-[#1a1a1a]">You're in!</h1>
          <p className="text-[#6b7280]">You've joined <span className="font-semibold text-[#1a1a1a]">{seasonName}</span>.</p>
          <button
            type="button"
            onClick={() => navigate(`/season/${sid}`)}
            className={PRIMARY_BTN + ' max-w-xs'}
          >
            View Season →
          </button>
        </div>
      </main>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const { info } = pageState
  const isCompleted = info.status === 'completed'

  return (
    <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20 p-6 gap-6">
      <div className="pt-2">
        <button type="button" onClick={() => navigate('/')} className="text-[#2d5a27] font-semibold">
          ← Home
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-black text-[#1a1a1a]">Join Season</h1>
        <p className="text-[#6b7280] mt-1 text-sm">You've been invited to join</p>
      </div>

      <SeasonCard info={info} />

      {!isAuthenticated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          A Golf Caddy account is required to join a season.
        </div>
      )}

      {isCompleted ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 text-center font-semibold">
          This season has ended and is no longer accepting new members.
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
            'Join Season →'
          ) : (
            'Sign In to Join →'
          )}
        </button>
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
