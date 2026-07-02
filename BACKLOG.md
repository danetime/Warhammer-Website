# Feature list & backlog

Running list of things we want to do but haven't built yet, so nothing gets
lost between sessions. Newest ideas at the top of each section.

## Planned / ideas

- **Club email domain** — finish the proper `from` address. The code already
  supports it: set `RESEND_API_KEY` + `MAIL_FROM` (see the README). The
  remaining work is operational — register a club domain, verify it in Resend
  and add the SPF/DKIM DNS records.
- **Profile pages for placeholders** — a placeholder's record is viewable, but
  could show more (head-to-head, army splits) and let the Grand Marshal set its
  surname from the profile page rather than only the chambers.

## Tech debt / before going fully public

- **Run the lockdown before deploy** — every table now ships RLS in its
  migration and `supabase/rls-check.sql` audits coverage; the remaining task is
  procedural: run all migrations on the production project and confirm
  `rls-check.sql` reports nothing open before opening the gates.
- **Carry names into league/cup tables** — `rewrite_member_name()` (used by
  rename and placeholder-merge) deliberately leaves `pages.rows` alone, so a
  manually-typed name in a league table or cup bracket isn't rewritten. Admin
  can edit it in place; revisit if that becomes fiddly.

## Shipped

- **v1.3.0** — battle reports carry their competition (`kind`/`page_id`,
  auto-filled when converting a fixture); league tables tally P/W/D/L from
  their filed reports ("Tally from reports"); reports are editable in place by
  the filer or an admin; doubles partners record their own army
  (`army_a2`/`army_b2`); a Doubles pairs table on the Battles tab
  (`supabase/reports-v2.sql`).

- **v1.2.0** — fixtures can be left date-TBC; a fixture can be turned straight
  into a battle report ("this game has been played"), which strikes the fixture
  once filed; doubles (2v2) battles via a tick on the report form — partner per
  side stored in `player_a2` / `player_b2`, with league points and Might awarded
  to all four players exactly as a singles game (`supabase/doubles.sql`).
  Follow-up hardening: the fixture is only struck once the report saves, the
  pre-fill resolves league-row labels to real member names, and
  `supabase/fixtures-played.sql` lets a member strike a fixture they're named
  in under RLS (label-stored league fixtures still need the Marshal).
- **v1.1.1** — username changes: members can rename themselves, and admins can
  rename anyone (from the profile Settings dialog or the admin Members panel).
  The `rename_member()` RPC carries all history across server-side; the collision
  check is case-insensitive and also guards against placeholder names. (Known
  gap: `pages.rows` league/cup tables are still not rewritten — see the tech-debt
  note above.)
- **v1.1** — placeholder members (+ link-to-account merge), fixture editing,
  per-competition round grouping, Resend email transport, RLS lockdown audit.
- **v1.0** — committed army lists, email notifications (Gmail SMTP + weekly
  digest), member surnames, the gallery, the changelog pop-up.
