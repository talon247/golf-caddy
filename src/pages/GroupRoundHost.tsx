import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useAppStore } from '../store'
import ParGridEditor from '../components/ParGridEditor'
import { saveGroupRoundRecovery } from '../storage'
import { searchCourses, getCourseDetails } from '../lib/handicap/courseApi'
import type { GolfApiCourse, TeeSet } from '../lib/handicap/courseApi'

function generateRoomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

export default function GroupRoundHost() {
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [roomCode, setRoomCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [groupRoundId, setGroupRoundId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'lobby' | 'setup'>('lobby')
  const [hostName, setHostName] = useState('')
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

  const setGroupRound = useGroupRoundStore((s) => s.setGroupRound)
  const resetLeaderboard = useLeaderboardStore((s) => s.reset)
  const addRound = useAppStore((s) => s.addRound)
  const setActiveRoundId = useAppStore((s) => s.setActiveRoundId)

  useEffect(() => {
    if (createdRef.current) return
    createdRef.current = true

    async function create() {
      let code = generateRoomCode()
      let attempts = 0

      while (attempts < 5) {
        const { data, error } = await supabase
          .from('group_rounds')
          .insert({ room_code: code, host_name: hostName.trim() || 'Host' })
          .select('id')
          .single()

        if (!error) {
          const id = (data as { id: string } | null)?.id ?? null
          setRoomCode(code)
          setGroupRoundId(id)
          if (id) {
            saveGroupRoundRecovery({ groupRoundId: id, roomCode: code })
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
  }, [])

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

  const handleStartRound = useCallback(async () => {
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
      }

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
  }, [groupRoundId, courseName, holeCount, pars, courseRating, slopeRating, addRound, setActiveRoundId, setGroupRound, roomCode, navigate, hostName, resetLeaderboard])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [roomCode])

  const handleParChange = useCallback((index: number, par: number) => {
    setPars(prev => {
      const next = [...prev]
      next[index] = par
      return next
    })
  }, [])

  if (state === 'loading') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
        <div className="text-4xl animate-pulse">⛳</div>
        <p className="text-warm-gray text-lg font-medium">Creating room…</p>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
        <button onClick={() => navigate('/')} className="py-3 px-6 bg-forest text-cream rounded-xl font-semibold touch-target">
          Back to Home
        </button>
      </main>
    )
  }

  if (phase === 'setup') {
    return (
      <main className="flex flex-col flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
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
            onClick={handleStartRound}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-[#2d5a27] text-white font-semibold touch-target disabled:opacity-60"
          >
            {submitting ? 'Starting…' : 'Start Round'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-col flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      <div className="text-center pt-2">
        <h1 className="text-2xl font-black text-forest">Group Round</h1>
        <p className="text-warm-gray text-sm mt-0.5">Share this code with your playing partners</p>
      </div>

      <div className="bg-[#faf7f2] rounded-2xl border border-[#e5e1d8] p-6 flex flex-col items-center gap-5 shadow-sm">
        {/* Room code */}
        <div className="flex gap-2">
          {roomCode.split('').map((digit, i) => (
            <div key={i} className="w-16 h-20 flex items-center justify-center bg-white border-2 border-[#2d5a27] rounded-xl text-4xl font-black text-[#2d5a27] shadow-sm">
              {digit}
            </div>
          ))}
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-3 rounded-xl border-2 border-[#2d5a27] text-[#2d5a27] font-semibold touch-target"
        >
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>

        {/* Join URL */}
        <p className="text-xs text-gray-500 text-center break-all">
          Or share link: <span className="text-[#2d5a27]">{joinUrl}</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
        <p className="text-sm text-warm-gray text-center">
          Waiting for players to join…
        </p>
        <p className="text-xs text-gray-400 text-center mt-1">
          Live score sync coming soon — each player can log scores in their solo round for now.
        </p>
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
