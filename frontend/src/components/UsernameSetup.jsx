import { useState } from 'react';
import { apiFetch } from '../api';

/**
 * Shown after first sign-in.  User picks a username.
 * On success, calls onDone() so the parent can refresh.
 */
export default function UsernameSetup({ onDone }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (trimmed.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await apiFetch('/api/users/username', {
        method: 'POST',
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail || 'Failed to set username');
      }
      onDone(trimmed);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen theme-app flex flex-col items-center justify-center px-4">
      <div className="w-16 h-16 theme-accent rounded-2xl flex items-center justify-center font-bold text-2xl mb-6">
        T
      </div>

      <h1 className="text-2xl font-bold theme-text mb-2">
        Choose your username
      </h1>
      <p className="theme-text-muted text-sm mb-8 text-center max-w-xs">
        This is how you'll appear in the app.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-full max-w-xs">
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(''); }}
          placeholder="username"
          autoFocus
          maxLength={20}
          className="w-full px-4 py-2.5 rounded-lg theme-panel border border-slate-700 theme-text text-center font-mono text-lg
                     placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />

        {error && (
          <p className="text-red-400 text-sm font-mono">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-2.5 theme-accent disabled:bg-amber-700 font-bold rounded-lg transition-colors"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
