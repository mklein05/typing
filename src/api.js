import { supabase } from './supabaseClient';

const API_BASE = 'http://localhost:8000';

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

  // If the JWT is invalid or expired, sign the user out
  if (response.status === 401) {
    await supabase.auth.signOut();
    throw new Error('Session expired — please sign in again.');
  }

  return response;
}
