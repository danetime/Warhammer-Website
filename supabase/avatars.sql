-- ============================================================================
-- The Old World League — Profile pictures (avatar + mascot)
-- ============================================================================
-- Adds avatar/mascot images to profiles, lets members update their OWN profile
-- (with is_admin still protected by a guard), and an avatars storage bucket.
-- Run after rls.sql. Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists mascot_path text;

-- members may update their own profile (e.g. avatar); is_admin stays protected
drop policy if exists "profiles admin update" on public.profiles;
drop policy if exists "profiles update self or admin" on public.profiles;
create policy "profiles update self or admin" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and new.is_admin is distinct from old.is_admin then
    raise exception 'Only the Grand Marshal may change admin status.';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard_trigger on public.profiles;
create trigger profiles_guard_trigger before update on public.profiles
  for each row execute function public.profiles_guard();

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars write" on storage.objects;
create policy "avatars write" on storage.objects for all to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
