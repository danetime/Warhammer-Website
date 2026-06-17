-- ============================================================================
-- The Old World League — Committed army lists
-- ============================================================================
-- Lets members lodge an army list against a league or cup and SEAL it. Once a
-- list is committed it cannot be changed (you can't tailor your army to your
-- opponent each round) — only the Grand Marshal may unseal it to fix a mistake.
--
-- One row per lodged list, attached to a page (a league table or cup bracket).
--
-- Run once in the Supabase SQL Editor, after rls.sql. Idempotent.
-- ============================================================================

create table if not exists public.committed_lists (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid references public.pages (id) on delete cascade,
  player       text not null,                 -- who the list belongs to
  member       text,                          -- linked member display_name, if any
  points       text,                          -- e.g. "750" (kept as text like fixtures)
  body         text not null default '',      -- the army list itself
  committed    boolean not null default false,
  committed_at timestamptz,
  author       text,                          -- the member who lodged it
  created_at   timestamptz not null default now()
);

create index if not exists committed_lists_page_idx on public.committed_lists (page_id);

-- ---------- guard: a sealed list is immutable except to the Grand Marshal ----------
create or replace function public.committed_lists_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.committed and not public.is_admin() then
    raise exception 'This army list is committed and sealed. Only the Grand Marshal may unseal it.';
  end if;
  return new;
end; $$;
drop trigger if exists committed_lists_guard_trigger on public.committed_lists;
create trigger committed_lists_guard_trigger before update on public.committed_lists
  for each row execute function public.committed_lists_guard();

-- ---------- RLS: read all; author or admin may write a DRAFT; sealing locks it ----------
alter table public.committed_lists enable row level security;

drop policy if exists "committed read" on public.committed_lists;
create policy "committed read" on public.committed_lists for select to authenticated using (true);

drop policy if exists "committed insert own or admin" on public.committed_lists;
create policy "committed insert own or admin" on public.committed_lists for insert to authenticated
  with check (author = public.my_name() or public.is_admin());

-- Author may update their own row (the guard trigger blocks changes once sealed);
-- the Grand Marshal may update any row (including unsealing).
drop policy if exists "committed update own or admin" on public.committed_lists;
create policy "committed update own or admin" on public.committed_lists for update to authenticated
  using (author = public.my_name() or public.is_admin())
  with check (author = public.my_name() or public.is_admin());

-- Author may delete their own UNSEALED draft; the Grand Marshal may delete any.
drop policy if exists "committed delete own-draft or admin" on public.committed_lists;
create policy "committed delete own-draft or admin" on public.committed_lists for delete to authenticated
  using ((author = public.my_name() and committed = false) or public.is_admin());
