-- ============================================================================
-- The Old World League — Round number on fixtures (round-robin)
-- ============================================================================
-- The round-robin generator splits a league into rounds; this stores which
-- round each fixture belongs to so the schedule can be grouped Round 1, 2, …
-- Run any time. Idempotent.
-- ============================================================================

alter table public.fixtures add column if not exists round int;
