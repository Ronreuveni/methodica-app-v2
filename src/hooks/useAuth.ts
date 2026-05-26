// Tracks the current Supabase session and exposes signIn / signOut helpers.
// Also reports whether the signed-in user's email is on the allowed list.

import { useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

export type AuthState = {
  configured: boolean;          // .env vars present?
  loading: boolean;             // initial session check in flight
  session: Session | null;
  user: User | null;
  email: string | null;
  isAllowed: boolean | null;    // null = unknown yet
  allowError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [allowError, setAllowError] = useState<string | null>(null);

  // Boot: get current session, then listen for changes.
  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Verify email is on the allowlist. We call the RPC so RLS+function logic
  // matches what the policies enforce.
  useEffect(() => {
    if (!session) { setIsAllowed(null); setAllowError(null); return; }
    let cancelled = false;
    setIsAllowed(null);
    setAllowError(null);
    (async () => {
      const { data, error } = await supabase.rpc('is_allowed_user');
      if (cancelled) return;
      if (error) {
        setIsAllowed(false);
        setAllowError(error.message);
        return;
      }
      setIsAllowed(!!data);
    })();
    return () => { cancelled = true; };
  }, [session]);

  const signInWithGoogle = async () => {
    if (!supabaseConfigured) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return useMemo<AuthState>(() => ({
    configured: supabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    email: session?.user?.email ?? null,
    isAllowed,
    allowError,
    signInWithGoogle,
    signOut,
  }), [loading, session, isAllowed, allowError]);
}
