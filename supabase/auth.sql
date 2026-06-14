-- ============================================================================
-- The Old World League — Auth trigger (Step 3)
-- ============================================================================
-- Run this in the Supabase SQL Editor AFTER schema.sql.
--
-- When a new user signs up (auth.users insert), this creates their public
-- profile from the sign-up metadata (display_name + faction). The FIRST member
-- to enlist becomes admin (Grand Marshal); everyone after is a regular member.
--
-- SECURITY DEFINER lets the trigger write to profiles regardless of RLS, so it
-- keeps working once RLS is enabled in Step 5.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;

  insert into public.profiles (id, display_name, faction, is_admin)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'faction', ''), 'The Empire'),
    is_first
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
