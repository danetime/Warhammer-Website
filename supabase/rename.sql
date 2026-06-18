-- ============================================================================
-- The Old World League — Rename / re-key a member everywhere (carry history)
-- ============================================================================
-- display_name is the identity used across the app. rewrite_member_name() is
-- the shared engine that rewrites EVERY reference from one name to another so
-- all stats and history follow. It is used by:
--   * rename_member()     — a member (or admin) renames themselves.
--   * merge_placeholder()  — an admin ties a placeholder to a real account
--                            (see supabase/placeholders.sql).
--
-- It deliberately does NOT touch the identity rows (profiles, placeholder_members)
-- or the manually-maintained league/cup tables (pages.rows) — callers manage the
-- profile row, and league tables are admin-editable in place. Run after rls.sql.
-- ============================================================================

-- ---------- shared engine: rewrite all references old_name -> new_name ----------
-- SECURITY DEFINER so it can write across tables regardless of RLS. Callers are
-- responsible for permission checks before invoking it.
create or replace function public.rewrite_member_name(old_name text, new_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.battle_reports  set player_a = new_name where player_a = old_name;
  update public.battle_reports  set player_b = new_name where player_b = old_name;
  update public.battle_reports  set filed_by = new_name where filed_by = old_name;
  update public.battle_reports
    set shame = (select coalesce(jsonb_agg(
                   case when e->>'player' = old_name then jsonb_set(e, '{player}', to_jsonb(new_name)) else e end), '[]'::jsonb)
                 from jsonb_array_elements(shame) e)
    where exists (select 1 from jsonb_array_elements(shame) e where e->>'player' = old_name);

  update public.fixtures        set player_a = new_name where player_a = old_name;
  update public.fixtures        set player_b = new_name where player_b = old_name;

  update public.quotes          set added_by = new_name where added_by = old_name;
  update public.quotes          set said_by  = new_name where said_by  = old_name;

  update public.photos          set uploader = new_name where uploader = old_name;
  update public.photos
    set votes = (select coalesce(jsonb_agg(case when v = old_name then new_name else v end), '[]'::jsonb)
                 from jsonb_array_elements_text(votes) v)
    where votes ? old_name;

  update public.proposals       set proposed_by = new_name where proposed_by = old_name;
  update public.proposals       set sealed_by   = new_name where sealed_by   = old_name;
  update public.proposals
    set votes = (votes - old_name) || jsonb_build_object(new_name, votes->old_name)
    where votes ? old_name;

  update public.champions       set member = new_name where member = old_name;

  update public.honours         set member     = new_name where member     = old_name;
  update public.honours         set awarded_by = new_name where awarded_by = old_name;

  update public.availability    set member = new_name where member = old_name;
  update public.availability
    set takers = (select coalesce(jsonb_agg(case when t = old_name then new_name else t end), '[]'::jsonb)
                  from jsonb_array_elements_text(takers) t)
    where takers ? old_name;

  -- committed army lists (player / linked member / author)
  update public.committed_lists set player = new_name where player = old_name;
  update public.committed_lists set member = new_name where member = old_name;
  update public.committed_lists set author = new_name where author = old_name;
end; $$;

-- ---------- a member renames themselves (or an admin renames them) ----------
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

  update public.profiles set display_name = nn where display_name = old_name;
  perform public.rewrite_member_name(old_name, nn);
end; $$;
