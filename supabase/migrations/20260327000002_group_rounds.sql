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
