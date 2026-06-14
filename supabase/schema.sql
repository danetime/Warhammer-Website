-- ============================================================================
-- The Old World League — Supabase schema (Step 2)
-- ============================================================================
-- HOW TO RUN: Supabase dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. It is idempotent (safe to run more than once).
--
-- This creates the tables and storage buckets only. Row Level Security is added
-- in Step 5 (supabase/rls.sql). Until then the tables are open to the API key,
-- which is fine for local testing but MUST be locked down before deploy.
--
-- Column naming is snake_case here; the app's storage layer (Step 4) maps these
-- rows to the camelCase shapes the UI components already expect, so the UI code
-- does not change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one row per registered member, linked to Supabase Auth.
-- The first registered user becomes admin (handled in app logic, Step 3).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null unique,
  faction      text not null default 'The Empire',
  is_admin     boolean not null default false,
  joined       date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- fixtures — scheduled battles (admin-managed).
-- ---------------------------------------------------------------------------
create table if not exists public.fixtures (
  id         uuid primary key default gen_random_uuid(),
  player_a   text not null,
  player_b   text not null,
  date       date,
  points     text,           -- kept as text to match the prototype (e.g. "1500")
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- battle_reports — filed by any member; drives the ELO ladder, standings,
-- the Hall of Infamy (shame) and games-played ranks.
-- ---------------------------------------------------------------------------
create table if not exists public.battle_reports (
  id         uuid primary key default gen_random_uuid(),
  player_a   text not null,
  player_b   text not null,
  army_a     text,
  army_b     text,
  date       date,
  points     text,
  winner     text not null check (winner in ('A', 'B', 'draw')),
  score      text,
  moment     text,
  shame      jsonb not null default '[]'::jsonb,  -- [{ player, ones, note }]
  filed_by   text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pages — league tables and cup brackets (admin-managed).
-- rows: the table/bracket rows; info: the Charter panel (points, rules, faqs).
-- ---------------------------------------------------------------------------
create table if not exists public.pages (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('league', 'cup')),
  title      text not null,
  rows       jsonb not null default '[]'::jsonb,
  info       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- proposals — Council motions. Members vote; admins seal/strike.
-- votes: jsonb object keyed by display_name -> 'aye' | 'nay'.
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  detail      text,
  proposed_by text,
  status      text not null default 'open' check (status in ('open', 'sealed', 'struck')),
  votes       jsonb not null default '{}'::jsonb,
  sealed_at   timestamptz,
  sealed_by   text,
  struck_at   timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- champions — the Champion's Crown. One current holder; the rest form the
-- Roll of Honour.
-- ---------------------------------------------------------------------------
create table if not exists public.champions (
  id         uuid primary key default gen_random_uuid(),
  member     text not null,
  season     text not null,
  awarded_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- quotes — Tavern Talk.
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id         uuid primary key default gen_random_uuid(),
  "text"     text not null,
  said_by    text,
  added_by   text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- faqs — the Herald.
-- ---------------------------------------------------------------------------
create table if not exists public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- library_entries — house rules / rulings, with an optional PDF in Storage.
-- ---------------------------------------------------------------------------
create table if not exists public.library_entries (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  link       text,
  pdf_path   text,            -- path within the 'library-pdfs' Storage bucket
  added_by   text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- photos — battle photos and the painting hall. The image file lives in the
-- 'photos' Storage bucket; storage_path points to it. votes: array of names.
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id           uuid primary key default gen_random_uuid(),
  caption      text,
  uploader     text,
  kind         text not null check (kind in ('match', 'painting')),
  storage_path text not null,
  votes        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Storage buckets: photos and library PDFs.
-- Created public for now so the app can display images via public URLs (matches
-- the prototype). Can be switched to private + signed URLs in Step 4/5 if you
-- want the gallery locked to members only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('library-pdfs', 'library-pdfs', true)
on conflict (id) do nothing;
