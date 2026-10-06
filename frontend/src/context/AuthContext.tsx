import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { apiFetch } from '../api';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  username: string | null;
  usernameLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUsername: (name: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Fetch username from backend after login
  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    setUsernameLoading(true);
    apiFetch('/api/users/username')
      .then((res) => res.json())
      .then((json) => {
        setUsername(json.username);
        setUsernameLoading(false);
      })
      .catch(() => {
        setUsername(null);
        setUsernameLoading(false);
      });
  }, [user]);

  // Call this after UsernameSetup succeeds
  const refreshUsername = useCallback((name: string | null) => {
    setUsername(name);
  }, []);

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle(): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUsername(null);
  }

  const value: AuthContextValue = {
    user, session, loading, username, usernameLoading,
    signInWithGoogle, signOut, refreshUsername,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
