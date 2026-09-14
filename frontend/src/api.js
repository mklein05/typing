import { supabase } from './supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Fetch wrapper that includes the Supabase JWT in the Authorization header.
 * If the backend returns 401, the token is expired — sign out.
 */
export async function apiFetch(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // A 401 means the token was rejected. Only sign out if there actually was a
  // session — a guest sends no token at all, so there is nothing to sign out
  // of, and doing it would hide the real cause of the failure.
  if (response.status === 401 && session) {
    await supabase.auth.signOut();
    throw new Error('Session expired — please sign in again.');
  }

  return response;
}
