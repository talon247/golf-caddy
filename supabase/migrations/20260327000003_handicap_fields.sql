-- =============================================================================
-- Golf Caddy: Handicap Fields Migration
-- Migration: 20260327000003_handicap_fields.sql
-- Author: Backend Infrastructure Engineer (THEA-88)
-- Feature: WHS Handicap Estimate (THEA-85)
-- =============================================================================
-- Idempotent: uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- Safe to re-run.
--
-- Note: rounds.course_name and rounds.tees already exist from the initial
-- schema (20260327000001). This migration adds the 4 WHS-specific columns
-- and a tee_set alias column for frontend display clarity.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Add handicap columns to rounds
-- ---------------------------------------------------------------------------

-- course_rating: USGA/R&A course rating, e.g. 71.4
alter table public.rounds
  add column if not exists course_rating numeric(4,1) null;

-- slope_rating: USGA slope (55–155, scratch baseline = 113)
alter table public.rounds
  add column if not exists slope_rating integer null
    check (slope_rating is null or (slope_rating >= 55 and slope_rating <= 155));

-- adjusted_gross_score: gross score after Net Double Bogey cap applied per hole
alter table public.rounds
  add column if not exists adjusted_gross_score integer null;

-- score_differential: (AGS - course_rating) × 113 / slope_rating
-- Stored as computed-at-write to avoid recalculation in queries.
alter table public.rounds
  add column if not exists score_differential numeric(4,1) null;

-- tee_set: descriptive tee name for display (e.g. "Men White", "Women Red").
-- rounds.tees already exists for legacy storage; tee_set is the canonical
-- display-friendly field going forward.
alter table public.rounds
  add column if not exists tee_set text null;

-- ---------------------------------------------------------------------------
-- Index: speed up handicap history queries (most recent completed rounds)
-- ---------------------------------------------------------------------------
create index if not exists rounds_user_differential_idx
  on public.rounds(user_id, score_differential)
  where deleted_at is null
    and status = 'completed'
    and score_differential is not null;

-- ---------------------------------------------------------------------------
-- RLS: existing "rounds_all_own" policy already covers all operations on
-- rounds where auth.uid() = user_id, so no new policies are needed.
-- Verify it is still in place (no-op if already enabled).
-- ---------------------------------------------------------------------------
alter table public.rounds enable row level security;

-- =============================================================================
-- End of migration
-- =============================================================================
