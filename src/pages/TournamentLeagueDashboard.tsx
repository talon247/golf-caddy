import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import LeagueStandingsTab from '../components/tournament/LeagueStandingsTab'
import LeagueRoundsTab from '../components/tournament/LeagueRoundsTab'
import LeagueMembersTab from '../components/tournament/LeagueMembersTab'
import LeagueSettingsTab from '../components/tournament/LeagueSettingsTab'
import type { TournamentEvent } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

type Tab = 'standings' | 'rounds' | 'members' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'standings', label: 'Standings' },
  { id: 'rounds', label: 'Rounds' },
  { id: 'members', label: 'Members' },
  { id: 'settings', label: 'Settings' },
]

export default function TournamentLeagueDashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [league, setLeague] = useState<TournamentEvent | null>(null)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('standings')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchLeague() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await db
          .from('tournaments')
          .select('*, tournament_config(*)')
          .eq('id', id)
          .eq('type', 'league')
          .single()

        if (err) throw err
        if (!cancelled) {
          const raw = data as Record<string, unknown>
          setLeague({
            ...(raw as Omit<TournamentEvent, 'config'>),
            config: (raw.tournament_config as TournamentEvent['config']) ?? null,
          })
        }
      } catch {
        if (!cancelled) setError('League not found.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function checkCommissioner() {
      if (!user) { setIsCommissioner(false); return }
      try {
        const { data } = await db
          .from('tournament_members')
          .select('role')
          .eq('tournament_id', id)
          .eq('user_id', user.id)
          .single()
        if (!cancelled) {
          setIsCommissioner(data?.role === 'commissioner' || data?.role === 'host')
        }
      } catch {
        if (!cancelled) setIsCommissioner(false)
      }
    }

    fetchLeague()
    checkCommissioner()

    return () => { cancelled = true }
  }, [id, user])

  const handleLeagueUpdate = useCallback((updated: TournamentEvent) => {
    setLeague(updated)
  }, [])

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/tournament/join/${id}`

  if (loading) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20">
        <div className="text-4xl animate-pulse">🏆</div>
        <p className="text-warm-gray mt-3 font-medium">Loading league…</p>
      </main>
    )
  }

  if (error || !league || !id) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4 text-center">
        <p className="text-warm-gray">{error ?? 'League not found.'}</p>
        <button
          onClick={() => navigate('/')}
          className="py-3 px-6 bg-[#2d5a27] text-white rounded-xl font-semibold min-h-[48px]"
        >
          Back to Home
        </button>
      </main>
    )
  }

  const visibleTabs = isCommissioner ? TABS : TABS.filter((t) => t.id !== 'settings')

  return (
    <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="text-[#2d5a27] font-semibold text-sm mb-2"
        >
          ← Back
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-[#2d5a27] truncate max-w-[70%]">{league.name}</h1>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              league.status === 'archived'
                ? 'bg-gray-100 text-gray-500'
                : league.status === 'completed'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-[#eaf4e8] text-[#2d5a27]'
            }`}
          >
            {league.status === 'archived' ? 'Archived' : league.status === 'completed' ? 'Ended' : 'Active'}
          </span>
        </div>
        {isCommissioner && league.status === 'active' && (
          <button
            onClick={() => navigate(`/group-round/host?tournamentId=${id}&tournamentName=${encodeURIComponent(league.name)}`)}
            className="mt-3 w-full bg-[#2d5a27] text-white rounded-xl py-3 text-sm font-bold min-h-[48px] active:scale-95 transition-transform"
          >
            + Start League Round
          </button>
        )}
      </div>

      {/* Tab bar — horizontally scrollable on narrow screens */}
      <div className="flex border-b border-[#e5e1d8] px-2 mt-1 overflow-x-auto" role="tablist">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 flex-1 py-3 text-sm font-semibold transition-colors whitespace-nowrap px-1 ${
              activeTab === tab.id
                ? 'text-[#2d5a27] border-b-2 border-[#2d5a27]'
                : 'text-warm-gray'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'standings' && <LeagueStandingsTab leagueId={id} />}
      {activeTab === 'rounds' && (
        <LeagueRoundsTab leagueId={id} isCommissioner={isCommissioner} />
      )}
      {activeTab === 'members' && (
        <LeagueMembersTab leagueId={id} inviteUrl={inviteUrl} isCommissioner={isCommissioner} />
      )}
      {activeTab === 'settings' && isCommissioner && (
        <LeagueSettingsTab league={league} onUpdate={handleLeagueUpdate} />
      )}
    </main>
  )
}
