import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroupRoundStore } from '../store/groupRoundStore'

function generateRoomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

export default function GroupRoundHost() {
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [roomCode, setRoomCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [groupRoundId, setGroupRoundId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const createdRef = useRef(false)

  const setGroupRound = useGroupRoundStore((s) => s.setGroupRound)

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
          setRoomCode(code)
          setGroupRoundId((data as { id: string } | null)?.id ?? null)
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
      // Even on hard error, try local-only mode
      const fallbackCode = generateRoomCode()
      setRoomCode(fallbackCode)
      setState('ready')
    })
  }, [setGroupRound])

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/group-round/join/${roomCode}`

  const handleStart = useCallback(async () => {
    setStarting(true)
    try {
      if (groupRoundId) {
        await supabase
          .from('group_rounds')
          .update({ status: 'active' })
          .eq('id', groupRoundId)
      }
      navigate('/setup')
    } catch (err) {
      console.error('Failed to start round:', err)
      navigate('/setup') // navigate anyway
    } finally {
      setStarting(false)
    }
  }, [groupRoundId, navigate])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [roomCode])

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
          onClick={handleStart}
          disabled={starting}
          className="flex-1 py-3 rounded-xl bg-[#2d5a27] text-white font-semibold touch-target"
        >
          Start My Round
        </button>
      </div>
    </main>
  )
}

