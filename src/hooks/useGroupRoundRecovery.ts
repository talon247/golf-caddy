import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useGroupRoundStore } from '../store/groupRoundStore'
import { loadGroupRoundRecovery, clearGroupRoundRecovery } from '../storage'
import type { GroupRoundStatus } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as (...args: any[]) => any

const ONE_DAY_MS = 24 * 60 * 60 * 1000

interface LobbyResult {
  id: string
  roomCode: string
  status: string
  createdAt: string
  error?: string
}

/**
 * On mount, checks localStorage for a saved group round session.
 * If the round is still active in Supabase, restores groupRound (and
 * currentPlayer for guests) in the store so tab-close recovery works.
 * Clears the key silently if the round is expired or completed.
 */
export function useGroupRoundRecovery() {
  const setGroupRound = useGroupRoundStore((s) => s.setGroupRound)
  const setCurrentPlayer = useGroupRoundStore((s) => s.setCurrentPlayer)

  useEffect(() => {
    async function recover() {
      const saved = loadGroupRoundRecovery()
      if (!saved) return

      try {
        const { data, error } = await rpc('get_group_round_lobby', {
          p_room_code: saved.roomCode,
        })

        if (error || !data || (data as LobbyResult).error) {
          clearGroupRoundRecovery()
          return
        }

        const lobby = data as LobbyResult

        // Clear if completed or older than 24h
        if (
          lobby.status === 'completed' ||
          Date.now() - new Date(lobby.createdAt).getTime() > ONE_DAY_MS
        ) {
          clearGroupRoundRecovery()
          return
        }

        setGroupRound({
          id: lobby.id,
          roomCode: lobby.roomCode,
          status: lobby.status as GroupRoundStatus,
          hostUserId: null,
          createdAt: lobby.createdAt,
        })

        if (saved.playerId && saved.playerName) {
          setCurrentPlayer({
            id: saved.playerId,
            groupRoundId: lobby.id,
            userId: null,
            displayName: saved.playerName,
            roundId: null,
            joinedAt: new Date().toISOString(),
          })
        }
      } catch {
        // Network offline — keep the key for the next attempt
      }
    }

    recover()
  }, [setGroupRound, setCurrentPlayer])
}
