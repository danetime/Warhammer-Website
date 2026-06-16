-- ============================================================================
-- The Old World League — Site settings (admin-managed key/value store)
-- ============================================================================
-- A tiny key/value table for site-wide config the Grand Marshal can change from
-- the Admin tab, without a redeploy. Currently:
--   site_name    -> the masthead name (the running-joke title)
--   next_social  -> { host, location, date, note } for the home "Next gathering"
-- Values are JSON so future settings can store anything.
--
-- Read by any signed-in member; written only by admins. Run any time. Idempotent.
-- ============================================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings read" on public.settings;
create policy "settings read" on public.settings for select to authenticated using (true);

drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
