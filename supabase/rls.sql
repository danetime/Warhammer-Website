-- ============================================================================
-- The Old World League — Row Level Security (Step 5)
-- ============================================================================
-- Re-enables RLS (we disabled it for development) and adds proper policies so
-- the DATABASE enforces who can do what — not just the UI.
--
-- Rules:
--   * Any signed-in member can READ everything.
--   * Members may add/remove THEIR OWN quotes, battle reports and photos, and
--     may vote (on motions and paintings).
--   * Only admins (Grand Marshal) may write league/cup pages, fixtures,
--     champions, FAQs, library entries, seal/strike motions, and change
--     is_admin on profiles.
--
-- This file locks the CORE tables. Tables added later each ship their own RLS
-- in their own migration: honours.sql, availability.sql, emblems.sql,
-- hall-of-fame.sql, settings.sql, committed-lists.sql and placeholders.sql.
-- After running them all, use rls-check.sql to confirm nothing is left open
-- before the site goes public.
--
-- Run this once in the Supabase SQL Editor. Idempotent (safe to re-run).
-- ============================================================================

-- ---------- helper functions (SECURITY DEFINER bypasses RLS to avoid recursion) ----------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_name()
returns text language sql security definer stable set search_path = public as $$
  select display_name from public.profiles where id = auth.uid();
$$;

-- ---------- profile creation trigger (server-controlled is_admin) ----------
-- First member to enlist becomes admin; everyone else does not. Runs as
-- definer so it works under RLS.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, display_name, faction, is_admin)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)),
    coalesce(nullif(new.raw_user_meta_data->>'faction',''), 'The Empire'),
    is_first
  ) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- guard: non-admins may only change the votes on a motion ----------
create or replace function public.proposals_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if new.title      is distinct from old.title
    or new.detail     is distinct from old.detail
    or new.proposed_by is distinct from old.proposed_by
    or new.status     is distinct from old.status
    or new.sealed_at  is distinct from old.sealed_at
    or new.sealed_by  is distinct from old.sealed_by
    or new.struck_at  is distinct from old.struck_at then
      raise exception 'Only the Grand Marshal may seal or strike a motion.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists proposals_guard_trigger on public.proposals;
create trigger proposals_guard_trigger before update on public.proposals
  for each row execute function public.proposals_guard();

-- ---------- enable RLS on every table ----------
alter table public.profiles        enable row level security;
alter table public.fixtures        enable row level security;
alter table public.battle_reports  enable row level security;
alter table public.pages           enable row level security;
alter table public.proposals       enable row level security;
alter table public.champions       enable row level security;
alter table public.quotes          enable row level security;
alter table public.faqs            enable row level security;
alter table public.library_entries enable row level security;
alter table public.photos          enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self" on public.profiles for insert to authenticated
  with check (id = auth.uid() and coalesce(is_admin, false) = false);
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- admin-managed tables (read all; write admin only) ----------
-- fixtures
drop policy if exists "fixtures read" on public.fixtures;
create policy "fixtures read" on public.fixtures for select to authenticated using (true);
drop policy if exists "fixtures admin write" on public.fixtures;
create policy "fixtures admin write" on public.fixtures for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- pages
drop policy if exists "pages read" on public.pages;
create policy "pages read" on public.pages for select to authenticated using (true);
drop policy if exists "pages admin write" on public.pages;
create policy "pages admin write" on public.pages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- champions
drop policy if exists "champions read" on public.champions;
create policy "champions read" on public.champions for select to authenticated using (true);
drop policy if exists "champions admin write" on public.champions;
create policy "champions admin write" on public.champions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- faqs
drop policy if exists "faqs read" on public.faqs;
create policy "faqs read" on public.faqs for select to authenticated using (true);
drop policy if exists "faqs admin write" on public.faqs;
create policy "faqs admin write" on public.faqs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- library_entries
drop policy if exists "library read" on public.library_entries;
create policy "library read" on public.library_entries for select to authenticated using (true);
drop policy if exists "library admin write" on public.library_entries;
create policy "library admin write" on public.library_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- member-owned tables (read all; own insert/delete; admin delete any) ----------
-- quotes
drop policy if exists "quotes read" on public.quotes;
create policy "quotes read" on public.quotes for select to authenticated using (true);
drop policy if exists "quotes insert own" on public.quotes;
create policy "quotes insert own" on public.quotes for insert to authenticated
  with check (added_by = public.my_name());
drop policy if exists "quotes delete own or admin" on public.quotes;
create policy "quotes delete own or admin" on public.quotes for delete to authenticated
  using (added_by = public.my_name() or public.is_admin());

-- battle_reports
drop policy if exists "reports read" on public.battle_reports;
create policy "reports read" on public.battle_reports for select to authenticated using (true);
drop policy if exists "reports insert own" on public.battle_reports;
create policy "reports insert own" on public.battle_reports for insert to authenticated
  with check (filed_by = public.my_name());
drop policy if exists "reports delete own or admin" on public.battle_reports;
create policy "reports delete own or admin" on public.battle_reports for delete to authenticated
  using (filed_by = public.my_name() or public.is_admin());

-- photos (read all; own insert/delete; any member may vote via update)
drop policy if exists "photos read" on public.photos;
create policy "photos read" on public.photos for select to authenticated using (true);
drop policy if exists "photos insert own" on public.photos;
create policy "photos insert own" on public.photos for insert to authenticated
  with check (uploader = public.my_name());
drop policy if exists "photos update" on public.photos;
create policy "photos update" on public.photos for update to authenticated
  using (true) with check (true);
drop policy if exists "photos delete own or admin" on public.photos;
create policy "photos delete own or admin" on public.photos for delete to authenticated
  using (uploader = public.my_name() or public.is_admin());

-- proposals (read all; member tables a motion; any member votes (guarded);
-- proposer removes own open motion; admin removes any; admin seals/strikes)
drop policy if exists "proposals read" on public.proposals;
create policy "proposals read" on public.proposals for select to authenticated using (true);
drop policy if exists "proposals insert own" on public.proposals;
create policy "proposals insert own" on public.proposals for insert to authenticated
  with check (proposed_by = public.my_name());
drop policy if exists "proposals update" on public.proposals;
create policy "proposals update" on public.proposals for update to authenticated
  using (true) with check (true);
drop policy if exists "proposals delete own-open or admin" on public.proposals;
create policy "proposals delete own-open or admin" on public.proposals for delete to authenticated
  using ((proposed_by = public.my_name() and status = 'open') or public.is_admin());
