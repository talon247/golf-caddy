-- =============================================================================
-- Golf Caddy: Join Group Round RPC Functions
-- Migration: 20260327000004_join_group_round_rpc.sql
-- Author: Software Engineer 2 (THEA-80) — schema-fixed by Backend IE (THEA-75)
-- =============================================================================
-- SECURITY DEFINER functions so any client (authed or guest) can join a group
-- round by room code. Bypasses RLS for controlled, validated operations only.
--
-- Schema fixes vs. original THEA-80 draft (000003):
--   - Renumbered 000003 → 000004 (000003 already used by handicap_fields)
--   - Removed expires_at (column does not exist in applied schema 000002)
--   - Replaced p_display_name / display_name with p_player_name / player_name
--   - Removed user_id insert (column not in group_round_players)
--   - Replaced expires_at reference in get_group_round_lobby with hostName
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. join_group_round
--    Atomic join: validates room code, enforces 4-player cap, inserts row.
--    Returns jsonb — check 'success' key; 'error' key describes failure.
--    No auth required — any client can call with room code + player name.
-- ---------------------------------------------------------------------------
create or replace function public.join_group_round(
  p_room_code   text,
  p_player_name text
) returns jsonb language plpgsql security definer as $$
declare
  v_group_round  public.group_rounds;
  v_player_count int;
  v_player_id    uuid;
begin
  -- Validate player name
  if length(trim(p_player_name)) < 1 or length(trim(p_player_name)) > 20 then
    return jsonb_build_object(
      'success', false,
      'error',   'invalid_name',
      'message', 'Player name must be 1–20 characters.'
    );
  end if;

  -- Find a valid waiting room
  select * into v_group_round
  from public.group_rounds
  where room_code = upper(trim(p_room_code))
    and status    = 'waiting';

  if not found then
    -- Distinguish started/completed vs. unknown
    if exists (
      select 1 from public.group_rounds
      where room_code = upper(trim(p_room_code))
        and status in ('active', 'completed')
    ) then
      return jsonb_build_object(
        'success', false,
        'error',   'started',
        'message', 'This round has already started.'
      );
    end if;

    return jsonb_build_object(
      'success', false,
      'error',   'not_found',
      'message', 'Code not found. Check the code and try again.'
    );
  end if;

  -- Enforce 4-player cap
  select count(*) into v_player_count
  from public.group_round_players
  where group_round_id = v_group_round.id;

  if v_player_count >= 4 then
    return jsonb_build_object(
      'success', false,
      'error',   'full',
      'message', 'This round is full (4/4 players).'
    );
  end if;

  -- Insert player row
  insert into public.group_round_players (group_round_id, player_name)
  values (v_group_round.id, trim(p_player_name))
  returning id into v_player_id;

  return jsonb_build_object(
    'success',      true,
    'groupRoundId', v_group_round.id,
    'playerId',     v_player_id,
    'roomCode',     v_group_round.room_code
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. get_group_round_lobby
--    Returns current round status + player list for a room code.
--    SECURITY DEFINER so any client can poll the lobby (no auth needed).
-- ---------------------------------------------------------------------------
create or replace function public.get_group_round_lobby(
  p_room_code text
) returns jsonb language plpgsql security definer as $$
declare
  v_group_round  public.group_rounds;
  v_players      jsonb;
begin
  select * into v_group_round
  from public.group_rounds
  where room_code = upper(trim(p_room_code))
  limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',         grp.id,
      'playerName', grp.player_name,
      'joinedAt',   grp.joined_at
    ) order by grp.joined_at
  ) into v_players
  from public.group_round_players grp
  where grp.group_round_id = v_group_round.id;

  return jsonb_build_object(
    'id',       v_group_round.id,
    'roomCode', v_group_round.room_code,
    'hostName', v_group_round.host_name,
    'status',   v_group_round.status,
    'players',  coalesce(v_players, '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
