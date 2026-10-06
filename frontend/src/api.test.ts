import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock is hoisted above the imports, so the fns it closes over must be
// created with vi.hoisted rather than plain consts (which would be in the TDZ).
const { getSession, signOut } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('./supabaseClient', () => ({
  supabase: { auth: { getSession, signOut } },
}));

import { apiFetch } from './api';

const fetchMock = vi.fn();

describe('apiFetch', () => {
  beforeEach(() => {
    getSession.mockReset();
    signOut.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the bearer token and defaults the content type', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    fetchMock.mockResolvedValue({ status: 200 } as Response);

    await apiFetch('/api/profile');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/profile');

    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('sends no Authorization header for a guest', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue({ status: 200 } as Response);

    await apiFetch('/api/quotes');

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('signs out and throws when a 401 arrives with a session', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    signOut.mockResolvedValue({});
    fetchMock.mockResolvedValue({ status: 401 } as Response);

    await expect(apiFetch('/api/profile')).rejects.toThrow(/Session expired/);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('does not sign out on a 401 when there was no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue({ status: 401 } as Response);

    const response = await apiFetch('/api/quotes');

    expect(response.status).toBe(401);
    expect(signOut).not.toHaveBeenCalled();
  });
});
