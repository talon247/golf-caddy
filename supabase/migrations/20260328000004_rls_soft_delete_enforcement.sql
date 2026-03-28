-- Migration: RLS soft-delete enforcement for rounds and clubs tables
-- THEA-161: Update RLS policies to exclude soft-deleted records from Supabase client access.
--
-- Current policies use `auth.uid() = user_id` only, so soft-deleted records (deleted_at IS NOT NULL)
-- are still visible via direct Supabase queries. This migration adds `deleted_at IS NULL` to the
-- USING clause on both tables.
--
-- Behavior after migration:
--   SELECT: soft-deleted records invisible to authenticated users ✓
--   UPDATE: soft-deleted records cannot be modified (including un-deleting) ✓
--   DELETE: soft-deleted records cannot be hard-deleted by users ✓
--   INSERT: `deleted_at` defaults NULL so new records pass ✓
--   Service role: bypasses RLS, retains full access for cleanup jobs ✓

-- ============================================================
-- 1. clubs table
-- ============================================================

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'clubs'
      and policyname = 'clubs_all_own'
  ) then
    drop policy "clubs_all_own" on public.clubs;
  end if;
end $$;

create policy "clubs_all_own"
  on public.clubs for all
  using (auth.uid() = user_id and deleted_at is null);

-- ============================================================
-- 2. rounds table
-- ============================================================

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'rounds'
      and policyname = 'rounds_all_own'
  ) then
    drop policy "rounds_all_own" on public.rounds;
  end if;
end $$;

create policy "rounds_all_own"
  on public.rounds for all
  using (auth.uid() = user_id and deleted_at is null);
