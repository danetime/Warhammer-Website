-- ============================================================================
-- The Old World League — Site settings (admin-managed key/value store)
-- ============================================================================
-- A tiny key/value table for site-wide config the Grand Marshal can change from
-- the Admin tab, without a redeploy. Currently:
--   site_name    -> the masthead name (the running-joke title)
--   next_social  -> { host, location, date, note } for the home "Next gathering"
-- Values are JSON so future settings can store anything.
--
-- Read by any signed-in member; the site name alone is also readable by anyone
-- (it greets visitors on the login screen). Written only by admins. Idempotent.
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

-- The site name is shown on the login screen, before anyone signs in, so it alone
-- is world-readable. Everything else (e.g. next_social) stays members-only.
drop policy if exists "settings name public" on public.settings;
create policy "settings name public" on public.settings for select to anon
  using (key = 'site_name');

drop policy if exists "settings admin write" on public.settings;
create policy "settings admin write" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
