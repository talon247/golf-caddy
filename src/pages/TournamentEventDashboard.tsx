import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EventLeaderboard from '../components/tournament/EventLeaderboard'
import EventScorecards from '../components/tournament/EventScorecards'
import EventField from '../components/tournament/EventField'
import EventSettings from '../components/tournament/EventSettings'
import type { TournamentEvent } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

type Tab = 'leaderboard' | 'scorecards' | 'field' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'scorecards', label: 'Scorecards' },
  { id: 'field', label: 'Field' },
  { id: 'settings', label: 'Settings' },
]

export default function TournamentEventDashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<TournamentEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function fetchEvent() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await db
          .from('tournaments')
          .select('*, tournament_config(*)')
          .eq('id', id)
          .eq('type', 'event')
          .single()

        if (err) throw err
        if (!cancelled) {
          const raw = data as Record<string, unknown>
          setEvent({
            ...(raw as Omit<TournamentEvent, 'config'>),
            config: (raw.tournament_config as TournamentEvent['config']) ?? null,
          })
        }
      } catch {
        if (!cancelled) setError('Event not found.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEvent()
    return () => { cancelled = true }
  }, [id])

  const handleEventUpdate = useCallback((updated: TournamentEvent) => {
    setEvent(updated)
  }, [])

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/tournament/join/${id}`

  if (loading) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20">
        <div className="text-4xl animate-pulse">🏆</div>
        <p className="text-warm-gray mt-3 font-medium">Loading event…</p>
      </main>
    )
  }

  if (error || !event || !id) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4 text-center">
        <p className="text-warm-gray">{error ?? 'Event not found.'}</p>
        <button
          onClick={() => navigate('/')}
          className="py-3 px-6 bg-[#2d5a27] text-white rounded-xl font-semibold min-h-[48px]"
        >
          Back to Home
        </button>
      </main>
    )
  }

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
          <h1 className="text-xl font-black text-[#2d5a27] truncate max-w-[70%]">{event.name}</h1>
          {event.status === 'completed' && (
            <span className="text-xs bg-[#eaf4e8] text-[#2d5a27] font-semibold px-2 py-1 rounded-full">
              Finalized
            </span>
          )}
          {event.status === 'active' && (
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded-full">
              Live
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#e5e1d8] px-2 mt-1" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
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
      {activeTab === 'leaderboard' && <EventLeaderboard tournamentId={id} />}
      {activeTab === 'scorecards' && <EventScorecards tournamentId={id} />}
      {activeTab === 'field' && (
        <EventField
          tournamentId={id}
          fieldSize={event.config?.field_size ?? null}
          inviteUrl={inviteUrl}
        />
      )}
      {activeTab === 'settings' && (
        <EventSettings event={event} onUpdate={handleEventUpdate} />
      )}
    </main>
  )
}
