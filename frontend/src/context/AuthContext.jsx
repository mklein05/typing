import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { apiFetch } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState(null);
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
  const refreshUsername = useCallback((name) => {
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

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUsername(null);
  }

  const value = {
    user, session, loading, username, usernameLoading,
    signInWithGoogle, signOut, refreshUsername,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
