-- ============================================================================
-- The Old World League — Battle report upgrades (v1.3)
-- ============================================================================
-- Three additions to battle_reports:
--   * kind / page_id — which competition a report belongs to (Friendly /
--     League: <title> / Cup: <title>), carried over automatically when a
--     fixture is converted with "this game has been played". Lets a league
--     table be tallied straight from its filed reports.
--   * army_a2 / army_b2 — the army each doubles partner fielded, so 2v2 games
--     count toward the right army records and ranks (blank falls back to the
--     partner's profile faction, as before).
--   * an UPDATE policy — reports could be inserted and deleted but never
--     edited; now the filer (or an admin) can correct one in place instead of
--     striking and refiling.
-- Run any time after rls.sql (idempotent). Existing reports are untouched.
-- ============================================================================

alter table public.battle_reports add column if not exists kind text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'battle_reports_kind_check') then
    alter table public.battle_reports
      add constraint battle_reports_kind_check check (kind is null or kind in ('friendly', 'league', 'cup'));
  end if;
end $$;
alter table public.battle_reports add column if not exists page_id uuid references public.pages(id) on delete set null;
alter table public.battle_reports add column if not exists army_a2 text;
alter table public.battle_reports add column if not exists army_b2 text;

drop policy if exists "reports update own or admin" on public.battle_reports;
create policy "reports update own or admin" on public.battle_reports for update to authenticated
  using (filed_by = public.my_name() or public.is_admin())
  with check (filed_by = public.my_name() or public.is_admin());
