import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('../context/AuthContext', () => ({ useAuth }));
vi.mock('./UsernameSetup', () => ({ default: () => <div>username setup</div> }));

import ProtectedRoute from './ProtectedRoute';

function authState(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    loading: false,
    username: null,
    usernameLoading: false,
    refreshUsername: vi.fn(),
    ...overrides,
  };
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>protected content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => useAuth.mockReset());

  it('redirects a guest to /login', () => {
    useAuth.mockReturnValue(authState());
    renderGuard();
    expect(screen.getByText('login page')).toBeDefined();
    expect(screen.queryByText('protected content')).toBeNull();
  });

  it('renders neither branch while auth is loading', () => {
    useAuth.mockReturnValue(authState({ loading: true }));
    renderGuard();
    expect(screen.queryByText('login page')).toBeNull();
    expect(screen.queryByText('protected content')).toBeNull();
  });

  it('asks for a username when the account has none', () => {
    useAuth.mockReturnValue(authState({ user: { id: 'u1' } }));
    renderGuard();
    expect(screen.getByText('username setup')).toBeDefined();
  });

  it('renders children for a signed-in user with a username', () => {
    useAuth.mockReturnValue(authState({ user: { id: 'u1' }, username: 'Iron' }));
    renderGuard();
    expect(screen.getByText('protected content')).toBeDefined();
  });
});
