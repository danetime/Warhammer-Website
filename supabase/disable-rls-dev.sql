-- ============================================================================
-- The Old World League — Disable RLS for local development (temporary)
-- ============================================================================
-- New Supabase projects enable Row Level Security on tables by default. With no
-- policies, that blocks ALL reads/writes from the app. The build brief develops
-- against open tables and adds RLS properly in Step 5, so this restores that
-- state for now.
--
-- Run this once in the Supabase SQL Editor.
--
-- !! TEMPORARY !!  Before deploying, re-lock by re-running the migrations that
-- own each table (rls.sql for the core tables; honours.sql, availability.sql,
-- emblems.sql, hall-of-fame.sql, settings.sql, committed-lists.sql and
-- placeholders.sql for the rest — each re-enables RLS with its policies), then
-- run rls-check.sql to confirm nothing is left open.
-- ============================================================================

-- Covers every table the app uses; skips any that don't exist yet, so it is
-- safe to run on a partially-migrated project.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'fixtures', 'battle_reports', 'pages', 'proposals', 'champions',
    'quotes', 'faqs', 'library_entries', 'photos', 'honours', 'availability',
    'army_emblems', 'laurels', 'settings', 'committed_lists', 'placeholder_members'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I disable row level security', t);
    end if;
  end loop;
end $$;
