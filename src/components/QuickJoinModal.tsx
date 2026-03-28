import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useAppStore } from '../store'
import { saveGroupRoundRecovery } from '../storage'
import type { FriendRoundInfo, GroupRound, GroupRoundPlayer, GroupRoundStatus } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as (...args: any[]) => any

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

interface Props {
  friend: FriendRoundInfo
  onClose: () => void
}

export default function QuickJoinModal({ friend, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const profile = useAppStore(s => s.profile)
  const addRound = useAppStore(s => s.addRound)
  const setActiveRoundId = useAppStore(s => s.setActiveRoundId)
  const setGroupRound = useGroupRoundStore(s => s.setGroupRound)
  const setCurrentPlayer = useGroupRoundStore(s => s.setCurrentPlayer)
  const resetLeaderboard = useLeaderboardStore(s => s.reset)

  const playerName = profile?.displayName ?? 'Player'

  async function handleJoin() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await rpc('join_group_round', {
        p_room_code: friend.roomCode,
        p_player_name: playerName,
      })
      if (rpcError) throw rpcError

      const result = data as JoinRpcResult
      if (!result.success) {
        setError(result.message ?? 'Could not join this round.')
        return
      }

      const resolvedRoomCode = result.roomCode ?? friend.roomCode
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
        displayName: playerName,
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
        playerName,
      })

      // Round is already active — create local round and jump straight in
      if (result.status === 'active' && result.holeCount && result.pars) {
        const roundId = crypto.randomUUID()
        const holeCount = result.holeCount as 9 | 18
        addRound({
          id: roundId,
          courseName: result.courseName ?? 'Group Round',
          playerName,
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

      // Round is still in lobby — go to join page lobby step
      navigate('/group-round/join', { state: { inLobby: true } })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-10">
        <h2 className="text-xl font-black text-forest mb-1">
          Join {friend.displayName}?
        </h2>
        <p className="text-warm-gray text-sm mb-6">
          {friend.courseName ?? 'Active round'}
          {friend.currentHole != null ? ` · Hole ${friend.currentHole}` : ''}
          {' · '}
          {friend.playerCount}/{friend.maxPlayers} players
        </p>

        {error && (
          <p className="text-red-600 text-sm mb-4 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
          >
            {loading ? 'Joining…' : 'Join Round'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full border-2 border-[#e5e1d8] text-[#1a1a1a] rounded-xl py-4 text-lg font-bold min-h-[56px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
