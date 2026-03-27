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
