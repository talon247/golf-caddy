-- =============================================================================
-- Golf Caddy: Multiplayer Schema Addendum
-- Migration: 20260327000002_multiplayer_schema.sql
-- Author: Backend Infrastructure Engineer (THEA-78)
-- Parent task: THEA-75 (base schema must be applied first)
-- =============================================================================
-- Idempotent: uses CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- and DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$
-- for policies, triggers, and functions. Safe to re-run on top of THEA-75.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- NOTE: Supabase Realtime configuration
-- ---------------------------------------------------------------------------
-- Multiplayer leaderboard uses Supabase Realtime in BROADCAST mode only.
-- Broadcast is client-to-client via WebSocket channels and does NOT involve
-- DB-level replication or RLS overhead. No SQL migration is needed for
-- broadcast mode — enable it in the Supabase Dashboard under:
--   Project Settings → API → Realtime → ensure Realtime is enabled
-- Do NOT add group_rounds or group_round_players to the Realtime publication
-- (that would be postgres_changes mode, which incurs RLS overhead and is
-- not needed for this feature).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- NOTE: room_code brute-force protection
-- ---------------------------------------------------------------------------
-- room_code is a 4-character alphanumeric code with ~1.68M permutations.
-- Brute-force enumeration must be rate-limited at the API layer (e.g., via
-- Supabase Edge Function or reverse proxy), not in SQL. Recommended limits:
--   - Max 10 join attempts per IP per minute
--   - Exponential backoff after 3 failures
--   - Codes expire after 24 hours (enforced by expires_at column)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. group_rounds
--    One row per active multiplayer room. Host creates it; others join by
--    room_code. Expires 24 hours after creation.
-- ---------------------------------------------------------------------------
create table if not exists public.group_rounds (
  id            uuid        primary key default gen_random_uuid(),
  room_code     char(4)     not null unique,
  host_user_id  uuid        references auth.users(id) on delete set null,
  status        text        not null default 'waiting'
                            check (status in ('waiting', 'active', 'completed')),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);

-- Explicit named index for room_code lookups (the UNIQUE constraint creates an
-- implicit index, but naming it makes monitoring/explain output clearer)
create unique index if not exists group_rounds_room_code_idx
  on public.group_rounds(room_code);

-- Partial index for finding non-expired active rooms quickly
create index if not exists group_rounds_active_idx
  on public.group_rounds(status, expires_at)
  where status in ('waiting', 'active');

alter table public.group_rounds enable row level security;

-- SELECT: see your own group round if you're the host or a player in it
do $$ begin
  create policy "group_rounds_select_participant"
    on public.group_rounds for select
    using (
      host_user_id = auth.uid()
      or exists (
        select 1 from public.group_round_players grp
        where grp.group_round_id = id
          and grp.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- INSERT: any authenticated user can create a group round (becomes the host)
do $$ begin
  create policy "group_rounds_insert_host"
    on public.group_rounds for insert
    with check (host_user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- UPDATE: only the host can change status
do $$ begin
  create policy "group_rounds_update_host"
    on public.group_rounds for update
    using (host_user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- DELETE: only the host can delete
do $$ begin
  create policy "group_rounds_delete_host"
    on public.group_rounds for delete
    using (host_user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. group_round_players
--    One row per player in a group round. user_id is nullable to support
--    guest (non-auth) players identified only by display_name.
--    round_id links to the player's individual round once started.
-- ---------------------------------------------------------------------------
create table if not exists public.group_round_players (
  id              uuid        primary key default gen_random_uuid(),
  group_round_id  uuid        not null references public.group_rounds(id) on delete cascade,
  user_id         uuid        references auth.users(id) on delete set null,
  display_name    text        not null,
  round_id        uuid        references public.rounds(id) on delete set null,
  joined_at       timestamptz not null default now()
);

create index if not exists group_round_players_group_idx
  on public.group_round_players(group_round_id);

create index if not exists group_round_players_user_idx
  on public.group_round_players(user_id)
  where user_id is not null;

alter table public.group_round_players enable row level security;

-- SELECT: see all players in group rounds you belong to (needed for leaderboard)
-- Also allows the host to see all players in their room
do $$ begin
  create policy "group_round_players_select_participant"
    on public.group_round_players for select
    using (
      -- You are one of the players in this group round
      group_round_id in (
        select grp.group_round_id
        from public.group_round_players grp
        where grp.user_id = auth.uid()
      )
      -- OR you are the host of this group round
      or group_round_id in (
        select gr.id
        from public.group_rounds gr
        where gr.host_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- INSERT: authenticated user can join as themselves
do $$ begin
  create policy "group_round_players_insert_own"
    on public.group_round_players for insert
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- UPDATE: player can update their own row (e.g., link their round_id once started)
do $$ begin
  create policy "group_round_players_update_own"
    on public.group_round_players for update
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- DELETE: player can remove themselves
do $$ begin
  create policy "group_round_players_delete_own"
    on public.group_round_players for delete
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 3. Max-4-player enforcement
--    A BEFORE INSERT trigger rejects the insert if the group_round already
--    has 4 or more players. This fires server-side regardless of who calls
--    the insert (direct SQL, RPC, or PostgREST API).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_max_group_players()
returns trigger language plpgsql as $$
declare
  current_count int;
begin
  select count(*) into current_count
  from public.group_round_players
  where group_round_id = new.group_round_id;

  if current_count >= 4 then
    raise exception
      'group_round % already has the maximum of 4 players',
      new.group_round_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_max_4_players on public.group_round_players;
create trigger enforce_max_4_players
  before insert on public.group_round_players
  for each row execute function public.enforce_max_group_players();

-- =============================================================================
-- End of migration
-- =============================================================================
