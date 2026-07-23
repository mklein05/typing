import { useEffect, useState } from 'react';
import KeyStatsChart from './KeyStatsChart';
import KeyStatsTable from './KeyStatsTable';
import BigramChart from './BigramChart';
import BigramTable from './BigramTable';
import KeyboardHeatmap from './KeyboardHeatmap';

const KEYS_API = 'http://localhost:8000/api/stats/keys';
const BIGRAMS_API = 'http://localhost:8000/api/stats/bigrams';

/**
 * Dashboard — fetches per-key and bigram stats from the backend and renders
 * summary cards, bar charts of worst keys/bigrams, and sortable tables.
 */
export default function Dashboard({ onBackToTest, onStartPractice }) {
  const [data, setData] = useState(null);              // key stats API response
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [bigramData, setBigramData] = useState(null);  // bigram API response
  const [bigramLoading, setBigramLoading] = useState(true);
  const [bigramError, setBigramError] = useState(null);

  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState(null);

  /** Fetch both key stats and bigrams in parallel. */
  function fetchStats() {
    setLoading(true);
    setError(null);
    setBigramLoading(true);
    setBigramError(null);

    Promise.all([
      fetch(KEYS_API).then((res) => {
        if (!res.ok) throw new Error(`Keys: ${res.status}`);
        return res.json();
      }),
      fetch(BIGRAMS_API).then((res) => {
        if (!res.ok) throw new Error(`Bigrams: ${res.status}`);
        return res.json();
      }),
    ])
      .then(([keysJson, bigramsJson]) => {
        setData(keysJson);
        setLoading(false);
        setBigramData(bigramsJson);
        setBigramLoading(false);
      })
      .catch((err) => {
        // If the combined fetch fails, try to set errors independently.
        // We can't easily split errors from Promise.all, so set both.
        setError(err.message);
        setLoading(false);
        setBigramError(err.message);
        setBigramLoading(false);
      });
  }

  useEffect(() => {
    fetchStats();
  }, []);

  /** Fetch practice test from backend and switch to practice mode. */
  function handlePractice() {
    setPracticeLoading(true);
    setPracticeError(null);

    fetch('http://localhost:8000/api/practice/generate?count=10&word_count=35')
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setPracticeLoading(false);
        if (json.error) {
          setPracticeError(json.error);
        } else {
          onStartPractice(json);
        }
      })
      .catch((err) => {
        setPracticeLoading(false);
        setPracticeError(err.message);
      });
  }

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

        {/* Practice button */}
        <div className="mb-8">
          <button
            onClick={handlePractice}
            disabled={practiceLoading || total_sessions === 0}
            title={total_sessions === 0 ? 'Complete at least one test first.' : undefined}
            className={`px-6 py-3 font-bold rounded-lg transition-colors text-slate-900 ${
              total_sessions === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : practiceLoading
                  ? 'bg-emerald-600 cursor-wait'
                  : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            {practiceLoading ? 'Generating...' : '🎯 Practice My Weaknesses'}
          </button>
          {practiceError && (
            <p className="text-red-400 text-sm mt-2 font-mono">
              {practiceError}
            </p>
          )}
        </div>

        {/* Keyboard heatmap */}
        <div className="mb-8">
          <KeyboardHeatmap keys={keys} />
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

        {/* ══════════════════════════════════════════════════════════
            BIGRAM ANALYSIS
           ══════════════════════════════════════════════════════════ */}

        {/* Separator */}
        <hr className="border-slate-700 my-10" />

        <h2 className="text-2xl font-bold text-slate-200 mb-6">
          Bigram Analysis
        </h2>

        {/* Bigram loading */}
        {bigramLoading && (
          <div className="flex items-center gap-3 text-slate-400 font-mono text-sm mb-8">
            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            Loading bigram data...
          </div>
        )}

        {/* Bigram error */}
        {!bigramLoading && bigramError && (
          <div className="mb-8 text-red-400 font-mono text-sm">
            Could not load bigram data: {bigramError}
          </div>
        )}

        {/* Bigram empty */}
        {!bigramLoading && !bigramError && bigramData && bigramData.bigrams.length === 0 && (
          <p className="text-slate-400 text-sm font-mono mb-8">
            Complete more typing tests to see bigram analysis
            (minimum 3 occurrences per bigram required).
          </p>
        )}

        {/* Bigram success */}
        {!bigramLoading && !bigramError && bigramData && bigramData.bigrams.length > 0 && (
          <>
            {/* Bigram chart */}
            <div className="mb-6">
              <h3 className="text-slate-200 text-lg font-bold mb-4">
                Weakest Key Transitions
              </h3>
              <BigramChart bigrams={bigramData.bigrams.slice(0, 10)} />
              {(() => {
                const worst = bigramData.bigrams[0];
                const allLatencies = bigramData.bigrams.flatMap(
                  (b) => Array(b.total_occurrences).fill(b.avg_interkey_latency_ms)
                );
                const avgLatency = allLatencies.length > 0
                  ? Math.round(allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length)
                  : 0;
                const diff = worst.avg_interkey_latency_ms - avgLatency;
                const a = worst.bigram[0] || '';
                const b = worst.bigram[1] || '';
                return (
                  <p className="text-sm text-slate-400 italic mt-3">
                    Your slowest transition is {a} → {b} at{' '}
                    {Math.round(worst.avg_interkey_latency_ms)}ms
                    {diff > 0
                      ? ` — that's ${Math.round(diff)}ms slower than your average.`
                      : '.'}{' '}
                    These two keys may share the same finger.
                  </p>
                );
              })()}
            </div>

            {/* Bigram table */}
            <div>
              <h3 className="text-slate-200 text-lg font-bold mb-4">
                All Bigrams ({bigramData.bigrams.length})
              </h3>
              <BigramTable bigrams={bigramData.bigrams} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
