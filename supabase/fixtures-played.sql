-- ============================================================================
-- The Old World League — Members may strike a fixture they played
-- ============================================================================
-- "This game has been played" lets any member turn a fixture into a battle
-- report; filing the report then strikes the fixture off the slate. Fixture
-- deletes were admin-only in rls.sql, so under RLS a member's filing would
-- quietly leave the fixture behind. This lets a member delete a fixture they
-- are named in (mirrors the "fixtures member create" policy in
-- availability.sql). A league fixture stored under a table-row label rather
-- than a username still needs the Grand Marshal to strike it — the app copes:
-- the report files and the fixture simply stays until struck.
-- Run AFTER rls.sql (uses my_name(); admins are covered by the existing
-- "fixtures admin write" policy). Idempotent.
-- ============================================================================

drop policy if exists "fixtures participant delete" on public.fixtures;
create policy "fixtures participant delete" on public.fixtures for delete to authenticated
  using (player_a = public.my_name() or player_b = public.my_name());
