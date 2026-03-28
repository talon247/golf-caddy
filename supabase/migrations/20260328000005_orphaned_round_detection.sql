-- =============================================================================
-- Golf Caddy: Orphaned Round Detection + Recovery RPCs
-- Migration: 20260328000005_orphaned_round_detection.sql
-- Author: Backend Infrastructure Engineer (THEA-160)
-- Parent: THEA-152
-- =============================================================================
-- Idempotent: uses CREATE OR REPLACE FUNCTION. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. detect_orphaned_rounds(p_user_id uuid)
--    Returns a set of (round_id, orphan_type, detail) rows for all rounds
--    belonging to p_user_id that exhibit any orphaned/inconsistent state:
--      - 'no_holes'              : completed/active round has zero hole rows
--      - 'hole_no_shots'         : a hole within the round has zero shot rows
--      - 'completed_no_timestamp': status='completed' but completed_at IS NULL
--      - 'hole_count_mismatch'   : actual hole count != rounds.hole_count
--    Security: SECURITY DEFINER; enforces auth.uid() = p_user_id.
-- ---------------------------------------------------------------------------
create or replace function public.detect_orphaned_rounds(p_user_id uuid)
returns table (
  round_id    uuid,
  orphan_type text,
  detail      text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Callers may only inspect their own data
  if auth.uid() != p_user_id then
    raise exception 'detect_orphaned_rounds: access denied';
  end if;

  -- Rounds with no hole rows (not deleted, not abandoned)
  return query
    select
      r.id                                                             as round_id,
      'no_holes'::text                                                 as orphan_type,
      format('Round has 0 holes, expected %s', r.hole_count)::text    as detail
    from public.rounds r
    where r.user_id    = p_user_id
      and r.deleted_at is null
      and r.status     != 'abandoned'
      and not exists (
        select 1 from public.holes h where h.round_id = r.id
      );

  -- Holes with no shot rows (report the containing round_id)
  return query
    select
      h.round_id                                                           as round_id,
      'hole_no_shots'::text                                                as orphan_type,
      format('Hole %s has 0 shots', h.hole_number)::text                  as detail
    from public.holes h
    join public.rounds r on r.id = h.round_id
    where r.user_id    = p_user_id
      and r.deleted_at is null
      and r.status     != 'abandoned'
      and not exists (
        select 1 from public.shots s where s.hole_id = h.id
      );

  -- Completed rounds missing completed_at timestamp
  return query
    select
      r.id                                                                 as round_id,
      'completed_no_timestamp'::text                                       as orphan_type,
      'status=completed but completed_at IS NULL'::text                    as detail
    from public.rounds r
    where r.user_id      = p_user_id
      and r.deleted_at   is null
      and r.status       = 'completed'
      and r.completed_at is null;

  -- Rounds where the actual hole row count doesn't match rounds.hole_count
  return query
    select
      r.id                                                                           as round_id,
      'hole_count_mismatch'::text                                                    as orphan_type,
      format('Expected %s holes, found %s', r.hole_count, count(h.id))::text        as detail
    from public.rounds r
    left join public.holes h on h.round_id = r.id
    where r.user_id    = p_user_id
      and r.deleted_at is null
      and r.status     != 'abandoned'
    group by r.id, r.hole_count
    having count(h.id) != r.hole_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. recover_orphaned_rounds(p_user_id uuid)
--    Marks every round returned by detect_orphaned_rounds as status='abandoned'.
--    Returns the count of rounds updated.
--    Security: SECURITY DEFINER; enforces auth.uid() = p_user_id.
-- ---------------------------------------------------------------------------
create or replace function public.recover_orphaned_rounds(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Callers may only recover their own data
  if auth.uid() != p_user_id then
    raise exception 'recover_orphaned_rounds: access denied';
  end if;

  with orphan_ids as (
    select distinct round_id
    from public.detect_orphaned_rounds(p_user_id)
  )
  update public.rounds
  set
    status     = 'abandoned',
    updated_at = now()
  where id         in (select round_id from orphan_ids)
    and user_id    = p_user_id
    and status     != 'abandoned'
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- End of migration
-- =============================================================================
