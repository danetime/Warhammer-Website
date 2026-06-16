# The Old World League

A private, members-only hub for a Warhammer Fantasy (7th edition) gaming group:
league tables, a Grand Tourney, the Council, battle reports with an ELO ladder,
army ranks, a gallery, a library and a herald.

This repository is the production build of the prototype, scaffolded as a
**Vite + React** app. The UI in `src/old-world-league.jsx` is the source of truth
and is preserved verbatim; only the persistence layer is being migrated from the
prototype's `window.storage` to **Supabase**.

## Tech stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) (JavaScript)
- [Tailwind CSS](https://tailwindcss.com/) v3
- [lucide-react](https://lucide.dev/) icons
- [react-router-dom](https://reactrouter.com/) for member profile pages
- [Supabase](https://supabase.com/) (auth, database, storage) — wired in over the
  next steps

## Getting started

```bash
npm install        # install dependencies
cp .env.example .env   # then fill in your Supabase project values
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # production build into dist/
npm run preview    # preview the production build locally
```

### Environment variables

Create a `.env` file (gitignored) with your Supabase project credentials —
found in the Supabase dashboard under **Project Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The same Supabase project is used both locally and in production.

### Email notifications (Vercel functions)

Notification emails are sent by the serverless functions in `api/`, not the
browser. They only run on Vercel (or `vercel dev`); under `npm run dev` the
client trigger simply no-ops. Run `supabase/email-prefs.sql` once, then set
these **server-side** env vars in Vercel (no `VITE_` prefix — they must never
reach the browser):

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # Supabase → Settings → API
GMAIL_USER=youraddress@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password       # Google account → App passwords
SITE_URL=https://your-site.vercel.app              # optional, for links
CRON_SECRET=any-long-random-string                 # protects the weekly digest
```

The weekly digest schedule lives in `vercel.json` (`crons`). Swapping Gmail for
Resend later only touches the transport in `api/notify.js` and `api/digest.js`.

## Build progress

This follows the staged build brief:

- [x] **Step 1 — Scaffold:** Vite + React + Tailwind, prototype rendering, shared
  Supabase client module, `.env` wiring.
- [x] **Step 2 — Supabase schema:** tables and storage buckets
  (`supabase/schema.sql`).
- [x] **Step 3 — Auth:** real Supabase email + password (login design
  unchanged). The app creates the profile on sign-up; first member becomes
  admin. Requires email confirmation disabled. `supabase/auth.sql` is optional.
- [x] **Step 4 — Storage layer:** all data + photos moved to Supabase via
  `src/lib/db.js` (snake_case ↔ UI shapes); photos upload to Storage.
- [ ] **Step 5 — Security:** re-enable Row Level Security with proper policies
  (`supabase/rls.sql`): read-all for members, own-row writes, admin-only
  management, server-side first-member-admin.
- [ ] **Step 6 — Local test checklist.**
- [ ] **Step 7 — Deploy** (only when explicitly approved).

## Project structure

```
index.html               App entry HTML
src/
  main.jsx               React entry; mounts <App/>
  index.css              Tailwind directives
  old-world-league.jsx   The app (source of truth for UI + feature logic)
  lib/
    supabaseClient.js    Single shared Supabase client
    db.js                Data layer: load/CRUD + DB<->UI mapping, photo storage
    notify.js            Best-effort client trigger for email notifications
api/                     Vercel serverless functions (server-side email)
  notify.js              Instant alerts: availability / accepted / gathering
  digest.js              Weekly digest (run by Vercel Cron — see vercel.json)
supabase/
  schema.sql             Step 2 tables + storage buckets (run in SQL Editor)
  auth.sql               Step 3 profile trigger + first-user-admin (optional)
  disable-rls-dev.sql    Dev: turn RLS off while building
  storage-policies.sql   Allow members to upload to the photos bucket
  rls.sql                Step 5 RLS policies (re-locks tables before deploy)
  honours.sql            Member side-titles table + RLS (run after rls.sql)
  availability.sql       Availability board + fixture type/competition/scenario
  elo-margins.sql        Victory margins + casual (unranked) games
  emblems.sql            Army emblems table + storage bucket
  avatars.sql            Profile avatar/mascot columns + storage bucket
  rename.sql             rename_member() — rename a member, carrying history
  rounds.sql             round number on fixtures (round-robin scheduling)
  hall-of-fame.sql       laurels table — past champions & cup winners (admin)
  photo-comments.sql     comments column on photos (members comment on the gallery)
  admin.sql              admin_delete_member() — remove a member (account + profile)
  settings.sql           key/value site settings (editable name + next gathering)
  email-prefs.sql        per-member email opt-out (profiles.email_prefs)
BACKLOG.md               Feature list & backlog (deferred ideas, tech debt)
docs/
  build-guide.py         Generates the field-manual PDF (needs `pip install reportlab`)
  old-world-league-guide.pdf  Members' how-to-use guide
tailwind.config.js
postcss.config.js
vite.config.js
```

## Conventions

- British spelling throughout.
- Visual identity: parchment, Empire crimson `#7f1d1d`, brass gold `#b45309`,
  blackletter masthead, sharp corners. Mobile-first.
- Three distinct titles, kept separate: **Grand Marshal** (admin), **Lord-General
  of the Empire** (top Empire rank), **Champion of the Old World** (league winner).
- Nothing destructive without a confirm step.
