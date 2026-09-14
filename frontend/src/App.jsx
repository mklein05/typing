import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TypingTest from './components/TypingTest';
import Dashboard from './components/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import UserMenu from './components/UserMenu';
import LoginPage from './components/LoginPage';
import { apiFetch } from './api';

/** Header with logo, tab navigation, and user menu. */
function Header({ practiceData, setPracticeData, practiceAvailable }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const path = location.pathname;
  const activeTab = path === '/practice' ? 'practice' : 'test';

  // Practice is generated from your own bigram stats, so it can't work
  // without an account — guests get locked out with a sign-in prompt.
  const tabs = [
    { key: 'test', label: 'Test', to: '/' },
    {
      key: 'practice',
      label: 'Practice',
      to: '/practice',
      locked: !user || !practiceAvailable,
      lockReason: !user
        ? 'Sign in to unlock personalised practice'
        : 'Complete more typing tests to unlock practice',
    },
  ];

  function goToPractice() {
    if (practiceData) {
      navigate('/practice');
      return;
    }
    // Don't fetch here — let the /practice route handle it via useEffect
    navigate('/practice');
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
      <button
        onClick={() => navigate('/')}
        title="typingSeal — go to test"
        className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80 cursor-pointer"
      >
        <img
          src="/seallogo.png"
          alt="Seal typing down"
          className="w-full h-10 "
        />
        <span className="font-pixel theme-text font-bold text-lg">
          typingSeal
        </span>
      </button>

      <nav className="flex gap-1 theme-panel rounded-lg p-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isLocked = tab.locked;

          return (
            <button
              key={tab.key}
              onClick={() => {
                if (isLocked) return;
                if (tab.key === 'practice') goToPractice();
                else navigate(tab.to);
              }}
              disabled={isLocked}
              title={isLocked ? tab.lockReason : undefined}
              className={`font-pixel px-4 py-1.5 rounded-md text-sm font-bold transition-colors capitalize ${
                isLocked
                  ? 'theme-text-subtle cursor-not-allowed'
                  : isActive
                    ? 'theme-accent'
                    : 'theme-text-muted hover:theme-text'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {user ? (
        <UserMenu />
      ) : (
        <button
          onClick={() => navigate('/login')}
          className="font-pixel px-4 py-1.5 rounded-lg border border-slate-700 theme-text-soft text-sm font-bold transition-colors hover:border-amber-500/60 hover:bg-slate-800"
        >
          Sign in
        </button>
      )}
    </header>
  );
}

/** Pages — renders the correct component based on current route. */
function Pages({ practiceData, setPracticeData, onSessionSaved }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Auto-fetch practice data if navigating directly to /practice.
  // Guests have no stats to generate from — the request would just 401.
  const [autoLoading, setAutoLoading] = useState(false);
  const path = useLocation().pathname;

  useEffect(() => {
    if (!user) return;
    if (path === '/practice' && !practiceData && !autoLoading) {
      setAutoLoading(true);
      apiFetch('/api/practice/generate?count=10&word_count=35')
        .then((res) => res.json())
        .then((json) => {
          if (!json.error) setPracticeData(json);
          setAutoLoading(false);
        })
        .catch(() => setAutoLoading(false));
    }
  }, [path, practiceData, autoLoading, setPracticeData, user]);

  return (
    <div className="flex-1 flex flex-col">
      <Routes>
        <Route
          path="/"
          element={
            <TypingTest
              onViewDashboard={() => navigate('/dashboard')}
              onSessionSaved={onSessionSaved}
            />
          }
        />
        <Route
          path="/practice"
          element={
            practiceData ? (
              <TypingTest
                mode="practice"
                practiceWords={practiceData.practice_words}
                drillText={practiceData.drill_text}
                targetedBigrams={practiceData.targeted_bigrams}
                onViewDashboard={() => navigate('/dashboard')}
                onBackToDashboard={() => navigate('/dashboard')}
                onSessionSaved={onSessionSaved}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="theme-text-muted font-mono">
                  Loading practice...
                </p>
              </div>
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard
                onBackToTest={() => navigate('/')}
                onStartPractice={(data) => {
                  setPracticeData(data);
                  navigate('/practice');
                }}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

/** Layout wrapper: header + pages. Public — guests land straight on the test. */
function AppLayout() {
  const { user, loading } = useAuth();
  const [practiceData, setPracticeData] = useState(null);
  const [practiceAvailable, setPracticeAvailable] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // Both practice values are derived from the signed-in user's own stats, so
  // guests skip them rather than firing requests that would 401.
  const refreshPracticeData = useCallback(() => {
    if (!user) return Promise.resolve();
    return apiFetch('/api/practice/generate?count=10&word_count=35')
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setPracticeData(json);
      })
      .catch(() => {});
  }, [user]);

  const refreshPracticeAvailability = useCallback(() => {
    if (!user) return;
    apiFetch('/api/stats/bigrams')
      .then((res) => res.json())
      .then((json) => {
        const bigrams = json.bigrams || [];
        // Unlock if there are enough bigrams with sufficient data
        const weak = bigrams.filter((b) => b.total_occurrences >= 3 && b.error_rate > 0);
        setPracticeAvailable(weak.length >= 1);
      })
      .catch(() => setPracticeAvailable(false));
  }, [user]);

  // A saved test changes the user's bigram stats, so regenerate the practice
  // words against the new weaknesses *and* re-check the unlock condition.
  // (`getBigramStats` is cached server-side but invalidated on session save,
  // and Node handles these sequentially, so only one recompute happens.)
  const handleSessionSaved = useCallback(() => {
    refreshPracticeData();
    refreshPracticeAvailability();
  }, [refreshPracticeData, refreshPracticeAvailability]);

  // Initial load: gate the first render on the practice words, then check the
  // unlock condition.
  useEffect(() => {
    if (loading) return;

    if (!user) {
      setPracticeData(null);
      setPracticeAvailable(false);
      setAppReady(true);
      return;
    }

    refreshPracticeData().finally(() => {
      setAppReady(true);
      refreshPracticeAvailability();
    });
  }, [loading, user, refreshPracticeData, refreshPracticeAvailability]);

  if (!appReady) {
    return (
      <div className="min-h-screen theme-app flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-app flex flex-col">
      <Header
        practiceData={practiceData}
        setPracticeData={setPracticeData}
        practiceAvailable={practiceAvailable}
      />
      <Pages
        practiceData={practiceData}
        setPracticeData={setPracticeData}
        onSessionSaved={handleSessionSaved}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Sign-in is a full-screen takeover, so it lives outside the shell.
              The shell itself is public — guests can take tests without an
              account; /dashboard is the only route that requires sign-in. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
