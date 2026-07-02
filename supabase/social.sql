-- ============================================================================
-- The Old World League — Social: banter on battle reports
-- ============================================================================
-- Comments on battle reports, photo-comments style: a JSON array on the row,
-- [{ id, by, text, at }]. Any member may comment, so the UPDATE policy must
-- open up beyond the filer — a guard trigger (proposals-style) keeps everything
-- EXCEPT comments locked to the filer or the Grand Marshal.
-- Run AFTER reports-v2.sql (replaces its update policy; guards its columns).
-- Idempotent.
-- ============================================================================

alter table public.battle_reports add column if not exists comments jsonb not null default '[]'::jsonb;

-- Non-filers may only change the comments column; the report itself stays
-- editable only by its filer or an admin.
create or replace function public.reports_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or old.filed_by = public.my_name()) then
    if new.player_a  is distinct from old.player_a
    or new.player_b  is distinct from old.player_b
    or new.army_a    is distinct from old.army_a
    or new.army_b    is distinct from old.army_b
    or new.player_a2 is distinct from old.player_a2
    or new.player_b2 is distinct from old.player_b2
    or new.army_a2   is distinct from old.army_a2
    or new.army_b2   is distinct from old.army_b2
    or new.doubles   is distinct from old.doubles
    or new.date      is distinct from old.date
    or new.points    is distinct from old.points
    or new.winner    is distinct from old.winner
    or new.margin    is distinct from old.margin
    or new.ranked    is distinct from old.ranked
    or new.score     is distinct from old.score
    or new.moment    is distinct from old.moment
    or new.shame     is distinct from old.shame
    or new.kind      is distinct from old.kind
    or new.page_id   is distinct from old.page_id
    or new.filed_by  is distinct from old.filed_by then
      raise exception 'Only the filer or the Grand Marshal may edit a battle report.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists reports_guard_trigger on public.battle_reports;
create trigger reports_guard_trigger before update on public.battle_reports
  for each row execute function public.reports_guard();

drop policy if exists "reports update own or admin" on public.battle_reports;
drop policy if exists "reports update member" on public.battle_reports;
create policy "reports update member" on public.battle_reports for update to authenticated
  using (true) with check (true);
