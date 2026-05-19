"use client";

/**
 * Supabase-backed auth provider.
 *
 * On mount: reads the current session via the SSR cookie, loads the matching
 * `profiles` row, and subscribes to auth state changes (sign-in / sign-out /
 * token refresh) so the UI reacts instantly.
 *
 * The shape of `AuthContextValue` is identical to the old mock — call sites
 * (login page, app shell, sidebar account block) don't need to change.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./supabase/client";
import type { Profile } from "./types";

export type AuthUser = Profile;

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadProfile = React.useCallback(
    async (userId: string, fallbackEmail: string | null) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, role, must_change_password")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        // eslint-disable-next-line no-console
        console.error("auth: failed to load profile", error);
      }

      if (data) {
        setUser(data as AuthUser);
      } else {
        // No profile row yet (first login before the bootstrap trigger ran,
        // or the trigger is missing). Synthesize a minimal profile so the
        // app shell can render rather than spinning forever.
        setUser({
          id: userId,
          full_name: null,
          email: fallbackEmail,
          avatar_url: null,
          role: null,
        });
      }
    },
    [supabase],
  );

  React.useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (u) await loadProfile(u.id, u.email ?? null);
      else setUser(null);
      setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? null);
      } else {
        setUser(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signIn = React.useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: error.message };
      return {};
    },
    [supabase],
  );

  const signOut = React.useCallback<AuthContextValue["signOut"]>(async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.replace("/login");
  }, [supabase, router]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be called within AuthProvider");
  return ctx;
}
