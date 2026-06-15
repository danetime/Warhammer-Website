-- ============================================================================
-- The Old World League — Rename a member everywhere (carry history)
-- ============================================================================
-- display_name is the identity used across the app. This SECURITY DEFINER
-- function renames a member and rewrites every reference so all stats/history
-- follow. Callable by the member themselves or an admin. Run after rls.sql.
-- ============================================================================

create or replace function public.rename_member(old_name text, new_name text)
returns void language plpgsql security definer set search_path = public as $$
declare nn text := trim(new_name);
begin
  if nn = '' then raise exception 'New name cannot be empty.'; end if;

  if not (public.is_admin() or exists (
    select 1 from public.profiles where id = auth.uid() and display_name = old_name
  )) then
    raise exception 'You may only rename yourself.';
  end if;

  if exists (select 1 from public.profiles where display_name = nn and display_name <> old_name) then
    raise exception 'That name is already on the muster roll.';
  end if;

  if nn = old_name then return; end if;

  update public.profiles        set display_name = nn where display_name = old_name;

  update public.battle_reports  set player_a = nn where player_a = old_name;
  update public.battle_reports  set player_b = nn where player_b = old_name;
  update public.battle_reports  set filed_by = nn where filed_by = old_name;
  update public.battle_reports
    set shame = (select coalesce(jsonb_agg(
                   case when e->>'player' = old_name then jsonb_set(e, '{player}', to_jsonb(nn)) else e end), '[]'::jsonb)
                 from jsonb_array_elements(shame) e)
    where exists (select 1 from jsonb_array_elements(shame) e where e->>'player' = old_name);

  update public.fixtures        set player_a = nn where player_a = old_name;
  update public.fixtures        set player_b = nn where player_b = old_name;

  update public.quotes          set added_by = nn where added_by = old_name;
  update public.quotes          set said_by  = nn where said_by  = old_name;

  update public.photos          set uploader = nn where uploader = old_name;
  update public.photos
    set votes = (select coalesce(jsonb_agg(case when v = old_name then nn else v end), '[]'::jsonb)
                 from jsonb_array_elements_text(votes) v)
    where votes ? old_name;

  update public.proposals       set proposed_by = nn where proposed_by = old_name;
  update public.proposals       set sealed_by   = nn where sealed_by   = old_name;
  update public.proposals
    set votes = (votes - old_name) || jsonb_build_object(nn, votes->old_name)
    where votes ? old_name;

  update public.champions       set member = nn where member = old_name;

  update public.honours         set member     = nn where member     = old_name;
  update public.honours         set awarded_by = nn where awarded_by = old_name;

  update public.availability    set member = nn where member = old_name;
  update public.availability
    set takers = (select coalesce(jsonb_agg(case when t = old_name then nn else t end), '[]'::jsonb)
                  from jsonb_array_elements_text(takers) t)
    where takers ? old_name;
end; $$;
