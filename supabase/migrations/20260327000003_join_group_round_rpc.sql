-- =============================================================================
-- Golf Caddy: Join Group Round RPC Functions
-- Migration: 20260327000003_join_group_round_rpc.sql
-- Author: Software Engineer 2 (THEA-80)
-- =============================================================================
-- Provides SECURITY DEFINER functions so guest players (no Supabase account)
-- can join a group round by room code. Bypasses RLS for controlled operations.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. join_group_round
--    Atomic join: validates code, enforces 4-player cap, inserts player row.
--    Returns a discriminated union as jsonb — check the 'error' key.
-- ---------------------------------------------------------------------------
create or replace function public.join_group_round(
  p_room_code  text,
  p_display_name text
) returns jsonb language plpgsql security definer as $$
declare
  v_group_round public.group_rounds;
  v_player_count int;
  v_player_id    uuid;
begin
  -- Validate display name length
  if length(trim(p_display_name)) < 1 or length(trim(p_display_name)) > 20 then
    return jsonb_build_object(
      'success', false,
      'error',   'invalid_name',
      'message', 'Display name must be 1–20 characters.'
    );
  end if;

  -- Find a valid (non-expired, waiting) room
  select * into v_group_round
  from public.group_rounds
  where room_code = upper(trim(p_room_code))
    and status    = 'waiting'
    and expires_at > now();

  if not found then
    -- Distinguish expired vs. completely unknown
    if exists (
      select 1 from public.group_rounds
      where room_code = upper(trim(p_room_code))
        and expires_at <= now()
    ) then
      return jsonb_build_object(
        'success', false,
        'error',   'expired',
        'message', 'This round has already ended.'
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

  -- Insert player (user_id may be null for guests)
  insert into public.group_round_players (group_round_id, user_id, display_name)
  values (v_group_round.id, auth.uid(), trim(p_display_name))
  returning id into v_player_id;

  return jsonb_build_object(
    'success',       true,
    'groupRoundId',  v_group_round.id,
    'playerId',      v_player_id,
    'roomCode',      v_group_round.room_code
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. get_group_round_lobby
--    Returns current round status + player list for a room code.
--    SECURITY DEFINER so guests (no auth.uid()) can poll the lobby.
-- ---------------------------------------------------------------------------
create or replace function public.get_group_round_lobby(
  p_room_code text
) returns jsonb language plpgsql security definer as $$
declare
  v_group_round public.group_rounds;
  v_players     jsonb;
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
      'id',          grp.id,
      'displayName', grp.display_name,
      'joinedAt',    grp.joined_at
    ) order by grp.joined_at
  ) into v_players
  from public.group_round_players grp
  where grp.group_round_id = v_group_round.id;

  return jsonb_build_object(
    'id',        v_group_round.id,
    'roomCode',  v_group_round.room_code,
    'status',    v_group_round.status,
    'expiresAt', v_group_round.expires_at,
    'players',   coalesce(v_players, '[]'::jsonb)
  );
end;
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
