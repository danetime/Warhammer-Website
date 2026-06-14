-- ============================================================================
-- The Old World League — Disable RLS for local development (temporary)
-- ============================================================================
-- New Supabase projects enable Row Level Security on tables by default. With no
-- policies, that blocks ALL reads/writes from the app. The build brief develops
-- against open tables and adds RLS properly in Step 5, so this restores that
-- state for now.
--
-- Run this once in the Supabase SQL Editor.
--
-- !! TEMPORARY !!  Step 5 (supabase/rls.sql) re-enables RLS with real policies
-- and MUST be applied before the site is deployed.
-- ============================================================================

alter table public.profiles        disable row level security;
alter table public.fixtures        disable row level security;
alter table public.battle_reports  disable row level security;
alter table public.pages           disable row level security;
alter table public.proposals       disable row level security;
alter table public.champions       disable row level security;
alter table public.quotes          disable row level security;
alter table public.faqs            disable row level security;
alter table public.library_entries disable row level security;
alter table public.photos          disable row level security;
