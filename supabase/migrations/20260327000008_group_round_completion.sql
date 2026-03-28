-- =============================================================================
-- Golf Caddy: Group Round Completion
-- Migration: 20260327000005_group_round_completion.sql
-- Author: Software Engineer 2 (THEA-84)
-- =============================================================================
-- Adds round_id tracking to group_round_players so that when all players
-- save their individual rounds, the group round auto-transitions to completed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add round_id column to group_round_players
--    Stores the local round ID once a player has submitted their scorecard.
-- ---------------------------------------------------------------------------
alter table public.group_round_players
  add column if not exists round_id text;

-- ---------------------------------------------------------------------------
-- 2. RPC: complete_group_round_player
--    Called by the client when a player finishes their round.
--    Links the saved round to the group round player row.
--    Returns the updated group round status.
-- ---------------------------------------------------------------------------
create or replace function public.complete_group_round_player(
  p_group_round_id uuid,
  p_player_id      uuid,
  p_round_id       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_players  int;
  v_done_players   int;
  v_new_status     public.group_round_status;
begin
  -- Mark this player as done
  update public.group_round_players
  set round_id = p_round_id
  where id = p_player_id
    and group_round_id = p_group_round_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'player_not_found');
  end if;

  -- Check if all players in this round have submitted
  select
    count(*),
    count(*) filter (where round_id is not null)
  into v_total_players, v_done_players
  from public.group_round_players
  where group_round_id = p_group_round_id;

  -- Auto-complete when all players are done
  if v_total_players > 0 and v_done_players = v_total_players then
    update public.group_rounds
    set status = 'completed'
    where id = p_group_round_id
      and status = 'active';

    v_new_status := 'completed';
  else
    select status into v_new_status
    from public.group_rounds
    where id = p_group_round_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'groupRoundStatus', v_new_status::text,
    'completedPlayers', v_done_players,
    'totalPlayers', v_total_players
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC: end_group_round
--    Host-triggered manual round end.
--    Sets status to completed regardless of individual player submissions.
-- ---------------------------------------------------------------------------
create or replace function public.end_group_round(
  p_group_round_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_rounds
  set status = 'completed'
  where id = p_group_round_id
    and status = 'active';

  if not found then
    -- May already be completed or not found
    return jsonb_build_object('success', false, 'error', 'not_active');
  end if;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Policy for group_round_players UPDATE (needed for complete_group_round_player)
-- ---------------------------------------------------------------------------
do $$ begin
  create policy "group_round_players_public_update"
    on public.group_round_players for update using (true);
exception when duplicate_object then null; end $$;

-- =============================================================================
-- End of migration
-- =============================================================================
