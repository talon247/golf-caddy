-- =============================================================================
-- Golf Caddy: Initial Schema
-- Migration: 20260327000001_initial_schema.sql
-- Author: Backend Infrastructure Engineer (THEA-75)
-- PRD: THEA-73
-- =============================================================================
-- Idempotent: uses CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- and DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$
-- for policies. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. profiles
--    One row per auth.users row. Auto-created on signup via trigger.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null default 'Golfer',
  home_course      text,
  handicap_index   numeric(4,1),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$ begin
  create policy "profiles_select_own"
    on public.profiles for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_update_own"
    on public.profiles for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Golfer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. clubs
--    Per-user bag. Soft-deleted (deleted_at) so shot history retains context.
-- ---------------------------------------------------------------------------
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists clubs_user_idx
  on public.clubs(user_id) where deleted_at is null;

alter table public.clubs enable row level security;

do $$ begin
  create policy "clubs_all_own"
    on public.clubs for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists clubs_updated_at on public.clubs;
create trigger clubs_updated_at
  before update on public.clubs
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. courses
--    Per-user saved courses. Stores par per hole as an array.
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  hole_count     int not null check (hole_count in (9, 18)),
  par_per_hole   int[] not null,
  course_rating  numeric(4,1),
  slope_rating   int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists courses_user_idx
  on public.courses(user_id);

alter table public.courses enable row level security;

do $$ begin
  create policy "courses_all_own"
    on public.courses for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists courses_updated_at on public.courses;
create trigger courses_updated_at
  before update on public.courses
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. rounds
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.round_status as enum ('active', 'completed', 'abandoned');
exception when duplicate_object then null; end $$;

create table if not exists public.rounds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  course_id    uuid references public.courses(id) on delete set null,
  course_name  text not null,
  tees         text,
  player_name  text not null,
  hole_count   int not null check (hole_count in (9, 18)),
  status       public.round_status not null default 'active',
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists rounds_user_status_idx
  on public.rounds(user_id, status) where deleted_at is null;
create index if not exists rounds_user_started_idx
  on public.rounds(user_id, started_at desc) where deleted_at is null;

alter table public.rounds enable row level security;

do $$ begin
  create policy "rounds_all_own"
    on public.rounds for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists rounds_updated_at on public.rounds;
create trigger rounds_updated_at
  before update on public.rounds
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. holes
--    One row per hole played within a round.
-- ---------------------------------------------------------------------------
create table if not exists public.holes (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  hole_number  int not null check (hole_number between 1 and 18),
  par          int not null check (par between 3 and 5),
  putts        int not null default 0,
  fairway_hit  boolean,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(round_id, hole_number)
);

create index if not exists holes_round_idx
  on public.holes(round_id);

alter table public.holes enable row level security;

do $$ begin
  create policy "holes_all_own"
    on public.holes for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists holes_updated_at on public.holes;
create trigger holes_updated_at
  before update on public.holes
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. shots
--    One row per shot within a hole. Sequence is 1-indexed within the hole.
--    club_name denormalized so history survives club deletion/rename.
-- ---------------------------------------------------------------------------
create table if not exists public.shots (
  id          uuid primary key default gen_random_uuid(),
  hole_id     uuid not null references public.holes(id) on delete cascade,
  round_id    uuid not null references public.rounds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  club_id     uuid references public.clubs(id) on delete set null,
  club_name   text,
  sequence    int not null,
  is_putt     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique(hole_id, sequence)
);

create index if not exists shots_hole_idx  on public.shots(hole_id);
create index if not exists shots_round_idx on public.shots(round_id);

alter table public.shots enable row level security;

do $$ begin
  create policy "shots_all_own"
    on public.shots for all using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- shots has no updated_at (immutable after insert per PRD)

-- =============================================================================
-- End of migration
-- =============================================================================
-- =============================================================================
-- Golf Caddy: Group Rounds Schema
-- Migration: 20260327000002_group_rounds.sql
-- Author: Software Engineer (THEA-79)
-- PRD: THEA-74 (Multiplayer)
-- =============================================================================
-- Note: group_rounds uses open RLS (no auth required) for MVP since full
-- auth integration is a follow-up. Rows are keyed by room_code.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. group_round_status enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.group_round_status as enum ('waiting', 'active', 'completed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. group_rounds
--    One row per hosted group round session.
--    room_code is a 4-digit string (0000–9999), unique within active rounds.
-- ---------------------------------------------------------------------------
create table if not exists public.group_rounds (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null,
  host_name   text not null,
  status      public.group_round_status not null default 'waiting',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Unique room code among non-completed sessions
create unique index if not exists group_rounds_room_code_active_idx
  on public.group_rounds(room_code)
  where status in ('waiting', 'active');

create index if not exists group_rounds_status_idx
  on public.group_rounds(status);

alter table public.group_rounds enable row level security;

-- MVP: allow public read/insert/update (no auth required for group rounds)
do $$ begin
  create policy "group_rounds_public_insert"
    on public.group_rounds for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "group_rounds_public_select"
    on public.group_rounds for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "group_rounds_public_update"
    on public.group_rounds for update using (true);
exception when duplicate_object then null; end $$;

drop trigger if exists group_rounds_updated_at on public.group_rounds;
create trigger group_rounds_updated_at
  before update on public.group_rounds
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. group_round_players
--    Tracks players who have joined a group round lobby.
--    presence_key ties to Supabase Realtime presence state.
-- ---------------------------------------------------------------------------
create table if not exists public.group_round_players (
  id               uuid primary key default gen_random_uuid(),
  group_round_id   uuid not null references public.group_rounds(id) on delete cascade,
  player_name      text not null,
  presence_key     text,
  joined_at        timestamptz not null default now()
);

create index if not exists group_round_players_round_idx
  on public.group_round_players(group_round_id);

alter table public.group_round_players enable row level security;

do $$ begin
  create policy "group_round_players_public_insert"
    on public.group_round_players for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "group_round_players_public_select"
    on public.group_round_players for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "group_round_players_public_delete"
    on public.group_round_players for delete using (true);
exception when duplicate_object then null; end $$;

-- =============================================================================
-- End of migration
-- =============================================================================
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
