-- ============================================================================
-- The Old World League — Army emblems
-- ============================================================================
-- Admin-uploaded emblem image per army (overrides the default emoji shown next
-- to army names). Run after rls.sql. Idempotent.
-- ============================================================================

create table if not exists public.army_emblems (
  army         text primary key,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

alter table public.army_emblems enable row level security;
drop policy if exists "emblems read" on public.army_emblems;
create policy "emblems read" on public.army_emblems for select to authenticated using (true);
drop policy if exists "emblems admin write" on public.army_emblems;
create policy "emblems admin write" on public.army_emblems for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('emblems', 'emblems', true)
on conflict (id) do nothing;

drop policy if exists "emblems storage admin" on storage.objects;
create policy "emblems storage admin" on storage.objects for all to authenticated
  using (bucket_id = 'emblems' and public.is_admin())
  with check (bucket_id = 'emblems' and public.is_admin());
