-- =============================================================================
-- Golf Caddy: Group Rounds Cleanup Job
-- Migration: 20260327000007_group_rounds_cleanup.sql
-- Author: Software Engineer (THEA-115)
-- =============================================================================
-- Changes:
--   1. cleanup_expired_group_rounds() — marks stale waiting/active rounds as
--      'completed' so room codes are freed from the partial-unique index
--   2. Schedules the function hourly via pg_cron (no-op if pg_cron not enabled)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cleanup function
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_expired_group_rounds()
returns void language plpgsql security definer as $$
begin
  update public.group_rounds
  set    status     = 'completed',
         updated_at = now()
  where  expires_at < now()
    and  status in ('waiting', 'active');
end;
$$;

-- Grant execute to the service role so it can be called from scheduled jobs
grant execute on function public.cleanup_expired_group_rounds() to service_role;

-- ---------------------------------------------------------------------------
-- 2. Schedule via pg_cron (hourly at :00)
--    Wrapped in an anonymous block so the migration doesn't fail on projects
--    that don't have the pg_cron extension enabled.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Only schedule if pg_cron extension is present
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    -- Remove any pre-existing schedule for this job name to make idempotent
    perform cron.unschedule('golf-caddy: cleanup expired group rounds')
    where exists (
      select 1 from cron.job where jobname = 'golf-caddy: cleanup expired group rounds'
    );

    perform cron.schedule(
      'golf-caddy: cleanup expired group rounds',
      '0 * * * *',  -- every hour on the hour (UTC)
      $$select public.cleanup_expired_group_rounds();$$
    );
  end if;
exception
  when others then
    -- pg_cron scheduling is best-effort; do not abort the migration
    null;
end $$;

-- =============================================================================
-- End of migration
-- =============================================================================
