-- ============================================================================
-- The Old World League — Doubles (2v2) battles
-- ============================================================================
-- Adds an optional second player to each side of a battle report so a 2v2 can
-- be recorded. `doubles` is a simple flag set by the "Doubles (2v2)" tick on the
-- report form; player_a2 / player_b2 hold each side's partner. Scoring is
-- unchanged — every player on a side gets the same league points and Might (ELO)
-- swing they would for a 1v1, so a doubles game "keeps the score the same".
-- Run any time (idempotent). Existing reports are untouched (doubles = false).
-- ============================================================================

alter table public.battle_reports add column if not exists doubles  boolean not null default false;
alter table public.battle_reports add column if not exists player_a2 text;
alter table public.battle_reports add column if not exists player_b2 text;
