// Single Supabase client used everywhere. Reads VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY from .env (or the host's environment variable panel).
// The anon key is safe to ship in client code — row-level-security policies on
// the server are what actually protect the data.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Don't throw — let the UI show a friendly setup message instead. The app
  // will still mount, but every query will fail until env vars are set.
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env and fill them in.'
  );
}

// Untyped client: newer supabase-js versions require generated metadata our
// hand-written Database mirror doesn't have, which collapses .upsert()/.update()
// parameter types to `never`. Row types are enforced by the mappers instead.
export const supabase: SupabaseClient = createClient(
  url ?? 'https://placeholder.supabase.co',
  anon ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

export const supabaseConfigured = !!url && !!anon;
