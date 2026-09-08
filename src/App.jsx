import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import TypingTest from './components/TypingTest';
import Dashboard from './components/Dashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import UserMenu from './components/UserMenu';
import { apiFetch } from './api';

/** Header with logo, tab navigation, and user menu. */
function Header({ practiceData, setPracticeData, practiceAvailable }) {
  const navigate = useNavigate();
  const location = useLocation();

  const path = location.pathname;
  const activeTab = path === '/dashboard' ? 'dashboard'
    : path === '/practice' ? 'practice'
    : 'test';

  const tabs = [
    { key: 'test', label: 'Test', to: '/' },
    {
      key: 'practice',
      label: 'Practice',
      to: '/practice',
      locked: !practiceAvailable,
    },
    { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  ];

  function goToPractice() {
    if (practiceData) {
      navigate('/practice');
      return;
    }
    apiFetch('/api/practice/generate?count=10&word_count=35')
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          setPracticeData(json);
          navigate('/practice');
        }
      })
      .catch(() => {});
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-3">
        <img
          src="/seallogo.png"
          alt="Seal typing down"
          className={`w-full h-10  `}
        />
        <span className="text-slate-200 font-bold text-lg tracking-tight">
          typingSeal
        </span>
      </div>

      <nav className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
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
              title={isLocked ? 'Complete more typing tests to unlock practice' : undefined}
              className={`px-4 py-1.5 rounded-md text-sm font-mono font-bold transition-colors capitalize ${
                isLocked
                  ? 'text-slate-600 cursor-not-allowed'
                  : isActive
                    ? 'bg-amber-500 text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <UserMenu />
    </header>
  );
}

/** Pages — renders the correct component based on current route. */
function Pages({ practiceData, setPracticeData }) {
  const navigate = useNavigate();

  // Auto-fetch practice data if navigating directly to /practice
  const [autoLoading, setAutoLoading] = useState(false);
  const path = useLocation().pathname;

  useEffect(() => {
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
  }, [path, practiceData, autoLoading, setPracticeData]);

  return (
    <div className="flex-1 flex flex-col">
      <Routes>
        <Route
          path="/"
          element={
            <TypingTest onViewDashboard={() => navigate('/dashboard')} />
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
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-slate-400 font-mono">
                  Loading practice...
                </p>
              </div>
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            <Dashboard
              onBackToTest={() => navigate('/')}
              onStartPractice={(data) => {
                setPracticeData(data);
                navigate('/practice');
              }}
            />
          }
        />
      </Routes>
    </div>
  );
}

/** Layout wrapper: header + pages, shown when authenticated. */
function AppLayout() {
  const [practiceData, setPracticeData] = useState(null);
  const [practiceAvailable, setPracticeAvailable] = useState(false);
  const location = useLocation();

  // Re-check practice availability on every route change
  useEffect(() => {
    apiFetch('/api/stats/bigrams')
      .then((res) => res.json())
      .then((json) => {
        const bigrams = json.bigrams || [];
        // Unlock if there are enough bigrams with sufficient data
        const weak = bigrams.filter((b) => b.total_occurrences >= 3 && b.error_rate > 0);
        setPracticeAvailable(weak.length >= 1);
      })
      .catch(() => setPracticeAvailable(false));
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header
        practiceData={practiceData}
        setPracticeData={setPracticeData}
        practiceAvailable={practiceAvailable}
      />
      <Pages practiceData={practiceData} setPracticeData={setPracticeData} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
