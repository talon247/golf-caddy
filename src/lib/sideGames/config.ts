// Supabase persistence for side_game_configs table
import { supabase } from '../supabase'
import type { SideGameConfig, SideGameType } from '../../types'

interface SideGameConfigRow {
  id: string
  group_round_id: string
  game_types: SideGameType[]
  stake_per_skin: number | null
  nassau_stake_front: number | null
  nassau_stake_back: number | null
  nassau_stake_overall: number | null
  press_enabled: boolean
  press_trigger_threshold: number
  created_at: string
}

/**
 * Saves (upserts) side game config for a group round.
 * Also updates side_games_enabled on the group_rounds row.
 * Throws on Supabase error.
 */
export async function saveSideGameConfig(
  groupRoundId: string,
  config: SideGameConfig,
): Promise<void> {
  const { error: roundError } = await supabase
    .from('group_rounds')
    .update({ side_games_enabled: config.sideGamesEnabled })
    .eq('id', groupRoundId)

  if (roundError) throw roundError

  if (!config.sideGamesEnabled) return

  const { error: configError } = await supabase
    .from('side_game_configs')
    .upsert(
      {
        group_round_id: groupRoundId,
        game_types: config.gameTypes,
        stake_per_skin: config.stakePerSkin,
        nassau_stake_front: config.nassauStakeFront,
        nassau_stake_back: config.nassauStakeBack,
        nassau_stake_overall: config.nassauStakeOverall,
        press_enabled: config.pressEnabled,
        press_trigger_threshold: config.pressTriggerThreshold,
      },
      { onConflict: 'group_round_id' },
    )

  if (configError) throw configError
}

/**
 * Reads the side game config for a group round.
 * Returns null if no config row exists.
 */
export async function fetchSideGameConfig(
  groupRoundId: string,
): Promise<SideGameConfig | null> {
  const { data, error } = await supabase
    .from('side_game_configs')
    .select('*')
    .eq('group_round_id', groupRoundId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as SideGameConfigRow

  return {
    sideGamesEnabled: true,
    gameTypes: (row.game_types as SideGameType[]) ?? [],
    stakePerSkin: row.stake_per_skin ?? null,
    nassauStakeFront: row.nassau_stake_front ?? null,
    nassauStakeBack: row.nassau_stake_back ?? null,
    nassauStakeOverall: row.nassau_stake_overall ?? null,
    pressEnabled: row.press_enabled ?? true,
    pressTriggerThreshold: row.press_trigger_threshold ?? 2,
  }
}
