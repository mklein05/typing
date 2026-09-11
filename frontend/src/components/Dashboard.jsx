import { useEffect, useState } from 'react';
import KeyStatsChart from './KeyStatsChart';
import KeyStatsTable from './KeyStatsTable';
import BigramChart from './BigramChart';
import BigramTable from './BigramTable';
import KeyboardHeatmap from './KeyboardHeatmap';
import { apiFetch } from '../api';

const KEYS_API = '/api/stats/keys';
const BIGRAMS_API = '/api/stats/bigrams';

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

  const [keysExpanded, setKeysExpanded] = useState(false);
  const [bigramsExpanded, setBigramsExpanded] = useState(false);

  /** Fetch both key stats and bigrams in parallel. */
  function fetchStats() {
    setLoading(true);
    setError(null);
    setBigramLoading(true);
    setBigramError(null);

    Promise.all([
      apiFetch(KEYS_API).then((res) => {
        if (!res.ok) throw new Error(`Keys: ${res.status}`);
        return res.json();
      }),
      apiFetch(BIGRAMS_API).then((res) => {
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

    apiFetch('/api/practice/generate?count=10&word_count=35')
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
      <div className="min-h-screen theme-app flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="theme-text-muted text-sm font-mono">Loading stats...</p>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen theme-app flex flex-col items-center justify-center gap-4">
        <p className="theme-danger font-mono">Failed to load stats: {error}</p>
        <button
          onClick={fetchStats}
          className="px-6 py-2 theme-accent font-bold rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Empty state (no sessions) ──────────────────────────────────
  if (!data || data.total_sessions === 0) {
    return (
      <div className="min-h-screen theme-app flex flex-col items-center justify-center gap-6">
        <p className="theme-text-muted text-lg font-mono">
          Complete a typing test to see your stats
        </p>
        <button
          onClick={onBackToTest}
          className="px-6 py-2 theme-accent font-bold rounded-lg transition-colors"
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
    <div className="min-h-screen theme-app px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Practice button */}
        <div className="mb-8">
          <button
            onClick={handlePractice}
            disabled={practiceLoading || total_sessions === 0}
            title={total_sessions === 0 ? 'Complete at least one test first.' : undefined}
            className={`px-6 py-3 font-bold rounded-lg transition-colors text-slate-900 ${
              total_sessions === 0
                ? 'theme-panel-muted theme-text-subtle cursor-not-allowed'
                : practiceLoading
                  ? 'theme-success cursor-wait'
                  : 'theme-success'
            }`}
          >
            {practiceLoading ? 'Generating...' : 'Practice My Weaknesses'}
          </button>
          {practiceError && (
            <p className="theme-danger text-sm mt-2 font-mono">
              {practiceError}
            </p>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="theme-panel rounded-lg p-5">
            <p className="theme-text-muted text-sm font-mono mb-1">Total Sessions</p>
            <p className="text-3xl font-bold theme-accent-text">{total_sessions}</p>
          </div>
          <div className="theme-panel rounded-lg p-5">
            <p className="theme-text-muted text-sm font-mono mb-1">Keystrokes</p>
            <p className="text-3xl font-bold theme-accent-text">
              {total_keystrokes_analysed}
            </p>
          </div>
          <div className="theme-panel rounded-lg p-5">
            <p className="theme-text-muted text-sm font-mono mb-1">Accuracy</p>
            <p className="text-3xl font-bold text-green-400">
              {overallAccuracy}%
            </p>
          </div>
          <div className="theme-panel rounded-lg p-5">
            <p className="theme-text-muted text-sm font-mono mb-1">Worst Key</p>
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

        {/* Full table — collapsible */}
        <div className="mb-8">
          <button
            onClick={() => setKeysExpanded(prev => !prev)}
            className="flex items-center gap-3 w-full text-left group"
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-md bg-slate-800 group-hover:bg-slate-700 transition-colors shrink-0`}>
              <svg
                className={`w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-transform duration-200 ${keysExpanded ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
            <span className="text-slate-200 text-lg font-bold group-hover:text-amber-400 transition-colors">
              All Keys ({keys.length})
            </span>
            <span className="text-slate-600 text-xs font-mono ml-auto">
              {keysExpanded ? 'Collapse' : 'Expand'}
            </span>
          </button>
          {keysExpanded && <div className="mt-3"><KeyStatsTable keys={keys} /></div>}
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
            <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
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
            </div>

            {/* Bigram table — collapsible */}
            <div>
              <button
                onClick={() => setBigramsExpanded(prev => !prev)}
                className="flex items-center gap-3 w-full text-left group"
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-md bg-slate-800 group-hover:bg-slate-700 transition-colors shrink-0`}>
                  <svg
                    className={`w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-transform duration-200 ${bigramsExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
                <span className="text-slate-200 text-lg font-bold group-hover:text-amber-400 transition-colors">
                  All Bigrams ({bigramData.bigrams.length})
                </span>
                <span className="text-slate-600 text-xs font-mono ml-auto">
                  {bigramsExpanded ? 'Collapse' : 'Expand'}
                </span>
              </button>
              {bigramsExpanded && <div className="mt-3"><BigramTable bigrams={bigramData.bigrams} /></div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
