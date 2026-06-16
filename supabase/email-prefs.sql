-- ============================================================================
-- The Old World League — email notification preferences
-- ============================================================================
-- Per-member opt-out for the notification emails. JSON so we can add more
-- toggles without another migration. Keys (all default ON when missing):
--   broadcasts -> availability calls & gathering announcements
--   digest     -> the weekly round-up
-- The "someone accepted YOUR game" email is always sent (it's a direct reply).
--
-- Members read/write their own row via the existing profiles policies; the
-- server functions read everyone's prefs with the service-role key. Idempotent.
-- ============================================================================

alter table public.profiles
  add column if not exists email_prefs jsonb not null default '{}'::jsonb;
