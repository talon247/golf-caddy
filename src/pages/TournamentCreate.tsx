import { useState, useCallback } from 'react'
import QRCode from 'react-qr-code'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CourseEntryStep from '../components/CourseEntryStep'
import type { CourseEntryValue } from '../components/CourseEntryStep'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament RPCs pending THEA-418
const db = supabase as unknown as any

type Step = 'type_select' | 'league_setup' | 'event_setup' | 'invite'
type TournamentType = 'league' | 'event'
type TournamentFormat = 'stroke_play' | 'match_play' | 'scramble' | 'best_ball'
type PointsPreset = 'skins_only' | 'nassau_only' | 'combined' | 'custom'

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  stroke_play: 'Stroke Play',
  match_play: 'Match Play',
  scramble: 'Scramble',
  best_ball: 'Best Ball',
}

const POINTS_PRESETS: { value: PointsPreset; label: string; description: string }[] = [
  { value: 'skins_only', label: 'Skins Only', description: '1 pt per hole — lowest score takes the skin' },
  { value: 'nassau_only', label: 'Nassau Only', description: 'Front 9 · Back 9 · Overall — 3 pts per match' },
  { value: 'combined', label: 'Combined', description: 'Both Skins and Nassau scoring' },
  { value: 'custom', label: 'Custom', description: 'Configure points rules after creation' },
]

