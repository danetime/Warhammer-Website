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

## Build progress

This follows the staged build brief:

- [x] **Step 1 — Scaffold:** Vite + React + Tailwind, prototype rendering, shared
  Supabase client module, `.env` wiring.
- [ ] **Step 2 — Supabase schema:** tables and storage buckets — SQL ready in
  `supabase/schema.sql` (run it in the Supabase SQL Editor).
- [ ] **Step 3 — Auth:** real Supabase email + password (login UI unchanged).
- [ ] **Step 4 — Storage layer:** replace `sget`/`sset`/`sdel` with Supabase.
- [ ] **Step 5 — Security:** Row Level Security on every table.
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
supabase/
  schema.sql             Step 2 tables + storage buckets (run in SQL Editor)
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
