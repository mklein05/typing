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
 * Guards routes that need a real account — currently just /dashboard.
 *
 * Guests are redirected to /login. Signed-in users who haven't picked a
 * username yet are asked for one, since the dashboard displays it.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading, username, usernameLoading, refreshUsername } = useAuth();

  if (loading) return <Spinner />;

  if (!user) return <Navigate to="/login" replace />;

  if (usernameLoading) return <Spinner />;

  if (!username) return <UsernameSetup onDone={refreshUsername} />;

  return children;
}
