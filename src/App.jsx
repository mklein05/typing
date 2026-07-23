import { useState } from 'react';
import TypingTest from './components/TypingTest';
import Dashboard from './components/Dashboard';

function App() {
  const [view, setView] = useState('test');
  const [practiceData, setPracticeData] = useState(null);

  const isDashboard = view === 'dashboard';

  const content = (() => {
    if (view === 'dashboard') {
      return (
        <Dashboard
          onBackToTest={() => setView('test')}
          onStartPractice={(data) => {
            setPracticeData(data);
            setView('practice');
          }}
        />
      );
    }

    if (view === 'practice' && practiceData) {
      return (
        <TypingTest
          mode="practice"
          practiceWords={practiceData.practice_words}
          drillText={practiceData.drill_text}
          targetedBigrams={practiceData.targeted_bigrams}
          onViewDashboard={() => setView('dashboard')}
          onBackToDashboard={() => setView('dashboard')}
        />
      );
    }

    return (
      <TypingTest onViewDashboard={() => setView('dashboard')} />
    );
  })();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo placeholder */}
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-slate-900 font-bold text-sm">
            T
          </div>
          <span className="text-slate-200 font-bold text-lg tracking-tight">
            typingSeal
          </span>
        </div>

        <button
          onClick={() => setView(isDashboard ? 'test' : 'dashboard')}
          className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-mono font-bold rounded-lg transition-colors border border-slate-700"
        >
          {isDashboard ? 'Test' : 'Dashboard'}
        </button>
      </header>

      {/* ─── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {content}
      </div>
    </div>
  );
}

export default App;
