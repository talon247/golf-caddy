import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useCourseStore } from '../store'
import ConfirmModal from '../components/ConfirmModal'
import ParGridEditor from '../components/ParGridEditor'
import CourseEntryStep from '../components/CourseEntryStep'
import type { CourseEntryValue } from '../components/CourseEntryStep'

const TEES = ['Black', 'Blue', 'White', 'Gold', 'Red'] as const

const DEFAULT_COURSE_ENTRY: CourseEntryValue = {
  teeSet: '',
  courseRating: null,
  slopeRating: null,
  skipped: false,
}

export default function Setup() {
  const navigate = useNavigate()
  const { addRound, setActiveRoundId, completeRound, activeRoundId, clubBag } = useAppStore()
  const { courses } = useCourseStore()

  const [courseName, setCourseName] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [tees, setTees] = useState<string>('White')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)
  const [pars, setPars] = useState<number[]>(Array(18).fill(4))
  const [courseEntry, setCourseEntry] = useState<CourseEntryValue>(DEFAULT_COURSE_ENTRY)
  const [showBagWarning, setShowBagWarning] = useState(false)
  const [showAbandonWarning, setShowAbandonWarning] = useState(false)

  function selectCourse(id: string) {
    const course = courses.find(c => c.id === id)
    if (!course) return
    setSelectedCourseId(id)
    setCourseName(course.name)
    const count: 9 | 18 = course.holes.length === 9 ? 9 : 18
    setHoleCount(count)
    const newPars = Array(18).fill(4)
    course.holes.forEach((h, i) => { newPars[i] = h.par })
    setPars(newPars)
  }

  function handleHoleCountChange(n: 9 | 18) {
    setHoleCount(n)
    setSelectedCourseId(null)
    if (n === 18 && holeCount === 9) {
      setPars(prev => {
        const next = [...prev]
        for (let i = 9; i < 18; i++) next[i] = 4
        return next
      })
    }
  }

  function handleParChange(index: number, par: number) {
    setSelectedCourseId(null)
    setPars(prev => {
      const next = [...prev]
      next[index] = par
      return next
    })
  }

  function doStartRoundForced() {
    if (activeRoundId) completeRound(activeRoundId)
    const id = crypto.randomUUID()
    addRound({
      id,
      courseName: courseName.trim() || 'Unknown Course',
      courseId: selectedCourseId ?? undefined,
      playerName: playerName.trim() || 'Player',
      tees,
      teeSet: courseEntry.skipped ? undefined : (courseEntry.teeSet || undefined),
      courseRating: courseEntry.skipped ? undefined : (courseEntry.courseRating ?? undefined),
      slopeRating: courseEntry.skipped ? undefined : (courseEntry.slopeRating ?? undefined),
      holeCount,
      startedAt: Date.now(),
      holes: Array.from({ length: holeCount }, (_, i) => ({
        number: i + 1,
        par: pars[i] ?? 4,
        shots: [],
      })),
    })
    setActiveRoundId(id)
    navigate('/round')
  }

  function doStartRound() {
    if (activeRoundId) {
      setShowAbandonWarning(true)
      return
    }
    doStartRoundForced()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (clubBag.length === 0) {
      setShowBagWarning(true)
      return
    }
    doStartRound()
  }

  return (
    <div className="flex flex-col flex-1 max-w-[390px] mx-auto w-full relative">
      {/* Header */}
      <div className="px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="h-11 w-11 flex items-center justify-center rounded-full bg-[#faf7f2] border border-[#e5e1d8] text-[#1a1a1a] text-xl shrink-0"
          aria-label="Back"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">New Round</h1>
      </div>

      {/* Saved courses scroll row */}
      {courses.length > 0 && (
        <div className="mb-2">
          <div className="px-4 text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Saved Courses
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2">
            {courses.map(course => (
              <button
                key={course.id}
                type="button"
                onClick={() => selectCourse(course.id)}
                className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold min-h-[44px] flex items-center whitespace-nowrap border transition-colors ${
                  selectedCourseId === course.id
                    ? 'bg-[#2d5a27] text-white border-[#2d5a27]'
                    : 'bg-white border-[#e5e1d8] text-[#2d5a27]'
                }`}
              >
                {course.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <form id="setup-form" onSubmit={handleSubmit} className="flex flex-col gap-0">
        <div className="bg-[#faf7f2] rounded-2xl border border-[#e5e1d8] p-5 mx-4 mt-4 flex flex-col gap-5 mb-6">
          {/* Course name */}
          <div>
            <label className="text-sm font-medium text-gray-500 mb-1 block">Course Name</label>
            <input
              type="text"
              value={courseName}
              onChange={e => { setCourseName(e.target.value); setSelectedCourseId(null) }}
              placeholder="Augusta National"
              className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
            />
          </div>

          {/* Player name */}
          <div>
            <label className="text-sm font-medium text-gray-500 mb-1 block">Player Name</label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Your name"
              className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
            />
          </div>

          {/* Tees */}
          <div>
            <div className="text-sm font-medium text-gray-500 mb-2">Tees</div>
            <div className="flex flex-wrap gap-2">
              {TEES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTees(t)}
                  className={`px-4 py-2 rounded-full border text-sm font-semibold min-h-[44px] flex items-center transition-colors ${
                    tees === t
                      ? 'border-[#2d5a27] bg-[#2d5a27] text-white'
                      : 'border-[#e5e1d8] bg-white text-[#1a1a1a]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Course Rating & Slope entry */}
          <div className="border-t border-[#e5e1d8] pt-5">
            <CourseEntryStep value={courseEntry} onChange={setCourseEntry} />
          </div>

          {/* Holes */}
          <div>
            <div className="text-sm font-medium text-gray-500 mb-2">Holes</div>
            <div className="flex gap-3">
              {([9, 18] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleHoleCountChange(n)}
                  className={`flex-1 py-4 rounded-xl text-lg font-bold border-2 min-h-[56px] transition-colors ${
                    holeCount === n
                      ? 'bg-[#2d5a27] text-white border-[#2d5a27]'
                      : 'bg-white text-[#2d5a27] border-[#e5e1d8]'
                  }`}
                >
                  {n} holes
                </button>
              ))}
            </div>
          </div>

          {/* Par grid */}
          <ParGridEditor holeCount={holeCount} pars={pars} onChange={handleParChange} />
        </div>

        {/* CTA */}
        <div className="sticky bottom-0 bg-[#f5f0e8] border-t border-[#e5e1d8] px-4 pt-3 pb-4">
          <button
            type="submit"
            className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform"
          >
            Start Round →
          </button>
        </div>
      </form>

      {showBagWarning && (
        <ConfirmModal
          title="Your bag is empty"
          message="Add clubs before starting a round so you can track shots by club. You can still start without clubs."
          confirmLabel="Start Anyway"
          cancelLabel="Go to Bag"
          onConfirm={() => {
            setShowBagWarning(false)
            doStartRound()
          }}
          onCancel={() => {
            setShowBagWarning(false)
            navigate('/bag')
          }}
        />
      )}

      {showAbandonWarning && (
        <ConfirmModal
          title="Abandon current round?"
          message="You have an active round in progress. Starting a new round will abandon it."
          confirmLabel="Start New Round"
          cancelLabel="Keep Playing"
          onConfirm={() => {
            setShowAbandonWarning(false)
            doStartRoundForced()
          }}
          onCancel={() => setShowAbandonWarning(false)}
        />
      )}
    </div>
  )
}
