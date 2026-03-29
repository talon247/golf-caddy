import { useMemo } from 'react'
import { useLeaderboardStore } from '../store/leaderboardStore'
import { useGroupRoundStore } from '../store/groupRoundStore'
import {
  createSkinsState,
  calculateSkinsForHole,
} from '../lib/sideGames/skins'
import type { SkinsState } from '../lib/sideGames/skins'
import {
  createNassauState,
  calculateNassauForHole,
} from '../lib/sideGames/nassau'
import type { NassauState } from '../lib/sideGames/nassau'
import {
  createStablefordState,
  calculateStablefordForHole,
} from '../lib/sideGames/stableford'
import type { StablefordState } from '../lib/sideGames/stableford'
import {
  createPressState,
  checkPressTrigger,
  updatePressStandings,
} from '../lib/sideGames/press'
import type { PressState } from '../lib/sideGames/press'
import type { PlayerScore, SideGameConfig } from '../types'

export interface SideGameComputedState {
  skins: SkinsState | null
  nassau: NassauState | null
  press: PressState | null
  stableford: StablefordState | null
  /** Hole numbers that have been fully processed (all players scored) */
  processedHoles: number[]
}

/**
 * Pure computation of side game state from player scores and config.
 * Safe to call outside React (e.g. in store actions).
 */
export function computeSideGameState(
  players: PlayerScore[],
  sideGameConfig: SideGameConfig | null,
): SideGameComputedState {
  const empty: SideGameComputedState = {
    skins: null,
    nassau: null,
    press: null,
    stableford: null,
    processedHoles: [],
  }

  if (!sideGameConfig || !sideGameConfig.sideGamesEnabled || players.length < 2) {
    return empty
  }

  const { gameTypes } = sideGameConfig
  const playerIds = players.map((p) => p.playerId)

  // Find holes where every player has submitted a score
  const processedHoles: number[] = []
  for (let h = 1; h <= 18; h++) {
    const allScored = playerIds.every(
      (pid) => players.find((p) => p.playerId === pid)?.holes[h] !== undefined,
    )
    if (allScored) {
      processedHoles.push(h)
    }
  }

  const hasSkins = gameTypes.includes('skins')
  const hasNassau = gameTypes.includes('nassau') || gameTypes.includes('press')
  const hasPress = gameTypes.includes('press')
  const hasStableford = gameTypes.includes('stableford')

  let skinsState: SkinsState | null = hasSkins
    ? createSkinsState(playerIds, sideGameConfig.stakePerSkin ?? 1)
    : null
  let nassauState: NassauState | null = hasNassau
    ? createNassauState(
        playerIds,
        sideGameConfig.nassauStakeFront ?? 1,
        sideGameConfig.nassauStakeBack ?? 1,
        sideGameConfig.nassauStakeOverall ?? 1,
      )
    : null
  let pressState: PressState | null = hasPress
    ? createPressState(sideGameConfig.pressEnabled, sideGameConfig.pressTriggerThreshold)
    : null
  let stablefordState: StablefordState | null = hasStableford
    ? createStablefordState(playerIds)
    : null

  for (const holeNum of processedHoles) {
    // Build scores map for this hole
    const scoresForHole: Record<string, number> = {}
    for (const pid of playerIds) {
      const holeData = players.find((p) => p.playerId === pid)?.holes[holeNum]
      if (holeData) scoresForHole[pid] = holeData.strokes
    }

    if (skinsState) {
      skinsState = calculateSkinsForHole(holeNum, scoresForHole, skinsState)
    }

    if (nassauState) {
      nassauState = calculateNassauForHole(holeNum, scoresForHole, nassauState)
      if (pressState) {
        pressState = checkPressTrigger(holeNum, nassauState, pressState)
        pressState = updatePressStandings(holeNum, scoresForHole, pressState)
      }
    }

    if (stablefordState) {
      // Use par from the first player who has it for this hole
      const par = players[0]?.holes[holeNum]?.par ?? 4
      stablefordState = calculateStablefordForHole(holeNum, scoresForHole, par, stablefordState)
    }
  }

  return { skins: skinsState, nassau: nassauState, press: pressState, stableford: stablefordState, processedHoles }
}

/**
 * Derives live side game state from the leaderboard store scores and the
 * group round side game config. Recalculates whenever scores or config change.
 *
 * Returns null engines when the corresponding game type is not active.
 */
export function useSideGameState(): SideGameComputedState {
  const players = useLeaderboardStore((s) => s.players)
  const sideGameConfig = useGroupRoundStore((s) => s.sideGameConfig)

  return useMemo(() => computeSideGameState(players, sideGameConfig), [players, sideGameConfig])
}
