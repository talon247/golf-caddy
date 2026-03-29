-- =============================================================================
-- Golf Caddy: Guest Join API Hardening + Room Code TTL + Rate Limiting
-- Migration: 20260329000001_join_api_hardening.sql
-- Author: Backend Infrastructure Engineer (THEA-399)
-- Parent: THEA-385 (One Link Golf)
-- =============================================================================
-- Changes:
--   1. Create join_rate_limits table (session-key based brute-force protection)
--   2. Add TTL extension trigger: extends expires_at 24h when status → completed
--   3. Replace join_group_round() — restores expires_at check + adds rate limiting
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. join_rate_limits table
--    Tracks join attempts per client session key within a 1-minute window.
--    Populated exclusively via the join_group_round SECURITY DEFINER RPC;
--    direct DML requires auth.uid() IS NOT NULL (belt-and-suspenders).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.join_rate_limits (
  session_key   TEXT        NOT NULL,
  attempt_count INT         NOT NULL DEFAULT 1,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_key)
);

ALTER TABLE public.join_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct-access policies needed; table is only touched via SECURITY DEFINER RPC.
-- Deny all direct DML from non-service callers.
DO $$ BEGIN
  CREATE POLICY "join_rate_limits_deny_direct"
    ON public.join_rate_limits
    AS RESTRICTIVE
    FOR ALL
    USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Periodic cleanup index — keep lookups fast even after table grows
CREATE INDEX IF NOT EXISTS join_rate_limits_window_idx
  ON public.join_rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- 2. TTL extension trigger
--    When a group round transitions to 'completed', extend its expires_at
--    to now() + 24h so the code remains identifiable (e.g. in wager screens)
--    for a grace period before being fully invalidated.
--    Fires BEFORE UPDATE so we can modify NEW directly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extend_expires_at_on_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.expires_at IS NOT NULL
  THEN
    NEW.expires_at := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_rounds_extend_expiry_on_complete ON public.group_rounds;

CREATE TRIGGER group_rounds_extend_expiry_on_complete
  BEFORE UPDATE ON public.group_rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.extend_expires_at_on_completion();

-- ---------------------------------------------------------------------------
-- 3. join_group_round (hardened replacement)
--    Changes vs. previous version (20260328000001):
--      - New optional p_session_key param for rate limiting (default NULL)
--      - Restores expires_at < now() rejection (was dropped in migration 001)
--      - Rate limit: 5 attempts per session key per 60-second window
--
--    NOTE on rate limiting approach:
--      We use a client-supplied session_key (UUID from sessionStorage) rather
--      than inet_client_addr() because in Supabase's connection pool the
--      client address returns the PostgREST proxy IP, not the real client.
--      If p_session_key is NULL the rate limit check is skipped (backward
--      compat for any direct RPC callers that don't supply the key yet).
-- ---------------------------------------------------------------------------

-- Drop old 2-arg overload to avoid ambiguity with the new 3-arg default variant
DROP FUNCTION IF EXISTS public.join_group_round(text, text);

CREATE OR REPLACE FUNCTION public.join_group_round(
  p_room_code   text,
  p_player_name text,
  p_session_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_group_round   public.group_rounds;
  v_player_count  int;
  v_player_id     uuid;
  v_attempt_count int;
BEGIN
  -- -------------------------------------------------------------------
  -- Rate limiting (session-key based)
  -- -------------------------------------------------------------------
  IF p_session_key IS NOT NULL THEN
    INSERT INTO public.join_rate_limits (session_key, attempt_count, window_start)
    VALUES (p_session_key, 1, now())
    ON CONFLICT (session_key) DO UPDATE
      SET attempt_count = CASE
            WHEN join_rate_limits.window_start > now() - interval '1 minute'
            THEN join_rate_limits.attempt_count + 1
            ELSE 1
          END,
          window_start = CASE
            WHEN join_rate_limits.window_start > now() - interval '1 minute'
            THEN join_rate_limits.window_start
            ELSE now()
          END
    RETURNING attempt_count INTO v_attempt_count;

    IF v_attempt_count > 5 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   'rate_limited',
        'message', 'Too many join attempts. Please wait a moment and try again.'
      );
    END IF;
  END IF;

  -- -------------------------------------------------------------------
  -- Validate player name
  -- -------------------------------------------------------------------
  IF length(trim(p_player_name)) < 1 OR length(trim(p_player_name)) > 20 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'invalid_name',
      'message', 'Player name must be 1–20 characters.'
    );
  END IF;

  -- -------------------------------------------------------------------
  -- Find a valid waiting or active room
  -- -------------------------------------------------------------------
  SELECT * INTO v_group_round
  FROM public.group_rounds
  WHERE room_code = upper(trim(p_room_code))
    AND status IN ('waiting', 'active');

  IF NOT FOUND THEN
    -- Distinguish completed vs. unknown
    IF EXISTS (
      SELECT 1 FROM public.group_rounds
      WHERE room_code = upper(trim(p_room_code))
        AND status = 'completed'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',   'completed',
        'message', 'This round has already completed.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error',   'not_found',
      'message', 'Code not found. Check the code and try again.'
    );
  END IF;

  -- -------------------------------------------------------------------
  -- Reject expired room codes
  -- -------------------------------------------------------------------
  IF v_group_round.expires_at IS NOT NULL AND v_group_round.expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'expired',
      'message', 'This room code has expired.'
    );
  END IF;

  -- -------------------------------------------------------------------
  -- Enforce 4-player cap
  -- -------------------------------------------------------------------
  SELECT count(*) INTO v_player_count
  FROM public.group_round_players
  WHERE group_round_id = v_group_round.id;

  IF v_player_count >= 4 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'full',
      'message', 'This round is full (4/4 players).'
    );
  END IF;

  -- -------------------------------------------------------------------
  -- Insert player row
  -- -------------------------------------------------------------------
  INSERT INTO public.group_round_players (group_round_id, player_name)
  VALUES (v_group_round.id, trim(p_player_name))
  RETURNING id INTO v_player_id;

  RETURN jsonb_build_object(
    'success',      true,
    'groupRoundId', v_group_round.id,
    'playerId',     v_player_id,
    'roomCode',     v_group_round.room_code,
    'status',       v_group_round.status,
    'courseName',   v_group_round.course_name,
    'holeCount',    v_group_round.hole_count,
    'pars',         v_group_round.pars,
    'courseRating', v_group_round.course_rating,
    'slopeRating',  v_group_round.slope_rating
  );
END;
$$;

-- Grant execute to unauthenticated and authenticated callers
GRANT EXECUTE ON FUNCTION public.join_group_round(text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cleanup: purge rate limit records older than 10 minutes to keep table small.
-- Scheduled hourly alongside the existing group round cleanup job.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_stale_join_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.join_rate_limits
  WHERE window_start < now() - interval '10 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_join_rate_limits() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('golf-caddy: cleanup stale join rate limits')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'golf-caddy: cleanup stale join rate limits'
    );

    PERFORM cron.schedule(
      'golf-caddy: cleanup stale join rate limits',
      '30 * * * *',  -- every hour at :30 (UTC), offset from the group-round cleanup
      $cron$SELECT public.cleanup_stale_join_rate_limits();$cron$
    );
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- =============================================================================
-- End of migration
-- =============================================================================
