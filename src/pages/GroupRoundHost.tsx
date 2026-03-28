import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useAppStore } from '../store'
import ParGridEditor from '../components/ParGridEditor'
import { saveGroupRoundRecovery } from '../storage'

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
  const [courseName, setCourseName] = useState('')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)
  const [pars, setPars] = useState<number[]>(Array(18).fill(4))
  const [submitting, setSubmitting] = useState(false)
  const createdRef = useRef(false)

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
          .insert({ room_code: code, host_name: 'Host' })
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
        })
      }

      const id = crypto.randomUUID()
      addRound({
        id,
        courseName: courseName.trim() || 'Group Round',
        tees: '',
        playerName: 'Host',
        holeCount,
        startedAt: Date.now(),
        holes: Array.from({ length: holeCount }, (_, i) => ({
          number: i + 1,
          par: pars[i] ?? 4,
          shots: [],
        })),
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
  }, [groupRoundId, courseName, holeCount, pars, addRound, setActiveRoundId, setGroupRound, roomCode, navigate])

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

