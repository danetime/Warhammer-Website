-- ============================================================================
-- The Old World League — Photo comments
-- ============================================================================
-- Lets members leave comments on gallery photos. Comments live as a JSON array
-- on the photo row: [{ id, by, text, at }]. The existing photos UPDATE policy
-- (any signed-in member, used for painting votes) already permits writing them,
-- so no new policy is needed.
--
-- Run any time. Idempotent.
-- ============================================================================

alter table public.photos add column if not exists comments jsonb not null default '[]'::jsonb;
