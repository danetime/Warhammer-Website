-- ============================================================================
-- The Old World League — ELO margins + casual games
-- ============================================================================
-- Adds a victory margin (marginal/victory/defiant) that weights the ELO swing,
-- and a `ranked` flag so an agreed casual game is left out of ELO, league
-- points and W/L records. Run any time (idempotent). Existing reports default
-- to a standard ranked Victory, so nothing recalculates.
-- ============================================================================

alter table public.battle_reports add column if not exists margin text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'battle_reports_margin_check') then
    alter table public.battle_reports
      add constraint battle_reports_margin_check check (margin is null or margin in ('marginal', 'victory', 'defiant'));
  end if;
end $$;
alter table public.battle_reports add column if not exists ranked boolean not null default true;
