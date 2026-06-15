-- ============================================================================
-- The Old World League — Honours / side-titles (admin-awarded)
-- ============================================================================
-- League Champion, Cup Winner, Wooden Spoon, or freeform custom titles, granted
-- by the Grand Marshal and shown as badges on member profiles.
--
-- Run AFTER rls.sql (it uses the public.is_admin() helper). Idempotent.
-- ============================================================================

create table if not exists public.honours (
  id          uuid primary key default gen_random_uuid(),
  member      text not null,
  category    text not null check (category in ('league', 'cup', 'spoon', 'custom')),
  title       text not null,
  season      text,
  awarded_by  text,
  created_at  timestamptz not null default now()
);

alter table public.honours enable row level security;

drop policy if exists "honours read" on public.honours;
create policy "honours read" on public.honours for select to authenticated using (true);

drop policy if exists "honours admin write" on public.honours;
create policy "honours admin write" on public.honours for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
