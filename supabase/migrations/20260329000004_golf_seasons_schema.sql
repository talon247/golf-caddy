-- =============================================================================
-- Golf Caddy: Golf Seasons Schema + RLS Policies
-- Migration: 20260329000004_golf_seasons_schema.sql
-- Author: Backend Infrastructure Engineer (THEA-431)
-- PRD: THEA-278 (Golf Seasons)
-- =============================================================================
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- enum/policy creation wrapped in DO blocks with duplicate_object guards.
--
-- Tables created:
--   1. seasons           — top-level friend league entity
--   2. season_members    — membership + points balance per user
--   3. season_transactions — immutable audit log for points transfers
--
-- NOTE: Golf Seasons is SEPARATE from Tournament Mode.
-- Golf Seasons = lightweight friend league (points wagering between friends).
-- Tournament Mode = formal club/event structure.
-- See CTO architecture review on THEA-278.
--
-- RLS summary:
--   seasons:              creator full CRUD; members SELECT; no public read
--   season_members:       creator/season CRUD; members read own row; no cross-member write
--   season_transactions:  members SELECT; service-role INSERT only (append-only audit log)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.season_status AS ENUM ('draft', 'active', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.season_game_type AS ENUM (
    'skins',
    'nassau_front',
    'nassau_back',
    'nassau_overall'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. seasons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seasons (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  creator_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          public.season_status NOT NULL DEFAULT 'draft',
  start_date      date,
  end_date        date,
  points_config   jsonb       NOT NULL DEFAULT '{
    "skins_pts": 2,
    "nassau_front": 5,
    "nassau_back": 5,
    "nassau_overall": 5
  }'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seasons_creator_idx
  ON public.seasons(creator_id);

CREATE INDEX IF NOT EXISTS seasons_status_idx
  ON public.seasons(status);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS seasons_updated_at ON public.seasons;
CREATE TRIGGER seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. season_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_members (
  season_id       uuid        NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_balance  numeric(10,2) NOT NULL DEFAULT 100,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  left_at         timestamptz,

  PRIMARY KEY (season_id, user_id)
);

CREATE INDEX IF NOT EXISTS season_members_season_idx
  ON public.season_members(season_id);

CREATE INDEX IF NOT EXISTS season_members_user_idx
  ON public.season_members(user_id);

ALTER TABLE public.season_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. season_transactions
-- ---------------------------------------------------------------------------
-- Immutable audit log — rows are NEVER updated or deleted.
-- INSERT is service-role only (enforced via RLS + SECURITY DEFINER RPCs).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.season_transactions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid        NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  group_round_id  uuid        REFERENCES public.group_rounds(id) ON DELETE SET NULL,
  payer_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payee_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points          numeric(10,2) NOT NULL,
  game_type       public.season_game_type NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT season_transactions_no_self_transfer
    CHECK (payer_user_id <> payee_user_id),
  CONSTRAINT season_transactions_positive_points
    CHECK (points > 0)
);

CREATE INDEX IF NOT EXISTS season_transactions_season_idx
  ON public.season_transactions(season_id);

CREATE INDEX IF NOT EXISTS season_transactions_payer_idx
  ON public.season_transactions(payer_user_id);

CREATE INDEX IF NOT EXISTS season_transactions_payee_idx
  ON public.season_transactions(payee_user_id);

CREATE INDEX IF NOT EXISTS season_transactions_group_round_idx
  ON public.season_transactions(group_round_id)
  WHERE group_round_id IS NOT NULL;

ALTER TABLE public.season_transactions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies — applied after all tables exist
-- =============================================================================

-- ---------------------------------------------------------------------------
-- seasons policies
-- ---------------------------------------------------------------------------

-- Creator: full CRUD
DO $$ BEGIN
  CREATE POLICY "seasons_creator_all"
    ON public.seasons FOR ALL
    USING (auth.uid() = creator_id)
    WITH CHECK (auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Members: SELECT (must have a season_members row for this season)
DO $$ BEGIN
  CREATE POLICY "seasons_member_select"
    ON public.seasons FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.season_members sm
        WHERE sm.season_id = id
          AND sm.user_id = auth.uid()
          AND sm.left_at IS NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- season_members policies
-- ---------------------------------------------------------------------------

-- Creator of the season: full CRUD on members
DO $$ BEGIN
  CREATE POLICY "season_members_creator_all"
    ON public.season_members FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.seasons s
        WHERE s.id = season_id AND s.creator_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.seasons s
        WHERE s.id = season_id AND s.creator_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Members: read any member row in seasons they belong to
DO $$ BEGIN
  CREATE POLICY "season_members_member_select"
    ON public.season_members FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.season_members sm2
        WHERE sm2.season_id = season_id
          AND sm2.user_id = auth.uid()
          AND sm2.left_at IS NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users: read their own member row even after leaving (for audit)
DO $$ BEGIN
  CREATE POLICY "season_members_self_select"
    ON public.season_members FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- season_transactions policies
-- ---------------------------------------------------------------------------

-- Members: SELECT transactions for seasons they belong to
DO $$ BEGIN
  CREATE POLICY "season_transactions_member_select"
    ON public.season_transactions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.season_members sm
        WHERE sm.season_id = season_id
          AND sm.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NOTE: No user-facing INSERT/UPDATE/DELETE on season_transactions.
-- Transactions are written exclusively by SECURITY DEFINER RPCs (THEA-432)
-- running with service-role context to enforce immutability.
