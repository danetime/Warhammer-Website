-- ============================================================================
-- The Old World League — member surname / house name
-- ============================================================================
-- An admin-set surname for each member, shown on their profile styled to the
-- army they play: "Breach" becomes "House Breach" for the Empire, "Clan Breach"
-- for Skaven, "the Breach Bloodline" for Vampire Counts, and so on. Helps tie a
-- username to a real person. The faction "twist" is applied in the UI.
--
-- Members can already update their own profile row (see avatars.sql); the
-- surname input itself is gated to admins in the UI. Run after rls.sql.
-- Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists surname text;
