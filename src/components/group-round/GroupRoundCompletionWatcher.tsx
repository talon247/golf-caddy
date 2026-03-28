/**
 * GroupRoundCompletionWatcher
 *
 * Invisible component mounted in App.tsx whenever there is an active group round.
 * Subscribes to the Supabase Realtime broadcast channel for the room and listens
 * for the `round_complete` event. When received, stores final standings in the
 * group round store and navigates all clients to the leaderboard page.
 *
 * Also handles the joiner-side: JoinLobby navigates joiners to /round after start,
 * so this watcher is the reliable way to catch completion from any screen.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useGroupRoundStore } from '../../store/groupRoundStore'
import type { PlayerScore } from '../../types'

interface RoundCompletePayload {
  finalStandings?: PlayerScore[]
}

export default function GroupRoundCompletionWatcher() {
  const navigate = useNavigate()
  const groupRound = useGroupRoundStore(s => s.groupRound)
  const status = useGroupRoundStore(s => s.status)
  const setFinalStandings = useGroupRoundStore(s => s.setFinalStandings)

  useEffect(() => {
    // Only watch when there's an active group round in play
    if (!groupRound || status !== 'active') return

    const channelName = `group-round-${groupRound.roomCode}`
    const channel = supabase.channel(`completion-watcher-${groupRound.roomCode}`)

    channel
      .on(
        'broadcast',
        { event: 'round_complete' },
        ({ payload }: { payload: RoundCompletePayload }) => {
          const standings = payload?.finalStandings ?? []
          setFinalStandings(standings)
          navigate('/group-round/leaderboard', { replace: true })
        },
      )
      .subscribe()

    // Also poll group_rounds DB status as a fallback for clients
    // that miss the broadcast (e.g. brief disconnect)
    let pollInterval: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    async function checkStatus() {
      if (cancelled) return
      const { data } = await supabase
        .from('group_rounds')
        .select('status')
        .eq('id', groupRound!.id)
        .single()
      if (data?.status === 'completed' && !cancelled) {
        cancelled = true
        clearInterval(pollInterval!)
        setFinalStandings([])
        navigate('/group-round/leaderboard', { replace: true })
      }
    }

    // Poll every 5s as broadcast fallback
    pollInterval = setInterval(checkStatus, 5000)

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
      supabase.removeChannel(channel)
      void channelName // suppress unused warning
    }
  }, [groupRound, status, navigate, setFinalStandings])

  return null
}