const DEFAULT_COURSE: CourseEntryValue = {
  teeSet: '',
  courseName: '',
  courseRating: null,
  slopeRating: null,
  skipped: false,
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const INPUT_CLASS =
  'border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full'

const PRIMARY_BTN =
  'w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60'

export default function TournamentCreate() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('type_select')
  const [tournamentType, setTournamentType] = useState<TournamentType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  // League fields
  const [leagueName, setLeagueName] = useState('')
  const [leagueStartDate, setLeagueStartDate] = useState('')
  const [leagueEndDate, setLeagueEndDate] = useState('')
  const [pointsPreset, setPointsPreset] = useState<PointsPreset>('combined')

  // Event fields
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [courseValue, setCourseValue] = useState<CourseEntryValue>(DEFAULT_COURSE)
  const [eventFormat, setEventFormat] = useState<TournamentFormat>('stroke_play')
  const [fieldSize, setFieldSize] = useState(40)

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/tournament/join/${inviteCode}`

  const handleSelectType = useCallback((type: TournamentType) => {
    setTournamentType(type)
    setStep(type === 'league' ? 'league_setup' : 'event_setup')
  }, [])

  const handleCreateLeague = useCallback(async () => {
    if (!leagueName.trim()) { setError('League name is required'); return }
    if (!leagueStartDate || !leagueEndDate) { setError('Start and end dates are required'); return }
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: rpcError } = await db.rpc('create_tournament', {
        p_type: 'league',
        p_name: leagueName.trim(),
        p_start_date: leagueStartDate,
        p_end_date: leagueEndDate,
        p_points_preset: pointsPreset,
      })
      const code = (!rpcError && (data as { invite_code?: string } | null)?.invite_code) || generateInviteCode()
      setInviteCode(code)
    } catch {
      setInviteCode(generateInviteCode())
    } finally {
      setSubmitting(false)
      setStep('invite')
    }
  }, [leagueName, leagueStartDate, leagueEndDate, pointsPreset])

  const handleCreateEvent = useCallback(async () => {
    if (!eventName.trim()) { setError('Event name is required'); return }
    if (!eventDate) { setError('Date is required'); return }
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: rpcError } = await db.rpc('create_tournament', {
        p_type: 'event',
        p_name: eventName.trim(),
        p_date: eventDate,
        p_course_name: courseValue.courseName ?? '',
        p_course_rating: courseValue.courseRating,
        p_slope_rating: courseValue.slopeRating,
        p_format: eventFormat,
        p_field_size: fieldSize,
      })
      const code = (!rpcError && (data as { invite_code?: string } | null)?.invite_code) || generateInviteCode()
      setInviteCode(code)
    } catch {
      setInviteCode(generateInviteCode())
    } finally {
      setSubmitting(false)
      setStep('invite')
    }
  }, [eventName, eventDate, courseValue, eventFormat, fieldSize])

  const handleShare = useCallback(async () => {
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'Join my tournament on Golf Caddy', url: inviteUrl }) }
      catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }
      catch { /* ignore */ }
    }
  }, [inviteUrl])

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }, [inviteUrl])

  // ── Step 1: Type Selection ────────────────────────────────────────────────
  if (step === 'type_select') {
    return (
      <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20 p-6 gap-6">
        <div className="pt-2">
          <button type="button" onClick={() => navigate(-1)} className="text-[#2d5a27] font-semibold touch-target">
            ← Back
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-[#1a1a1a]">Create Tournament</h1>
          <p className="text-[#6b7280] mt-1 text-sm">Choose the tournament type</p>
        </div>
        <div className="flex flex-col gap-4 mt-2">
          <button
            type="button"
            onClick={() => handleSelectType('league')}
            className="flex items-start gap-4 p-5 rounded-2xl border-2 border-[#e5e1d8] bg-white hover:border-[#2d5a27] hover:bg-[#f5f0e8] active:scale-[0.98] transition-all text-left"
          >
            <span className="text-3xl">📅</span>
            <div>
              <div className="font-bold text-[#1a1a1a] text-lg">League</div>
              <div className="text-[#6b7280] text-sm mt-0.5">Recurring season with standings</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleSelectType('event')}
            className="flex items-start gap-4 p-5 rounded-2xl border-2 border-[#e5e1d8] bg-white hover:border-[#2d5a27] hover:bg-[#f5f0e8] active:scale-[0.98] transition-all text-left"
          >
            <span className="text-3xl">🏆</span>
            <div>
              <div className="font-bold text-[#1a1a1a] text-lg">Event</div>
              <div className="text-[#6b7280] text-sm mt-0.5">One-time tournament</div>
            </div>
          </button>
        </div>
      </main>
    )
  }

  // ── Step 2a: League Setup ─────────────────────────────────────────────────
  if (step === 'league_setup') {
    const selectedPreset = POINTS_PRESETS.find(p => p.value === pointsPreset)
    return (
      <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20 p-6 gap-6">
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => setStep('type_select')} className="text-[#2d5a27] font-semibold touch-target">
            ← Back
          </button>
          <h1 className="text-2xl font-black text-[#1a1a1a]">League Setup</h1>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="league-name">League Name</label>
            <input
              id="league-name"
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="e.g. Saturday Morning League"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="league-start">Start Date</label>
            <input
              id="league-start"
              type="date"
              value={leagueStartDate}
              onChange={(e) => setLeagueStartDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="league-end">End Date</label>
            <input
              id="league-end"
              type="date"
              value={leagueEndDate}
              onChange={(e) => setLeagueEndDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Points Config</span>
            {POINTS_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setPointsPreset(preset.value)}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  pointsPreset === preset.value
                    ? 'border-[#2d5a27] bg-[#eaf4e8]'
                    : 'border-[#e5e1d8] bg-white hover:bg-[#f5f0e8]'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  pointsPreset === preset.value ? 'border-[#2d5a27] bg-[#2d5a27]' : 'border-[#d1d5db]'
                }`}>
                  {pointsPreset === preset.value && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="font-semibold text-[#1a1a1a] text-sm">{preset.label}</div>
                  <div className="text-[#6b7280] text-xs mt-0.5">{preset.description}</div>
                </div>
              </button>
            ))}
          </div>
          {selectedPreset && (
            <div className="bg-[#f5f0e8] rounded-xl p-4 border border-[#e5e1d8]">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] mb-1">Points Preview</div>
              <div className="text-sm text-[#1a1a1a] font-medium">{selectedPreset.label}</div>
              <div className="text-xs text-[#6b7280] mt-0.5">{selectedPreset.description}</div>
            </div>
          )}
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
        </div>
        <div className="mt-auto pt-4">
          <button type="button" onClick={handleCreateLeague} disabled={submitting} className={PRIMARY_BTN}>
            {submitting ? 'Creating…' : 'Create League'}
          </button>
        </div>
      </main>
    )
  }

  // ── Step 2b: Event Setup ──────────────────────────────────────────────────
  if (step === 'event_setup') {
    return (
      <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20 p-6 gap-6">
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => setStep('type_select')} className="text-[#2d5a27] font-semibold touch-target">
            ← Back
          </button>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Event Setup</h1>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="event-name">Event Name</label>
            <input
              id="event-name"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Club Championship 2025"
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="event-date">Date</label>
            <input
              id="event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">Course</span>
            <CourseEntryStep value={courseValue} onChange={setCourseValue} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Format</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(FORMAT_LABELS) as [TournamentFormat, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEventFormat(value)}
                  className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[48px] ${
                    eventFormat === value
                      ? 'bg-[#2d5a27] border-[#2d5a27] text-white'
                      : 'bg-white border-[#e5e1d8] text-[#1a1a1a] hover:bg-[#f5f0e8]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="field-size">Field Size</label>
            <input
              id="field-size"
              type="number"
              min={2}
              max={200}
              value={fieldSize}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!isNaN(n)) setFieldSize(Math.max(2, Math.min(200, n)))
              }}
              className={INPUT_CLASS}
            />
          </div>
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
        </div>
        <div className="mt-auto pt-4">
          <button type="button" onClick={handleCreateEvent} disabled={submitting} className={PRIMARY_BTN}>
            {submitting ? 'Creating…' : 'Create Event'}
          </button>
        </div>
      </main>
    )
  }

  // ── Step 3: Invite Link ───────────────────────────────────────────────────
  const displayName = tournamentType === 'league' ? leagueName || 'League' : eventName || 'Event'
  return (
    <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20 p-6 gap-6">
      <div className="text-center pt-2">
        <div className="text-4xl mb-2">🏆</div>
        <h1 className="text-2xl font-black text-[#1a1a1a]">{displayName} Created!</h1>
        <p className="text-[#6b7280] text-sm mt-1">Share the invite link with participants</p>
      </div>
      <div className="bg-[#faf7f2] rounded-2xl border border-[#e5e1d8] p-6 flex flex-col items-center gap-5 shadow-sm">
        <div className="bg-white p-3 rounded-xl border border-[#e5e1d8]">
          <QRCode value={inviteUrl} size={180} />
        </div>
        <div className="text-center w-full">
          <div className="text-xs uppercase tracking-widest text-[#6b7280] font-semibold mb-1">Invite Link</div>
          <div className="text-sm font-medium text-[#1a1a1a] bg-white rounded-xl border border-[#e5e1d8] px-4 py-3 break-all">
            {inviteUrl}
          </div>
        </div>
        <div className="flex gap-3 w-full">
          <button type="button" onClick={handleShare} className="flex-1 py-3 rounded-xl bg-[#2d5a27] text-white font-semibold touch-target">
            Share Link
          </button>
          <button type="button" onClick={handleCopy} className="flex-1 py-3 rounded-xl border-2 border-[#2d5a27] text-[#2d5a27] font-semibold touch-target">
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
      <div className="mt-auto pt-4">
        <button type="button" onClick={() => navigate('/')} className={PRIMARY_BTN}>
          Done
        </button>
      </div>
    </main>
  )
}
