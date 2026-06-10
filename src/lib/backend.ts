// Which data backend the app talks to.
//   local    — the bundled Express + SQLite server (server/index.mjs), no auth
//   supabase — the cloud Postgres backend with magic-link auth
// Explicit VITE_BACKEND wins; otherwise infer from whether Supabase is set up.

export const BACKEND: 'local' | 'supabase' =
  (import.meta.env.VITE_BACKEND as 'local' | 'supabase' | undefined)
  ?? (import.meta.env.VITE_SUPABASE_URL ? 'supabase' : 'local');

export const IS_LOCAL = BACKEND === 'local';
