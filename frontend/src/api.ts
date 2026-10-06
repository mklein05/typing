import { supabase } from './supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Fetch wrapper that includes the Supabase JWT in the Authorization header.
 * If the backend returns 401, the token is expired — sign out.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();

  // Headers starts from the caller's, then fills in the JSON content type only
  // if the caller did not set one — matching the previous spread order.
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
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
