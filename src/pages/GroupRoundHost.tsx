import { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'react-qr-code'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useAppStore } from '../store'
import ParGridEditor from '../components/ParGridEditor'
import SideGameConfigStep from '../components/group-round/SideGameConfig'
import { saveGroupRoundRecovery } from '../storage'
import { searchCourses, getCourseDetails } from '../lib/handicap/courseApi'
import { saveSideGameConfig } from '../lib/sideGames/config'
import type { GolfApiCourse, TeeSet } from '../lib/handicap/courseApi'
import type { SideGameConfig } from '../types'

function generateRoomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

export default function GroupRoundHost() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tournamentName = searchParams.get('tournamentName')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [roomCode, setRoomCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [groupRoundId, setGroupRoundId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'lobby' | 'setup' | 'side_games'>('lobby')
  const [hostName, setHostName] = useState('')
  const [spectatorsEnabled, setSpectatorsEnabled] = useState(false)
  const [spectatorSideGamesVisible, setSpectatorSideGamesVisible] = useState(false)
  const [spectatorSettingsSaving, setSpectatorSettingsSaving] = useState(false)
  const [courseName, setCourseName] = useState('')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)
  const [pars, setPars] = useState<number[]>(Array(18).fill(4))
  const [submitting, setSubmitting] = useState(false)

  // Course search state
  const [courseRating, setCourseRating] = useState<number | null>(null)
  const [slopeRating, setSlopeRating] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GolfApiCourse[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [teeSets, setTeeSets] = useState<TeeSet[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const createdRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const setGroupRound = useGroupRoundStore((s) => s.setGroupRound)
  const setSideGameConfig = useGroupRoundStore((s) => s.setSideGameConfig)
  const setTournamentContext = useGroupRoundStore((s) => s.setTournamentContext)
  const resetLeaderboard = useLeaderboardStore((s) => s.reset)
  const addRound = useAppStore((s) => s.addRound)
  const setActiveRoundId = useAppStore((s) => s.setActiveRoundId)

  useEffect(() => {
    if (createdRef.current) return
    createdRef.current = true

    // Capture tournament context from URL at mount time (stable, won't change)
    const initTournamentId = new URLSearchParams(window.location.search).get('tournamentId')
    const initTournamentName = new URLSearchParams(window.location.search).get('tournamentName')
    if (initTournamentId) {
      setTournamentContext(initTournamentId, initTournamentName)
    }

    async function create() {
      let code = generateRoomCode()
      let attempts = 0

      const { data: { session } } = await supabase.auth.getSession()

      while (attempts < 5) {
        const { data, error } = await supabase
          .from('group_rounds')
          .insert({
            room_code: code,
            host_name: hostName.trim() || 'Host',
            host_user_id: session?.user?.id ?? null,
          })
          .select('id')
          .single()

        if (!error) {
          const id = (data as { id: string } | null)?.id ?? null
          setRoomCode(code)
          setGroupRoundId(id)
          if (id) {
            saveGroupRoundRecovery({ groupRoundId: id, roomCode: code })
            // Set up realtime channel so host can broadcast side_game_config later
            channelRef.current = supabase.channel(`round:${id}`)
            channelRef.current.subscribe()
          }
          setState('ready')
          return
        }

        if (error.code === '23505') {
          // Collision — try new code
          code = generateRoomCode()
          attempts++
        } else {
          // Fallback: work offline with local-only round
          setRoomCode(code)
          setGroupRoundId(null)
          setState('ready')
          return
        }
      }

      // Last resort: local only
      setRoomCode(code)
      setGroupRoundId(null)
      setState('ready')
    }

    create().catch(() => {
      const fallbackCode = generateRoomCode()
      setRoomCode(fallbackCode)
      setState('ready')
    })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [setTournamentContext]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once; setTournamentContext is stable

  // Debounced course search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      setSearching(true)
      try {
        const courses = await searchCourses(searchQuery, abortRef.current.signal)
        setSearchResults(courses)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  const handleSelectCourse = useCallback(async (course: GolfApiCourse) => {
    setSelectedCourseId(course.id)
    setSearchResults([])
    setTeeSets([])
    setLoadingDetails(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    try {
      const details = await getCourseDetails(course.id, abortRef.current.signal)
      const maleTees = details.tees?.male ?? []
      const femaleTees = details.tees?.female ?? []
      setTeeSets(maleTees.length > 0 ? maleTees : femaleTees)
      // Pre-fill course name from API
      setCourseName(`${course.club_name}${course.course_name ? ' – ' + course.course_name : ''}`)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // On error, user can still type manually
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  const handleSelectTeeSet = useCallback((ts: TeeSet) => {
    setCourseRating(ts.course_rating)
    setSlopeRating(ts.slope_rating)
    // Auto-fill holeCount and pars from tee set
    const holes = ts.number_of_holes === 9 ? 9 : 18
    setHoleCount(holes as 9 | 18)
    if (ts.holes && ts.holes.length > 0) {
      const newPars = Array(18).fill(4)
      ts.holes.slice(0, holes).forEach((h, i) => {
        newPars[i] = h.par
      })
      setPars(newPars)
    }
  }, [])

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/group-round/join/${roomCode}`

  // ── Start the round (called from SideGameConfigStep) ────────────────────
  const handleStartRound = useCallback(async (sideGameCfg: SideGameConfig) => {
    setSubmitting(true)
    try {
      if (groupRoundId) {
        await supabase.rpc('start_group_round', {
          p_group_round_id: groupRoundId,
          p_course_name: courseName.trim() || 'Group Round',
          p_hole_count: holeCount,
          p_pars: pars.slice(0, holeCount),
          p_course_rating: courseRating ?? undefined,
          p_slope_rating: slopeRating ?? undefined,
        })

        // Save side game config to Supabase (non-fatal on error)
        try {
          await saveSideGameConfig(groupRoundId, sideGameCfg)
        } catch {
          // Config save failed — round still starts
        }

        // Broadcast config to all players so they can initialize their side game state
        if (channelRef.current) {
          try {
            await channelRef.current.send({
              type: 'broadcast',
              event: 'side_game_config',
              payload: sideGameCfg,
            })
          } catch {
            // Non-fatal — players can fetch config from DB on join
          }
        }
      }

      setSideGameConfig(sideGameCfg)

      const id = crypto.randomUUID()
      addRound({
        id,
        courseName: courseName.trim() || 'Group Round',
        tees: '',
        playerName: hostName.trim() || 'Host',
        holeCount,
        startedAt: Date.now(),
        holes: Array.from({ length: holeCount }, (_, i) => ({
          number: i + 1,
          par: pars[i] ?? 4,
          shots: [],
        })),
        courseRating: courseRating ?? undefined,
        slopeRating: slopeRating ?? undefined,
      })
      setActiveRoundId(id)

      // Reset leaderboard so prior rounds don't bleed in
      resetLeaderboard()
      setGroupRound({
        id: groupRoundId ?? crypto.randomUUID(),
        roomCode,
        status: 'active',
        hostUserId: null,
        expiresAt: '',
        createdAt: new Date().toISOString(),
      })

      navigate('/round')
    } finally {
      setSubmitting(false)
    }
  }, [groupRoundId, courseName, holeCount, pars, courseRating, slopeRating, addRound, setActiveRoundId, setGroupRound, setSideGameConfig, roomCode, navigate, hostName, resetLeaderboard])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [joinUrl])

  const handleShare = useCallback(async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Join my round on Golf Caddy', url: joinUrl })
      } catch { /* user cancelled or error */ }
    } else {
      // Fallback: copy link
      try {
        await navigator.clipboard.writeText(joinUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch { /* ignore */ }
    }
  }, [joinUrl])

  const spectatorUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/watch/${roomCode}`

  const handleSpectatorToggle = useCallback(async (enabled: boolean) => {
    setSpectatorsEnabled(enabled)
    if (!groupRoundId) return
    setSpectatorSettingsSaving(true)
    try {
      await supabase
        .from('group_rounds')
        .update({ spectators_enabled: enabled })
        .eq('id', groupRoundId)
    } catch { /* non-fatal */ }
    finally { setSpectatorSettingsSaving(false) }
  }, [groupRoundId])

  const handleSideGameVisibilityToggle = useCallback(async (visible: boolean) => {
    setSpectatorSideGamesVisible(visible)
    if (!groupRoundId) return
    try {
      await supabase
        .from('group_rounds')
        .update({ spectator_side_games_visible: visible })
        .eq('id', groupRoundId)
    } catch { /* non-fatal */ }
  }, [groupRoundId])

  const handleShareSpectatorLink = useCallback(async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Watch our golf round live', url: spectatorUrl })
      } catch { /* user cancelled or error */ }
    } else {
      try {
        await navigator.clipboard.writeText(spectatorUrl)
      } catch { /* ignore */ }
    }
  }, [spectatorUrl])

  const handleParChange = useCallback((index: number, par: number) => {
    setPars(prev => {
      const next = [...prev]
      next[index] = par
      return next
    })
  }, [])

  if (state === 'loading') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4">
        <div className="text-4xl animate-pulse">⛳</div>
        <p className="text-warm-gray text-lg font-medium">Creating room…</p>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4">
        <button onClick={() => navigate('/')} className="py-3 px-6 bg-forest text-cream rounded-xl font-semibold touch-target">
          Back to Home
        </button>
      </main>
    )
  }

  if (phase === 'side_games') {
    return (
      <SideGameConfigStep
        onBack={() => setPhase('setup')}
        onStartRound={handleStartRound}
        submitting={submitting}
      />
    )
  }

  if (phase === 'setup') {
    return (
      <main className="flex flex-col flex-1 p-6 pb-20 gap-6 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPhase('lobby')}
            className="text-[#2d5a27] font-semibold touch-target"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-black text-forest">Set Up the Course</h1>
        </div>

        <div className="flex flex-col gap-4">
          {/* Your Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="host-name">
              Your Name
            </label>
            <input
              id="host-name"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="e.g. Brian"
              className="w-full py-3 px-4 rounded-xl border-2 border-[#e5e1d8] bg-white text-[#1a1a1a] font-medium focus:outline-none focus:border-[#2d5a27]"
            />
          </div>

          {/* Course Search */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="course-search">
              Search Course <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <input
                id="course-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSelectedCourseId(null)
                  setTeeSets([])
                }}
                placeholder="Search course name…"
                className="w-full py-3 px-4 rounded-xl border-2 border-[#e5e1d8] bg-white text-[#1a1a1a] font-medium focus:outline-none focus:border-[#2d5a27] pr-10"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-[#2d5a27]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
              )}
            </div>

            {searchResults.length > 0 && !selectedCourseId && (
              <ul className="border border-[#e5e1d8] rounded-xl overflow-hidden divide-y divide-[#e5e1d8] bg-white" role="listbox" aria-label="Course search results">
                {searchResults.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => handleSelectCourse(c)}
                      className="w-full text-left px-4 py-3 hover:bg-[#f5f0e8] active:bg-[#eae6dd] transition-colors min-h-[48px]"
                    >
                      <div className="font-semibold text-[#1a1a1a] text-sm">{c.club_name}</div>
                      <div className="text-xs text-gray-500">{c.course_name} · {c.location?.city}, {c.location?.state}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {loadingDetails && (
              <p className="text-sm text-gray-500 px-1">Loading tee sets…</p>
            )}

            {teeSets.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 px-1">
                  Select Tee Set
                </div>
                <ul className="border border-[#e5e1d8] rounded-xl overflow-hidden divide-y divide-[#e5e1d8] bg-white" role="listbox" aria-label="Tee sets">
                  {teeSets.map(ts => (
                    <li key={ts.tee_name}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={courseRating === ts.course_rating && slopeRating === ts.slope_rating}
                        onClick={() => handleSelectTeeSet(ts)}
                        className={`w-full text-left px-4 py-3 transition-colors min-h-[48px] flex items-center justify-between ${
                          courseRating === ts.course_rating && slopeRating === ts.slope_rating
                            ? 'bg-[#eaf4e8]'
                            : 'hover:bg-[#f5f0e8] active:bg-[#eae6dd]'
                        }`}
                      >
                        <span className="font-semibold text-sm text-[#1a1a1a]">{ts.tee_name}</span>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {ts.course_rating.toFixed(1)} / {ts.slope_rating}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {courseRating !== null && slopeRating !== null && (
              <div className="text-xs font-semibold text-[#2d5a27] bg-[#eaf4e8] rounded-full px-3 py-1 self-start">
                Rating {courseRating.toFixed(1)} / Slope {slopeRating}
              </div>
            )}
          </div>

          {/* Course Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="course-name">
              Course Name
            </label>
            <input
              id="course-name"
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Augusta National"
              className="w-full py-3 px-4 rounded-xl border-2 border-[#e5e1d8] bg-white text-[#1a1a1a] font-medium focus:outline-none focus:border-[#2d5a27]"
            />
          </div>

          {/* Holes toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700">Holes</span>
            <div className="flex gap-3">
              {([9, 18] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHoleCount(n)}
                  className={`flex-1 py-3 rounded-xl border-2 font-semibold touch-target transition-colors ${
                    holeCount === n
                      ? 'bg-[#2d5a27] border-[#2d5a27] text-white'
                      : 'bg-white border-[#e5e1d8] text-[#1a1a1a]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Par grid */}
          <ParGridEditor
            holeCount={holeCount}
            pars={pars}
            onChange={handleParChange}
          />
        </div>

        <div className="mt-auto">
          <button
            type="button"
            onClick={() => setPhase('side_games')}
            className="w-full py-4 rounded-xl bg-[#2d5a27] text-white text-lg font-bold min-h-[56px] active:scale-95 transition-transform"
          >
            Side Games →
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-col flex-1 p-6 pb-20 gap-6 max-w-lg mx-auto w-full">
      <div className="text-center pt-2">
        <h1 className="text-2xl font-black text-forest">Group Round</h1>
        <p className="text-warm-gray text-sm mt-0.5">Share this code with your playing partners</p>
        {tournamentName && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-[#eaf4e8] text-[#2d5a27] text-xs font-semibold px-3 py-1.5 rounded-full">
            <span>🏆</span>
            <span>Part of {tournamentName}</span>
          </div>
        )}
      </div>

      <div className="bg-[#faf7f2] rounded-2xl border border-[#e5e1d8] p-6 flex flex-col items-center gap-5 shadow-sm">
        {/* QR code */}
        <div className="bg-white p-3 rounded-xl border border-[#e5e1d8]">
          {roomCode && <QRCode value={joinUrl} size={180} />}
        </div>

        {/* Room code */}
        <div className="text-6xl font-black text-[#2d5a27] tracking-widest font-mono text-center">
          {roomCode}
        </div>

        {/* Share + Copy buttons */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl bg-[#2d5a27] text-white font-semibold touch-target"
          >
            Share Link
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-3 rounded-xl border-2 border-[#2d5a27] text-[#2d5a27] font-semibold touch-target"
          >
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
        <p className="text-sm text-warm-gray text-center">
          Waiting for players to join…
        </p>
        <p className="text-xs text-gray-400 text-center mt-1">
          Scan the QR code or share the link so players can join and log their scores in real time.
        </p>
      </div>

      {/* Spectator controls */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Allow spectators</p>
            <p className="text-xs text-gray-400 mt-0.5">Share a watch-only link</p>
          </div>
          <button
            type="button"
            aria-pressed={spectatorsEnabled}
            onClick={() => handleSpectatorToggle(!spectatorsEnabled)}
            disabled={spectatorSettingsSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d5a27] focus:ring-offset-1 disabled:opacity-60 ${
              spectatorsEnabled ? 'bg-[#2d5a27]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                spectatorsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {spectatorsEnabled && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Show side game standings</p>
                <p className="text-xs text-gray-400 mt-0.5">Visible to spectators</p>
              </div>
              <button
                type="button"
                aria-pressed={spectatorSideGamesVisible}
                onClick={() => handleSideGameVisibilityToggle(!spectatorSideGamesVisible)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d5a27] focus:ring-offset-1 ${
                  spectatorSideGamesVisible ? 'bg-[#2d5a27]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    spectatorSideGamesVisible ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={handleShareSpectatorLink}
              className="w-full py-3 rounded-xl bg-[#f5f0e8] border border-[#e5e1d8] text-[#2d5a27] font-semibold text-sm touch-target flex items-center justify-center gap-2"
            >
              <span>Share for Spectators</span>
              <span className="text-xs text-gray-400 font-normal">/watch/{roomCode}</span>
            </button>
          </>
        )}
      </div>

      <div className="mt-auto flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex-1 py-3 rounded-xl border-2 border-[#e5e1d8] text-[#6b7280] font-semibold touch-target"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setPhase('setup')}
          className="flex-1 py-3 rounded-xl bg-[#2d5a27] text-white font-semibold touch-target"
        >
          Set Up Course →
        </button>
      </div>
    </main>
  )
}
