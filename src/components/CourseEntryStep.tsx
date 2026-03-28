import { useState, useEffect, useRef, useCallback } from 'react'
import { searchCourses, getCourseDetails } from '../lib/handicap/courseApi'
import type { GolfApiCourse, TeeSet } from '../lib/handicap/courseApi'

export interface CourseEntryValue {
  teeSet: string
  courseName?: string
  pars?: number[]
  holeCount?: 9 | 18
  courseRating: number | null
  slopeRating: number | null
  skipped: boolean
}

interface Props {
  value: CourseEntryValue
  onChange: (value: CourseEntryValue) => void
}

type Mode = 'search' | 'manual'

const SKIP_VALUE: CourseEntryValue = { teeSet: '', courseRating: null, slopeRating: null, skipped: true }

export default function CourseEntryStep({ value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GolfApiCourse[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [selectedCourseName, setSelectedCourseName] = useState<string | undefined>(undefined)
  const [teeSets, setTeeSets] = useState<TeeSet[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [manualCourseName, setManualCourseName] = useState<string>(value.courseName ?? '')
  const [manualRating, setManualRating] = useState<string>(value.courseRating?.toString() ?? '')
  const [manualSlope, setManualSlope] = useState<string>(value.slopeRating?.toString() ?? '')
  const [manualTeeSet, setManualTeeSet] = useState<string>(value.teeSet ?? '')
  const [showSkipTooltip, setShowSkipTooltip] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setSearching(true)
    setSearchError(false)

    try {
      const courses = await searchCourses(q, abortRef.current.signal)
      setResults(courses)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setSearchError(true)
      setResults([])
      // Fall through to manual on API error
      setMode('manual')
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'search') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, mode, doSearch])

  async function selectCourse(course: GolfApiCourse) {
    setSelectedCourseId(course.id)
    setSelectedCourseName(course.club_name)
    setTeeSets([])
    setLoadingDetails(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const details = await getCourseDetails(course.id, abortRef.current.signal)
      // Prefer male tees, fall back to female, combine if needed
      const maleTees = details.tees?.male ?? []
      const femaleTees = details.tees?.female ?? []
      setTeeSets(maleTees.length > 0 ? maleTees : femaleTees)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // On error, fall to manual
      setMode('manual')
    } finally {
      setLoadingDetails(false)
    }
  }

  function selectTeeSet(ts: TeeSet, courseName?: string) {
    const holeCount = ts.number_of_holes === 9 ? 9 : 18
    const pars = ts.holes?.map(h => h.par ?? 4) ?? Array(holeCount).fill(4)
    onChange({
      teeSet: ts.tee_name,
      courseRating: ts.course_rating,
      slopeRating: ts.slope_rating,
      skipped: false,
      courseName,
      pars: pars.slice(0, holeCount),
      holeCount,
    })
  }

  function commitManual() {
    const rating = parseFloat(manualRating)
    const slope = parseInt(manualSlope, 10)
    onChange({
      teeSet: manualTeeSet.trim(),
      courseName: manualCourseName.trim() || undefined,
      courseRating: isNaN(rating) ? null : rating,
      slopeRating: isNaN(slope) ? null : slope,
      skipped: false,
    })
  }

  function handleSkip() {
    onChange(SKIP_VALUE)
  }

  const hasSelection = !value.skipped && (value.courseRating !== null || value.slopeRating !== null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-500">Course Rating &amp; Slope</div>
        {hasSelection && (
          <div className="text-xs font-semibold text-[#2d5a27] bg-[#eaf4e8] rounded-full px-3 py-1">
            {value.courseRating?.toFixed(1)} / {value.slopeRating}
          </div>
        )}
        {value.skipped && (
          <div className="text-xs text-gray-400">Skipped — no handicap calc</div>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('search'); setSelectedCourseId(null); setTeeSets([]) }}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors min-h-[40px] ${
            mode === 'search'
              ? 'bg-[#2d5a27] text-white border-[#2d5a27]'
              : 'bg-white text-[#2d5a27] border-[#e5e1d8]'
          }`}
        >
          Search Course
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors min-h-[40px] ${
            mode === 'manual'
              ? 'bg-[#2d5a27] text-white border-[#2d5a27]'
              : 'bg-white text-[#2d5a27] border-[#e5e1d8]'
          }`}
        >
          Enter Manually
        </button>
      </div>

      {mode === 'search' && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedCourseId(null); setTeeSets([]) }}
              placeholder="Search course name…"
              aria-label="Search for a golf course"
              className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full pr-10"
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

          {searchError && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
              Course search unavailable. Use manual entry below.
            </p>
          )}

          {results.length > 0 && !selectedCourseId && (
            <ul className="border border-[#e5e1d8] rounded-xl overflow-hidden divide-y divide-[#e5e1d8] bg-white" role="listbox" aria-label="Course search results">
              {results.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => selectCourse(c)}
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
                      aria-selected={value.teeSet === ts.tee_name}
                      onClick={() => selectTeeSet(ts, selectedCourseName)}
                      className={`w-full text-left px-4 py-3 transition-colors min-h-[48px] flex items-center justify-between ${
                        value.teeSet === ts.tee_name
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
        </div>
      )}

      {mode === 'manual' && (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="manual-course-name" className="text-sm font-medium text-gray-500 mb-1 block">
              Course Name
            </label>
            <input
              id="manual-course-name"
              type="text"
              value={manualCourseName}
              onChange={e => setManualCourseName(e.target.value)}
              onBlur={commitManual}
              placeholder="Augusta National"
              className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
            />
          </div>
          <div>
            <label htmlFor="manual-tee-set" className="text-sm font-medium text-gray-500 mb-1 block">
              Tee Set Name <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="manual-tee-set"
              type="text"
              value={manualTeeSet}
              onChange={e => setManualTeeSet(e.target.value)}
              onBlur={commitManual}
              placeholder="e.g. White"
              className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="manual-rating" className="text-sm font-medium text-gray-500 mb-1 block">
                Course Rating
              </label>
              <input
                id="manual-rating"
                type="number"
                inputMode="decimal"
                value={manualRating}
                onChange={e => setManualRating(e.target.value)}
                onBlur={commitManual}
                placeholder="72.4"
                min={50}
                max={80}
                step={0.1}
                aria-describedby="rating-hint"
                className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
              />
              <p id="rating-hint" className="text-xs text-gray-400 mt-1">50.0 – 80.0</p>
            </div>
            <div className="flex-1">
              <label htmlFor="manual-slope" className="text-sm font-medium text-gray-500 mb-1 block">
                Slope Rating
              </label>
              <input
                id="manual-slope"
                type="number"
                inputMode="numeric"
                value={manualSlope}
                onChange={e => setManualSlope(e.target.value)}
                onBlur={commitManual}
                placeholder="113"
                min={55}
                max={155}
                step={1}
                aria-describedby="slope-hint"
                className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
              />
              <p id="slope-hint" className="text-xs text-gray-400 mt-1">55 – 155</p>
            </div>
          </div>
        </div>
      )}

      {/* Skip option */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSkip}
          className={`text-sm underline transition-colors ${
            value.skipped ? 'text-gray-400' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Skip for this round
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Why skip affects handicap"
            onMouseEnter={() => setShowSkipTooltip(true)}
            onMouseLeave={() => setShowSkipTooltip(false)}
            onFocus={() => setShowSkipTooltip(true)}
            onBlur={() => setShowSkipTooltip(false)}
            className="w-5 h-5 rounded-full border border-gray-300 text-gray-400 text-xs flex items-center justify-center"
          >
            ?
          </button>
          {showSkipTooltip && (
            <div
              role="tooltip"
              className="absolute left-1/2 -translate-x-1/2 bottom-7 w-56 bg-[#1a1a1a] text-white text-xs rounded-xl px-3 py-2 shadow-lg z-10 pointer-events-none"
            >
              Course Rating and Slope are required to calculate your handicap differential. Without them, this round won't count toward your handicap index.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

