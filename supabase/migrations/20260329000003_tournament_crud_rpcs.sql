-- =============================================================================
-- Golf Caddy: Tournament CRUD RPCs
-- Migration: 20260329000003_tournament_crud_rpcs.sql
-- Author: Backend Infrastructure Engineer (THEA-418)
-- PRD: THEA-396 (Tournament Mode)
-- =============================================================================
-- Depends on: 20260329000002_tournament_schema.sql
--
-- Adds:
--   - removed_at column to tournament_members (soft removal support)
--   - create_tournament(p_type, p_name, p_config)
--   - join_tournament(p_invite_code, p_guest_name)
--   - update_tournament(p_tournament_id, p_name, p_config, p_status)
--   - remove_tournament_member(p_tournament_id, p_target_user_id)
--   - void_tournament_round(p_tournament_round_id, p_reason)
--   - lock_event_results(p_tournament_id)
--
-- All functions are SECURITY DEFINER with explicit auth.uid() checks.
-- Idempotent: CREATE OR REPLACE FUNCTION, ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Schema additions for soft removal
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournament_members
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 1. create_tournament(p_type, p_name, p_config)
-- ---------------------------------------------------------------------------
-- Creates a tournament + config row, adds creator as commissioner (league)
-- or host (event), generates a unique 6-char alphanumeric invite code.
-- Returns: { tournament, invite_code }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_tournament(
  p_type    public.tournament_type,
  p_name    text,
  p_config  jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_tournament_id uuid;
  v_invite_code   text;
  v_role          public.tournament_member_role;
  v_tournament    record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Determine creator role based on tournament type
  v_role := CASE p_type
    WHEN 'league' THEN 'commissioner'::public.tournament_member_role
    ELSE 'host'::public.tournament_member_role
  END;

  -- Generate a unique 6-char alphanumeric invite code
  LOOP
    v_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.tournaments WHERE join_code = v_invite_code
    );
  END LOOP;

  -- Insert tournament
  INSERT INTO public.tournaments (type, name, creator_id, status, join_code)
  VALUES (p_type, p_name, v_user_id, 'draft', v_invite_code)
  RETURNING id INTO v_tournament_id;

  -- Insert tournament_config
  INSERT INTO public.tournament_config (
    tournament_id,
    start_date,
    end_date,
    points_config,
    format,
    field_size,
    course_id
  ) VALUES (
    v_tournament_id,
    (p_config->>'start_date')::date,
    (p_config->>'end_date')::date,
    COALESCE(p_config->'points_config', '{}'::jsonb),
    p_config->>'format',
    (p_config->>'field_size')::int,
    (p_config->>'course_id')::uuid
  );

  -- Add creator as commissioner or host
  INSERT INTO public.tournament_members (tournament_id, user_id, role)
  VALUES (v_tournament_id, v_user_id, v_role);

  -- Fetch the created tournament for the response
  SELECT t.id, t.type, t.name, t.creator_id, t.status, t.join_code, t.created_at
  INTO v_tournament
  FROM public.tournaments t
  WHERE t.id = v_tournament_id;

  RETURN jsonb_build_object(
    'tournament', row_to_json(v_tournament)::jsonb,
    'invite_code', v_invite_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_tournament(public.tournament_type, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tournament(public.tournament_type, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. join_tournament(p_invite_code, p_guest_name)
-- ---------------------------------------------------------------------------
-- Validates invite code, checks tournament is draft/active.
-- Authenticated users: identified by auth.uid().
-- Unauthenticated (guest): p_guest_name required.
-- Returns: { tournament_id, name, type, status, role }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_tournament(
  p_invite_code text,
  p_guest_name  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_tournament    record;
  v_member_role   public.tournament_member_role;
  v_existing_id   uuid;
BEGIN
  v_user_id := auth.uid();

  -- Validate invite code and tournament status
  SELECT id, type, name, status, creator_id
  INTO v_tournament
  FROM public.tournaments
  WHERE join_code = upper(trim(p_invite_code))
    AND status IN ('draft', 'active');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_invite_code');
  END IF;

  -- League requires authenticated user
  IF v_tournament.type = 'league' AND v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'league_requires_auth');
  END IF;

  -- Event with no auth requires guest_name
  IF v_tournament.type = 'event' AND v_user_id IS NULL AND (p_guest_name IS NULL OR trim(p_guest_name) = '') THEN
    RETURN jsonb_build_object('error', 'guest_name_required');
  END IF;

  -- Check already joined (authenticated users only)
  IF v_user_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.tournament_members
    WHERE tournament_id = v_tournament.id
      AND user_id = v_user_id
      AND removed_at IS NULL;

    IF FOUND THEN
      RETURN jsonb_build_object('error', 'already_joined');
    END IF;
  END IF;

  -- Determine role: 'member' for leagues, 'player' for events
  v_member_role := CASE v_tournament.type
    WHEN 'league' THEN 'member'::public.tournament_member_role
    ELSE 'player'::public.tournament_member_role
  END;

  -- Insert member row
  INSERT INTO public.tournament_members (tournament_id, user_id, role, guest_name)
  VALUES (
    v_tournament.id,
    v_user_id,
    v_member_role,
    CASE WHEN v_user_id IS NULL THEN trim(p_guest_name) ELSE NULL END
  );

  RETURN jsonb_build_object(
    'tournament_id', v_tournament.id,
    'name',          v_tournament.name,
    'type',          v_tournament.type,
    'status',        v_tournament.status,
    'role',          v_member_role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_tournament(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_tournament(text, text) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. update_tournament(p_tournament_id, p_name, p_config, p_status)
-- ---------------------------------------------------------------------------
-- Commissioner or host only. Cannot change type after creation.
-- Updatable: name, config fields, status (not 'completed' — use lock_event_results).
-- Returns: { success: bool, tournament_id, updated_fields }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tournament(
  p_tournament_id uuid,
  p_name          text DEFAULT NULL,
  p_config        jsonb DEFAULT NULL,
  p_status        public.tournament_status DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_tournament  record;
  v_is_admin    boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Fetch tournament
  SELECT id, type, name, status, creator_id
  INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'tournament_not_found');
  END IF;

  -- Cannot update completed/archived tournaments
  IF v_tournament.status IN ('completed', 'archived') THEN
    RETURN jsonb_build_object('error', 'tournament_locked');
  END IF;

  -- Check caller is commissioner, host, or creator
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members tm
    WHERE tm.tournament_id = p_tournament_id
      AND tm.user_id = v_user_id
      AND tm.role IN ('commissioner', 'host')
      AND tm.removed_at IS NULL
  ) OR (v_tournament.creator_id = v_user_id)
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Cannot set status to 'completed' via update (use lock_event_results)
  IF p_status = 'completed' THEN
    RETURN jsonb_build_object('error', 'use_lock_event_results');
  END IF;

  -- Apply updates to tournaments table
  UPDATE public.tournaments SET
    name       = COALESCE(p_name, name),
    status     = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_tournament_id;

  -- Apply updates to tournament_config if p_config provided
  IF p_config IS NOT NULL THEN
    UPDATE public.tournament_config SET
      start_date    = COALESCE((p_config->>'start_date')::date, start_date),
      end_date      = COALESCE((p_config->>'end_date')::date, end_date),
      points_config = COALESCE(p_config->'points_config', points_config),
      format        = COALESCE(p_config->>'format', format),
      field_size    = COALESCE((p_config->>'field_size')::int, field_size),
      course_id     = COALESCE((p_config->>'course_id')::uuid, course_id),
      updated_at    = now()
    WHERE tournament_id = p_tournament_id;
  END IF;

  RETURN jsonb_build_object(
    'success',       true,
    'tournament_id', p_tournament_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_tournament(uuid, text, jsonb, public.tournament_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tournament(uuid, text, jsonb, public.tournament_status) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. remove_tournament_member(p_tournament_id, p_target_user_id)
-- ---------------------------------------------------------------------------
-- Commissioner/host only. Soft removal: sets removed_at.
-- Historical data (rounds, standings) preserved for audit.
-- Returns: { success: bool, member_id }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_tournament_member(
  p_tournament_id   uuid,
  p_target_user_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_is_admin   boolean;
  v_member_id  uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Check caller is commissioner, host, or creator
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members tm
    WHERE tm.tournament_id = p_tournament_id
      AND tm.user_id = v_user_id
      AND tm.role IN ('commissioner', 'host')
      AND tm.removed_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = p_tournament_id AND t.creator_id = v_user_id
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Cannot remove yourself if you are the last commissioner/host
  -- (guard: at least one commissioner/host must remain)
  IF p_target_user_id = v_user_id THEN
    RETURN jsonb_build_object('error', 'cannot_remove_self');
  END IF;

  -- Find and soft-remove the member
  UPDATE public.tournament_members
  SET removed_at = now()
  WHERE tournament_id = p_tournament_id
    AND user_id = p_target_user_id
    AND removed_at IS NULL
  RETURNING id INTO v_member_id;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'member_not_found');
  END IF;

  RETURN jsonb_build_object(
    'success',   true,
    'member_id', v_member_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_tournament_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_tournament_member(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. void_tournament_round(p_tournament_round_id, p_reason)
-- ---------------------------------------------------------------------------
-- Commissioner/host only. Sets voided_at and voided_by on the round row.
-- The standings recalculation trigger (THEA-419) fires on this update.
-- Returns: { success: bool, tournament_round_id, voided_at }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_tournament_round(
  p_tournament_round_id uuid,
  p_reason              text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_tr         record;
  v_is_admin   boolean;
  v_voided_at  timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Fetch the tournament round
  SELECT id, tournament_id, voided_at
  INTO v_tr
  FROM public.tournament_rounds
  WHERE id = p_tournament_round_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'round_not_found');
  END IF;

  IF v_tr.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_voided');
  END IF;

  -- Check caller is commissioner, host, or creator
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members tm
    WHERE tm.tournament_id = v_tr.tournament_id
      AND tm.user_id = v_user_id
      AND tm.role IN ('commissioner', 'host')
      AND tm.removed_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = v_tr.tournament_id AND t.creator_id = v_user_id
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  v_voided_at := now();

  UPDATE public.tournament_rounds
  SET voided_at = v_voided_at,
      voided_by = v_user_id
  WHERE id = p_tournament_round_id;

  RETURN jsonb_build_object(
    'success',               true,
    'tournament_round_id',   p_tournament_round_id,
    'voided_at',             v_voided_at,
    'reason',                p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_tournament_round(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_tournament_round(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. lock_event_results(p_tournament_id)
-- ---------------------------------------------------------------------------
-- Host only, events only. Sets status='completed'. Irreversible in V4.
-- Freezes standings for display. Settlement calculation follows (THEA-419).
-- Returns: { success: bool, tournament_id, locked_at }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_event_results(
  p_tournament_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_tournament record;
  v_is_host    boolean;
  v_locked_at  timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Fetch tournament
  SELECT id, type, status, creator_id
  INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'tournament_not_found');
  END IF;

  -- Events only
  IF v_tournament.type <> 'event' THEN
    RETURN jsonb_build_object('error', 'leagues_use_settle_points');
  END IF;

  -- Already completed
  IF v_tournament.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  -- Only active events can be locked
  IF v_tournament.status NOT IN ('active', 'draft') THEN
    RETURN jsonb_build_object('error', 'tournament_not_active');
  END IF;

  -- Check caller is host or creator
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members tm
    WHERE tm.tournament_id = p_tournament_id
      AND tm.user_id = v_user_id
      AND tm.role = 'host'
      AND tm.removed_at IS NULL
  ) OR (v_tournament.creator_id = v_user_id)
  INTO v_is_host;

  IF NOT v_is_host THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  v_locked_at := now();

  UPDATE public.tournaments
  SET status     = 'completed',
      updated_at = v_locked_at
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object(
    'success',        true,
    'tournament_id',  p_tournament_id,
    'locked_at',      v_locked_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lock_event_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_event_results(uuid) TO authenticated;
