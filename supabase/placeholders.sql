-- ============================================================================
-- The Old World League — Placeholder members (V1.1)
-- ============================================================================
-- A placeholder is a player who has battle history but no account yet — added
-- by the Grand Marshal so their games, ELO and standings are tracked from the
-- start. The whole app keys players by display_name (text), so a placeholder's
-- name behaves exactly like a member's: it shows in the pickers, the ladder and
-- the standings as soon as battles are filed against it.
--
-- When that player later signs up, the Grand Marshal LINKS the placeholder to
-- their new account. merge_placeholder() rewrites the placeholder's name to the
-- account's name across every record (carrying all history over) and then
-- removes the placeholder row.
--
-- Run once in the Supabase SQL Editor, AFTER rename.sql (which defines the
-- shared rewrite_member_name engine this uses). Idempotent (safe to re-run).
-- ============================================================================

create table if not exists public.placeholder_members (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  faction      text not null default 'The Empire',
  surname      text,                       -- optional, styled to their army on profiles
  note         text,                       -- the Grand Marshal's private note (e.g. "Ollie's mate")
  joined       date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ---------- link a placeholder to a real account (admin only) ----------
-- Carries the placeholder's history onto the account, then drops the placeholder.
create or replace function public.merge_placeholder(p_id uuid, target_name text)
returns void language plpgsql security definer set search_path = public as $$
declare ph public.placeholder_members; tgt text := trim(target_name);
begin
  if not public.is_admin() then
    raise exception 'Only the Grand Marshal may link a placeholder.';
  end if;

  select * into ph from public.placeholder_members where id = p_id;
  if not found then raise exception 'No such placeholder.'; end if;

  if tgt = '' then raise exception 'Choose a member to link to.'; end if;
  if not exists (select 1 from public.profiles where display_name = tgt) then
    raise exception 'No registered member named "%".', tgt;
  end if;

  -- Rewrite the placeholder's name to the account's everywhere, unless the new
  -- account already adopted the same name (then history is already shared).
  if tgt <> ph.display_name then
    perform public.rewrite_member_name(ph.display_name, tgt);
  end if;

  delete from public.placeholder_members where id = p_id;
end; $$;

revoke all on function public.merge_placeholder(uuid, text) from public, anon;
grant execute on function public.merge_placeholder(uuid, text) to authenticated;

-- ---------- RLS: any member may read; only the Grand Marshal may write ----------
alter table public.placeholder_members enable row level security;

drop policy if exists "placeholders read" on public.placeholder_members;
create policy "placeholders read" on public.placeholder_members for select to authenticated using (true);

drop policy if exists "placeholders admin write" on public.placeholder_members;
create policy "placeholders admin write" on public.placeholder_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
