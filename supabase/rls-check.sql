-- ============================================================================
-- The Old World League — RLS lockdown check (run before going public)
-- ============================================================================
-- Every public table should have Row Level Security ENABLED and at least one
-- policy. This is a READ-ONLY audit — it changes nothing. It lists each table
-- with its RLS status and policy count, then raises a NOTICE for anything that
-- is still open (RLS off) or locked-out (RLS on but no policies).
--
-- Fix anything flagged by running the migration that owns that table:
--   schema.sql, rls.sql               — the core tables
--   honours.sql, availability.sql, emblems.sql, hall-of-fame.sql, settings.sql,
--   committed-lists.sql, placeholders.sql  — tables added later (own their RLS)
--
-- Run any time in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- A glance at every public table.
select
  c.relname        as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relrowsecurity asc, c.relname;

-- Shout about anything that isn't safely locked down.
do $$
declare r record; flagged int := 0;
begin
  for r in
    select c.relname, c.relrowsecurity as rls, count(p.polname) as pols
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public' and c.relkind = 'r'
    group by c.relname, c.relrowsecurity
  loop
    if not r.rls then
      raise notice 'OPEN: public.% has RLS DISABLED', r.relname;
      flagged := flagged + 1;
    elsif r.pols = 0 then
      raise notice 'LOCKED-OUT: public.% has RLS enabled but NO policies', r.relname;
      flagged := flagged + 1;
    end if;
  end loop;
  if flagged = 0 then
    raise notice 'All public tables have RLS enabled with at least one policy.';
  else
    raise notice '% table(s) need attention before going public.', flagged;
  end if;
end $$;
