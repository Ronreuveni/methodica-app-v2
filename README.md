# Methodica Studio · Production Board v2

A multi-user, real-time studio production board for Methodica.
**Vite + React + TypeScript + Tailwind + Supabase.** Built from scratch
on top of a per-row database model so concurrent edits from different
team members never collide — no echo loops, no "edit disappeared".

> Replaces the script-tag, single-document-Firestore v1 (the
> `methodica-app-main/` folder one directory up).

## Features

- 🔐 Google sign-in via Supabase Auth + email allowlist (RLS-enforced)
- 📊 Board view with inline cell editing, filters, sort modes, group-by-client
- 📅 Producer × day matrix (week / fortnight)
- 👤 Per-producer detail view with upcoming deadlines + active projects
- ⚡ Real-time sync — every cell write is one row, broadcast instantly to all
  open clients via Supabase Realtime
- 🎨 Identical Hebrew / RTL look-and-feel as v1

## Quickstart

### 1. Clone + install

```bash
git clone https://github.com/Ronreuveni/methodica-app-v2.git
cd methodica-app-v2
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. After it provisions, **Settings → API** — copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### 3. Configure environment variables

```bash
cp .env.example .env
# then edit .env and paste your Supabase URL + anon key
```

For **Lovable**: paste the same values in the Lovable project settings
under "Environment Variables".

### 4. Run the database schema

Open the Supabase **SQL Editor** and paste the contents of
[`supabase/schema.sql`](./supabase/schema.sql). Click **Run**. This creates
all tables, indexes, RLS policies, the realtime publication, and adds
`ronr@methodic.co.il` as the first allowed user.

### 5. (Optional) Seed historical data

If you want the 84 active + 265 completed projects from the legacy Excel:

```bash
# Generate seed.sql from the legacy v1 data.js
node scripts/convert-seed.mjs ../methodica-app-main/data.js > supabase/seed.sql

# Then paste supabase/seed.sql into the Supabase SQL Editor and Run.
```

### 6. Enable Google sign-in

In the Supabase dashboard → **Authentication → Providers → Google**:
1. Toggle **Enabled**
2. Add your domain to **Site URL** / **Additional Redirect URLs** (e.g.
   `https://your-app.lovable.app`, `http://localhost:5173`)
3. Paste your Google OAuth client ID + secret (or use the Supabase default)

### 7. Add more users

Two options:

- **In the Supabase dashboard** → Table Editor → `allowed_emails` → add row.
- **In SQL Editor**:
  ```sql
  insert into public.allowed_emails (email, added_by)
  values ('teammate@methodic.co.il', 'ronr@methodic.co.il')
  on conflict (email) do nothing;
  ```

### 8. Run locally

```bash
npm run dev
```

The app opens on `http://localhost:5173`. Sign in with a Google account
whose email is on the allowlist.

### 9. Deploy

**Lovable**: import the GitHub repo, set the two `VITE_*` env vars, deploy.

**Cloudflare Pages / Vercel / Netlify**: build command `npm run build`,
output directory `dist`. Add the env vars.

## Architecture

### Why a new version?

The v1 app stored the entire workspace as a **single Firestore document**
and rewrote it on every edit. That created an echo loop:

```
snapshot arrives → setState (new ref) → write effect fires → cloud update →
snapshot fires again → setState (new ref) → ...
```

Within the loop, a snapshot echo from cycle N could arrive while the user
was editing in cycle N+1 — and the snapshot's stale data would overwrite
the local edit before it could be written to the cloud. This appeared as
"edits disappear / revert to initial".

### How v2 fixes it

Each entity (producer, project, assignment, team) lives in its **own row**
in its own Postgres table. Writes target a single row via SQL `UPDATE …
WHERE id = …`. Two users editing two different projects don't conflict.
Two users editing the same row use last-write-wins on a per-field basis
(via JSON merge in the patch builder) — which for short collaboration
windows is effectively never a problem.

Realtime: Supabase publishes `postgres_changes` events to subscribed
clients. The React hook merges each event idempotently — if the incoming
row equals the local row, the state reference is preserved and React
skips a re-render, breaking any potential loop at the source.

### File layout

```
src/
  main.tsx               -- React root
  App.tsx                -- View routing + auth gate
  index.css              -- Tailwind layer + theme tokens
  components/
    AuthGate.tsx         -- Sign-in / allowlist guard UI
    Sidebar.tsx          -- Left nav, producer list
    Avatar.tsx           -- Producer chip
    StatusPill.tsx       -- Colored status badge
    PageHead.tsx         -- Page header bar
  views/
    BoardView.tsx        -- Productions table + filters + KPIs
    MatrixView.tsx       -- Producer × day grid
    ProducerView.tsx     -- Per-producer detail
  hooks/
    useAuth.ts           -- Session + allowlist check
    useStudioData.ts     -- Initial fetch + realtime subs + mutations
  lib/
    supabase.ts          -- Single shared client
    types.ts             -- UI-facing domain types
    database.types.ts    -- Row types matching Postgres schema
    mappers.ts           -- Row ↔ domain conversion
supabase/
  schema.sql             -- Tables, RLS, realtime publication
scripts/
  convert-seed.mjs       -- One-shot legacy data.js → seed.sql
```

## Adding the next view / feature

Open `src/views/`. Each view receives the `StudioData` object from
`useStudioData`. To read: pull from `data.projects` / `data.producers` /
etc. To write: call `data.patchProject(id, { hours: 45 })` (or
`upsertProject`, `deleteProject`, …). The patch helper sends a SQL
`UPDATE … WHERE id` with only the changed fields, applies an optimistic
local update, and reconciles on the realtime echo.

## License

Internal Methodica project. Not for redistribution.
