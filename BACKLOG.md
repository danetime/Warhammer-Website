# Feature list & backlog

Running list of things we want to do but haven't built yet, so nothing gets
lost between sessions. Newest ideas at the top of each section.

## In progress

- **Email notifications** (Gmail SMTP transport for v1). Alerts for:
  1. New availability posted → all members (opt-out)
  2. Your slot/challenge accepted → just you
  3. New gathering published → all members (opt-out)
  4. Weekly digest (new photos, etc.) → Vercel Cron

## Planned / ideas

- **Resend as an email transport** — swap or add alongside Gmail SMTP once
  volume grows or we want a club-domain "from" address and better
  deliverability. The notify functions are written so only the transport
  changes. (Logged from the email-notifications discussion.)
- **Club email domain** — a proper `from` address (e.g. hello@theoldworld…)
  instead of a personal Gmail, with SPF/DKIM. Pairs with Resend.
- **Fixture editing** — currently fixtures can be added (auto, manual) or
  deleted, but not edited; add an edit step so a date/points can be set later
  without re-creating.

## Tech debt / before going fully public

- **Step 5 — RLS lockdown** (`supabase/rls.sql`): re-lock the core tables with
  proper policies before the site is genuinely public. Today some tables may be
  wide open.
- **Cross-league round grouping** — the Battles tab groups scheduled fixtures by
  round number across *all* leagues, so two leagues both running "Round 1" would
  merge under one header. Group by league → round if we ever run leagues
  concurrently.
