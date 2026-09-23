import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UsernameSetup from './UsernameSetup';

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Guards routes that need a real account — /dashboard and /practice.
 *
 * Guests are redirected to /login, which is also what happens if they sign out
 * while on the page. Signed-in users who haven't picked a username yet are
 * asked for one, since the dashboard displays it; pass `requireUsername={false}`
 * for routes that don't need it (practice).
 */
export default function ProtectedRoute({ children, requireUsername = true }) {
  const { user, loading, username, usernameLoading, refreshUsername } = useAuth();

  if (loading) return <Spinner />;

  if (!user) return <Navigate to="/login" replace />;

  if (!requireUsername) return children;

  if (usernameLoading) return <Spinner />;

  if (!username) return <UsernameSetup onDone={refreshUsername} />;

  return children;
}
