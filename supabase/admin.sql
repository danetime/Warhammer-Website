-- ============================================================================
-- The Old World League — Admin tools: remove a member
-- ============================================================================
-- admin_delete_member() removes a member's account entirely. Deleting the auth
-- user cascades to their profile (profiles.id references auth.users on delete
-- cascade). Match history (battle_reports, fixtures, quotes, photos, …) keys on
-- the member's name, not a foreign key, so the records are preserved — the name
-- simply stops linking to a live profile.
--
-- SECURITY DEFINER so it runs with the privileges needed to touch auth.users;
-- it refuses unless the caller is an admin, and you cannot delete yourself.
--
-- Run any time. Idempotent.
-- ============================================================================

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.admin_delete_member(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Only the Grand Marshal may remove a member.';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot remove your own account.';
  end if;
  delete from auth.users where id = target;
end; $$;

revoke all on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;
