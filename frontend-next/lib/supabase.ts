'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

declare global {
  // eslint-disable-next-line no-var
  var __FIQ_SUPABASE__: SupabaseClient | undefined;
}

function createSupabaseClient(): SupabaseClient {
  if (!url || !anon) {
    // Stub client so static rendering / local previews don't crash before
    // .env.local is filled in. Any real call will surface a clear error.
    return new Proxy({} as SupabaseClient, {
      get(_t, prop) {
        if (prop === 'auth') {
          return {
            getSession: async () => ({ data: { session: null } }),
            onAuthStateChange: () => ({
              data: { subscription: { unsubscribe: () => {} } },
            }),
            signInWithPassword: async () => ({
              data: null,
              error: new Error(
                'Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
              ),
            }),
            signUp: async () => ({
              data: null,
              error: new Error(
                'Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
              ),
            }),
            signOut: async () => ({ error: null }),
          };
        }
        throw new Error(
          'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
        );
      },
    });
  }
  return createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export const supabase: SupabaseClient =
  globalThis.__FIQ_SUPABASE__ ?? createSupabaseClient();

if (typeof window !== 'undefined') {
  globalThis.__FIQ_SUPABASE__ = supabase;
}
