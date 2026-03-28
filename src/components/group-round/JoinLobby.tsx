import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as (...args: any[]) => any
import { useGroupRoundStore } from '../../store'
import type { GroupRoundPlayer, GroupRound } from '../../types'

interface LobbyPlayer {
  id: string
  displayName: string
  joinedAt: string
}

interface LobbyResult {
  id: string
  roomCode: string
  status: string
  expiresAt: string
  players: LobbyPlayer[]
}

export default function JoinLobby() {
  const navigate = useNavigate()
  const groupRound = useGroupRoundStore(s => s.groupRound)
  const currentPlayer = useGroupRoundStore(s => s.currentPlayer)
  const setPlayers = useGroupRoundStore(s => s.setPlayers)
  const setGroupRound = useGroupRoundStore(s => s.setGroupRound)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!groupRound) return

    async function poll() {
      const { data, error } = await rpc('get_group_round_lobby', {
        p_room_code: groupRound!.roomCode,
      })
      if (error || !data) return

      const result = data as LobbyResult & { error?: string }
      if (result.error) return

      const mapped: GroupRoundPlayer[] = result.players.map((p) => ({
        id: p.id,
        groupRoundId: result.id,
        userId: null,
        displayName: p.displayName,
        roundId: null,
        joinedAt: p.joinedAt,
      }))
      setPlayers(mapped)

      // When host starts the round, navigate to the active round
      if (result.status === 'active') {
        const updated: GroupRound = {
          ...groupRound!,
          status: 'active',
        }
        setGroupRound(updated)
        // Store group round ID in localStorage for Setup to pick up
        if (result.id) {
          localStorage.setItem('golf-caddy-group-round-id', result.id)
        }
        clearInterval(intervalRef.current!)
        navigate('/setup', { replace: true })
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 2500)
    return () => { clearInterval(intervalRef.current!) }
  }, [groupRound, navigate, setPlayers, setGroupRound])

  const players = useGroupRoundStore(s => s.players)

  if (!groupRound) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-warm-gray mb-2">
          Room Code
        </div>
        <div className="text-6xl font-black text-forest tracking-widest">
          {groupRound.roomCode}
        </div>
      </div>

      <div className="bg-white border-2 border-cream-dark rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-warm-gray uppercase tracking-wide mb-3">
          Players ({players.length}/4)
        </h3>
        {players.length === 0 ? (
          <p className="text-warm-gray text-sm">Waiting for players…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {players.map(p => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-forest inline-block" />
                <span className="font-semibold text-gray-900">{p.displayName}</span>
                {currentPlayer?.id === p.id && (
                  <span className="text-xs text-warm-gray ml-auto">You</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-center text-warm-gray text-sm animate-pulse">
        Waiting for host to start…
      </div>
    </div>
  )
}

