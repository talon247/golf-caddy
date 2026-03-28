import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as (...args: any[]) => any
import { useGroupRoundStore } from '../store'
import type { GroupRound, GroupRoundPlayer, JoinError } from '../types'
import CodeEntry from '../components/group-round/CodeEntry'
import DisplayNameEntry from '../components/group-round/DisplayNameEntry'
import JoinLobby from '../components/group-round/JoinLobby'

type Step = 'code' | 'name' | 'lobby'

interface JoinRpcResult {
  success: boolean
  error?: string
  message?: string
  groupRoundId?: string
  playerId?: string
  roomCode?: string
}

function mapJoinError(raw: string): JoinError {
  if (raw === 'expired') return 'expired'
  if (raw === 'full') return 'full'
  if (raw === 'not_found') return 'not_found'
  return 'network'
}

export default function GroupRoundJoin() {
  const { code: urlCode } = useParams<{ code?: string }>()
  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState<string[]>(
    urlCode ? urlCode.toUpperCase().slice(0, 4).split('').concat(['', '', '', '']).slice(0, 4) : ['', '', '', '']
  )
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const setGroupRound = useGroupRoundStore(s => s.setGroupRound)
  const setCurrentPlayer = useGroupRoundStore(s => s.setCurrentPlayer)

  async function handleCodeSubmit() {
    const roomCode = code.join('').toUpperCase()
    if (roomCode.length !== 4) return

    setLoading(true)
    setError(null)
    try {
      // Peek at the room to confirm it exists before asking for name
      const { data, error: rpcError } = await rpc('get_group_round_lobby', {
        p_room_code: roomCode,
      })
      if (rpcError) throw rpcError
      const result = data as { error?: string; status?: string; expiresAt?: string }
      if (result.error === 'not_found') {
        setError('Code not found. Check the code and try again.')
      } else if (result.status === 'active' || result.status === 'completed' || (result.expiresAt && new Date(result.expiresAt) < new Date())) {
        setError('This round has already ended.')
      } else {
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

      const result = data as JoinRpcResult
      if (!result.success) {
        setError(result.message ?? 'Something went wrong.')
        if (mapJoinError(result.error ?? '') === 'not_found' || mapJoinError(result.error ?? '') === 'expired') {
          setStep('code')
        }
        return
      }

      const groupRound: GroupRound = {
        id: result.groupRoundId!,
        roomCode: result.roomCode!,
        hostUserId: null,
        status: 'waiting',
        expiresAt: '',
        createdAt: '',
      }
      const player: GroupRoundPlayer = {
        id: result.playerId!,
        groupRoundId: result.groupRoundId!,
        userId: null,
        displayName: displayName.trim(),
        roundId: null,
        joinedAt: new Date().toISOString(),
      }
      setGroupRound(groupRound)
      setCurrentPlayer(player)
      setStep('lobby')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col flex-1 p-6 max-w-sm mx-auto w-full pt-10">
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
          onBack={() => { setStep('code'); setError(null) }}
          error={error}
          loading={loading}
        />
      )}
      {step === 'lobby' && <JoinLobby />}
    </main>
  )
}
