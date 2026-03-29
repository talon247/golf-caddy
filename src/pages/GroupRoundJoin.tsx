import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveGroupRoundRecovery } from '../storage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as (...args: any[]) => any
import { useGroupRoundStore, useAppStore } from '../store'
import { useLeaderboardStore } from '../store/leaderboardStore'
import type { GroupRound, GroupRoundPlayer, GroupRoundStatus, JoinError } from '../types'
import CodeEntry from '../components/group-round/CodeEntry'
import DisplayNameEntry from '../components/group-round/DisplayNameEntry'
import JoinLobby from '../components/group-round/JoinLobby'

type Step = 'code' | 'name' | 'lobby'

interface LobbyPreview {
  courseName: string | null
  holeCount: number | null
  playerCount: number
  status: string
}

interface JoinRpcResult {
  success: boolean
  error?: string
  message?: string
  groupRoundId?: string
  playerId?: string
  roomCode?: string
  status?: string
  courseName?: string | null
  holeCount?: number | null
  pars?: number[] | null
}

interface LobbyRpcResult {
  error?: string
  status?: string
  createdAt?: string
  courseName?: string | null
  holeCount?: number | null
  players?: { id: string; playerName: string; joinedAt: string }[]
}

function mapJoinError(raw: string): JoinError {
  if (raw === 'expired') return 'expired'
  if (raw === 'full') return 'full'
  if (raw === 'not_found') return 'not_found'
  return 'network'
}

export default function GroupRoundJoin() {
  const { code: urlCode } = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<Step>(
    (location.state as { inLobby?: boolean } | null)?.inLobby ? 'lobby' : 'code'
  )
  const [code, setCode] = useState<string[]>(
    urlCode ? urlCode.toUpperCase().slice(0, 4).split('').concat(['', '', '', '']).slice(0, 4) : ['', '', '', '']
  )
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lobbyInfo, setLobbyInfo] = useState<LobbyPreview | null>(null)

  const setGroupRound = useGroupRoundStore(s => s.setGroupRound)
  const resetLeaderboard = useLeaderboardStore(s => s.reset)
  const setCurrentPlayer = useGroupRoundStore(s => s.setCurrentPlayer)
  const addRound = useAppStore(s => s.addRound)
  const setActiveRoundId = useAppStore(s => s.setActiveRoundId)

  // Auto-advance to name step when URL contains a valid room code
  useEffect(() => {
    if (urlCode && urlCode.length === 4) {
      handleCodeSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCodeSubmit() {
    const roomCode = code.join('').toUpperCase()
    if (roomCode.length !== 4) return

    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await rpc('get_group_round_lobby', {
        p_room_code: roomCode,
      })
      if (rpcError) throw rpcError
      if (!data) {
        setError('Unable to check room — please try again.')
        return
      }
      const result = data as LobbyRpcResult
      if (result.error === 'not_found') {
        setError('This round doesn\'t exist. Check the link and try again.')
      } else if (
        result.status === 'completed' ||
        (result.createdAt && Date.now() - new Date(result.createdAt).getTime() > 24 * 60 * 60 * 1000)
      ) {
        setError('This round has ended.')
      } else if ((result.players?.length ?? 0) >= 4) {
        setError('This round is full.')
      } else {
        setLobbyInfo({
          courseName: result.courseName ?? null,
          holeCount: result.holeCount ?? null,
          playerCount: result.players?.length ?? 0,
          status: result.status ?? 'waiting',
        })
        setStep('name')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleNameSubmit() {
    const roomCode = code.join('').toUpperCase()
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await rpc('join_group_round', {
        p_room_code: roomCode,
        p_player_name: displayName.trim(),
      })
      if (rpcError) throw rpcError
      if (!data) {
        setError('Unable to join — please try again.')
        return
      }

      const result = data as JoinRpcResult
      if (!result.success) {
        const joinErr = mapJoinError(result.error ?? '')
        if (joinErr === 'not_found') {
          setError('This round doesn\'t exist. Check the link and try again.')
          setStep('code')
        } else if (joinErr === 'expired') {
          setError('This round has ended.')
          setStep('code')
        } else if (joinErr === 'full') {
          setError('This round is full.')
        } else {
          setError(result.message ?? 'Something went wrong.')
        }
        return
      }

      const resolvedRoomCode = result.roomCode ?? roomCode
      const groupRound: GroupRound = {
        id: result.groupRoundId!,
        roomCode: resolvedRoomCode,
        hostUserId: null,
        status: (result.status ?? 'waiting') as GroupRoundStatus,
        createdAt: new Date().toISOString(),
      }
      const player: GroupRoundPlayer = {
        id: result.playerId!,
        groupRoundId: result.groupRoundId!,
        userId: null,
        displayName: displayName.trim(),
        roundId: null,
        joinedAt: new Date().toISOString(),
      }
      resetLeaderboard()
      setGroupRound(groupRound)
      setCurrentPlayer(player)
      saveGroupRoundRecovery({
        groupRoundId: result.groupRoundId!,
        roomCode: resolvedRoomCode,
        playerId: result.playerId!,
        playerName: displayName.trim(),
      })

      // Catch-up: round already active — create local round and go directly to /round
      if (result.status === 'active' && result.holeCount && result.pars) {
        const roundId = crypto.randomUUID()
        const holeCount = result.holeCount as 9 | 18
        addRound({
          id: roundId,
          courseName: result.courseName ?? 'Group Round',
          playerName: displayName.trim() || 'Player',
          tees: '',
          holeCount,
          startedAt: Date.now(),
          holes: Array.from({ length: holeCount }, (_, i) => ({
            number: i + 1,
            par: result.pars![i] ?? 4,
            shots: [],
          })),
        })
        setActiveRoundId(roundId)
        navigate('/round')
        return
      }

      setStep('lobby')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col flex-1 p-6 pb-20 max-w-sm mx-auto w-full pt-10">
      {step === 'code' && (
        <CodeEntry
          code={code}
          onChange={setCode}
          onSubmit={handleCodeSubmit}
          error={error}
          loading={loading}
        />
      )}
      {step === 'name' && (
        <DisplayNameEntry
          displayName={displayName}
          onChange={setDisplayName}
          onSubmit={handleNameSubmit}
          onBack={() => { setStep('code'); setError(null); setLobbyInfo(null) }}
          error={error}
          loading={loading}
          roundInfo={lobbyInfo ?? undefined}
        />
      )}
      {step === 'lobby' && <JoinLobby />}
    </main>
  )
}
