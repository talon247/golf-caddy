-- =============================================================================
-- Golf Caddy: Allow guest (unauthenticated) users to host group rounds
-- Migration: 20260328000012_group_rounds_guest_host_insert.sql
-- Author: Software Engineer (THEA-274)
-- =============================================================================
-- Fix: migration 20260328000008 requires auth.uid() IS NOT NULL on INSERT,
--   which blocks unauthenticated (guest) hosts from creating group rounds.
--   This migration relaxes the INSERT policy to allow both:
--     - Authenticated hosts: host_user_id = auth.uid()
--     - Guest hosts: host_user_id IS NULL
-- =============================================================================

-- Drop the restrictive INSERT policy from migration 8
DROP POLICY IF EXISTS "group_rounds_auth_insert" ON public.group_rounds;

-- Recreate with guest-friendly check
DO $$ BEGIN
  CREATE POLICY "group_rounds_auth_or_guest_insert"
    ON public.group_rounds FOR INSERT
    WITH CHECK (
      host_user_id IS NULL OR host_user_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- End of migration
-- =============================================================================
