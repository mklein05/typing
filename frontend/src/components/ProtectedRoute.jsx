import { useAuth } from '../context/AuthContext';
import LoginPage from './LoginPage';
import UsernameSetup from './UsernameSetup';

/**
 * Wraps children.  If the user is not authenticated, shows LoginPage.
 * If authenticated but no username set, shows UsernameSetup.
 * While checking, shows a loading spinner.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading, username, usernameLoading, refreshUsername } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen theme-app flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (usernameLoading) {
    return (
      <div className="min-h-screen theme-app flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!username) {
    return <UsernameSetup onDone={refreshUsername} />;
  }

  return children;
}
