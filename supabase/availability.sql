-- ============================================================================
-- The Old World League — Availability board + richer fixtures
-- ============================================================================
-- Adds: an availability/challenge board, and fixture fields for competition
-- type, the linked league/cup, and a scenario. Accepting a challenge creates a
-- fixture, so members need to be able to insert a fixture they're part of.
--
-- Run AFTER rls.sql (uses my_name() / is_admin()). Idempotent.
-- ============================================================================

-- 1) Extend fixtures with competition type, linked page, and scenario --------
alter table public.fixtures add column if not exists kind text not null default 'friendly';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fixtures_kind_check') then
    alter table public.fixtures add constraint fixtures_kind_check check (kind in ('friendly', 'league', 'cup'));
  end if;
end $$;
alter table public.fixtures add column if not exists page_id uuid references public.pages(id) on delete set null;
alter table public.fixtures add column if not exists scenario text;

-- Members may create a fixture they're part of (accepting a challenge);
-- admins keep full control (schedule/edit/delete) via the existing policy.
drop policy if exists "fixtures member create" on public.fixtures;
create policy "fixtures member create" on public.fixtures for insert to authenticated
  with check (player_a = public.my_name() or player_b = public.my_name());

-- 2) Availability / challenge board ------------------------------------------
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  member     text not null,
  date       date not null,
  kind       text not null check (kind in ('friendly', 'league', 'cup')),
  page_id    uuid references public.pages(id) on delete set null,
  note       text,
  takers     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.availability enable row level security;

drop policy if exists "availability read" on public.availability;
create policy "availability read" on public.availability for select to authenticated using (true);

drop policy if exists "availability insert own" on public.availability;
create policy "availability insert own" on public.availability for insert to authenticated
  with check (member = public.my_name());

-- any member may update takers (accept a challenge)
drop policy if exists "availability update" on public.availability;
create policy "availability update" on public.availability for update to authenticated
  using (true) with check (true);

drop policy if exists "availability delete own or admin" on public.availability;
create policy "availability delete own or admin" on public.availability for delete to authenticated
  using (member = public.my_name() or public.is_admin());
