import { useEffect, useState } from 'react';
import KeyStatsChart from './KeyStatsChart';
import KeyStatsTable from './KeyStatsTable';

const API_URL = 'http://localhost:8000/api/stats/keys';

/**
 * Dashboard — fetches per-key stats from the backend and renders
 * summary cards, a bar chart of worst keys, and a sortable table.
 */
export default function Dashboard({ onBackToTest }) {
  const [data, setData] = useState(null);    // raw API response
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Fetch stats from the backend */
  function fetchStats() {
    setLoading(true);
    setError(null);

    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchStats();
  }, []);

  // ─── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-mono">Loading stats...</p>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 font-mono">Failed to load stats: {error}</p>
        <button
          onClick={fetchStats}
          className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Empty state (no sessions) ──────────────────────────────────
  if (!data || data.total_sessions === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <p className="text-slate-400 text-lg font-mono">
          Complete a typing test to see your stats
        </p>
        <button
          onClick={onBackToTest}
          className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-lg transition-colors"
        >
          Go to Test
        </button>
      </div>
    );
  }

  // ─── Success state ──────────────────────────────────────────────
  const { keys, total_keystrokes_analysed, total_sessions } = data;

  // Calculate overall accuracy from the key stats
  const totalCorrect = keys.reduce((sum, k) => sum + (k.total - k.errors), 0);
  const totalAll = keys.reduce((sum, k) => sum + k.total, 0);
  const overallAccuracy = totalAll > 0
    ? ((totalCorrect / totalAll) * 100).toFixed(1)
    : '100.0';

  // Worst key by error rate
  const worstKey = keys.length > 0 ? keys[0] : null; // already sorted desc

  // Top 10 worst keys for the chart
  const top10 = keys.slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-200">Dashboard</h1>
          <button
            onClick={onBackToTest}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-lg transition-colors"
          >
            Back to Test
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg p-5">
            <p className="text-slate-400 text-sm font-mono mb-1">Total Sessions</p>
            <p className="text-3xl font-bold text-yellow-400">{total_sessions}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-5">
            <p className="text-slate-400 text-sm font-mono mb-1">Keystrokes</p>
            <p className="text-3xl font-bold text-yellow-400">
              {total_keystrokes_analysed}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-5">
            <p className="text-slate-400 text-sm font-mono mb-1">Accuracy</p>
            <p className="text-3xl font-bold text-green-400">
              {overallAccuracy}%
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-5">
            <p className="text-slate-400 text-sm font-mono mb-1">Worst Key</p>
            <p className="text-3xl font-bold text-red-400">
              {worstKey ? (
                <>
                  <span className="font-mono">{worstKey.key}</span>{' '}
                  <span className="text-lg">{worstKey.error_rate}%</span>
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>

        {/* Bar chart */}
        {top10.length > 0 && (
          <div className="mb-8">
            <KeyStatsChart keys={top10} />
          </div>
        )}

        {/* Full table */}
        <div className="mb-8">
          <h3 className="text-slate-200 text-lg font-bold mb-4">
            All Keys ({keys.length})
          </h3>
          <KeyStatsTable keys={keys} />
        </div>
      </div>
    </div>
  );
}
