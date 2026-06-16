-- ============================================================================
-- The Old World League — Hall of Fame (past champions & cup winners)
-- ============================================================================
-- A historical roll of victors: league champions and the winners of each great
-- tournament, year by year. Admin-managed; visible to every member.
-- Independent of the live Champion's Crown (the `champions` table) so retiring
-- a crown never disturbs the record.
--
-- Run any time (defines its own is_admin helper). Idempotent.
-- ============================================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.laurels (
  id          uuid primary key default gen_random_uuid(),
  competition text not null,            -- e.g. 'Champion of the Old World', a cup title
  winner      text not null,            -- the victor's name
  year        text,                     -- free text: '2526', 'Spring 2025', …
  note        text,                     -- optional flavour ('beat Dane in the final')
  created_at  timestamptz not null default now()
);

alter table public.laurels enable row level security;

drop policy if exists "laurels read" on public.laurels;
create policy "laurels read" on public.laurels for select to authenticated using (true);

drop policy if exists "laurels admin write" on public.laurels;
create policy "laurels admin write" on public.laurels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
