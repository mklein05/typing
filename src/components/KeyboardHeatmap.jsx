import { useState, useCallback } from 'react';

// ─── Keyboard layout definition ────────────────────────────────────
// Each row: array of { label, keyValue, width?, isModifier? }

const ROW_1 = [
  { label: '`', keyValue: '`' },
  { label: '1', keyValue: '1' },
  { label: '2', keyValue: '2' },
  { label: '3', keyValue: '3' },
  { label: '4', keyValue: '4' },
  { label: '5', keyValue: '5' },
  { label: '6', keyValue: '6' },
  { label: '7', keyValue: '7' },
  { label: '8', keyValue: '8' },
  { label: '9', keyValue: '9' },
  { label: '0', keyValue: '0' },
  { label: '-', keyValue: '-' },
  { label: '=', keyValue: '=' },
  { label: '⌫', keyValue: null, isModifier: true, wide: 1.5 },
];

const ROW_2 = [
  { label: '⇥', keyValue: null, isModifier: true, wide: 1.5 },
  { label: 'q', keyValue: 'q' },
  { label: 'w', keyValue: 'w' },
  { label: 'e', keyValue: 'e' },
  { label: 'r', keyValue: 'r' },
  { label: 't', keyValue: 't' },
  { label: 'y', keyValue: 'y' },
  { label: 'u', keyValue: 'u' },
  { label: 'i', keyValue: 'i' },
  { label: 'o', keyValue: 'o' },
  { label: 'p', keyValue: 'p' },
  { label: '[', keyValue: '[' },
  { label: ']', keyValue: ']' },
  { label: '\\', keyValue: '\\' },
];

const ROW_3 = [
  { label: '⇪', keyValue: null, isModifier: true, wide: 1.8 },
  { label: 'a', keyValue: 'a' },
  { label: 's', keyValue: 's' },
  { label: 'd', keyValue: 'd' },
  { label: 'f', keyValue: 'f' },
  { label: 'g', keyValue: 'g' },
  { label: 'h', keyValue: 'h' },
  { label: 'j', keyValue: 'j' },
  { label: 'k', keyValue: 'k' },
  { label: 'l', keyValue: 'l' },
  { label: ';', keyValue: ';' },
  { label: "'", keyValue: "'" },
  { label: '↵', keyValue: null, isModifier: true, wide: 2 },
];

const ROW_4 = [
  { label: '⇧', keyValue: null, isModifier: true, wide: 2.2 },
  { label: 'z', keyValue: 'z' },
  { label: 'x', keyValue: 'x' },
  { label: 'c', keyValue: 'c' },
  { label: 'v', keyValue: 'v' },
  { label: 'b', keyValue: 'b' },
  { label: 'n', keyValue: 'n' },
  { label: 'm', keyValue: 'm' },
  { label: ',', keyValue: ',' },
  { label: '.', keyValue: '.' },
  { label: '/', keyValue: '/' },
  { label: '⇧', keyValue: null, isModifier: true, wide: 2.5 },
];

const ROW_5 = [
  { label: '', keyValue: ' ', labelAlt: 'space', wide: 6 },
];

const ALL_ROWS = [ROW_1, ROW_2, ROW_3, ROW_4, ROW_5];

// ─── Colour helpers ────────────────────────────────────────────────

/** Return a Tailwind bg class for the given error rate. */
function errorColor(rate) {
  if (rate == null) return 'bg-slate-700';
  if (rate <= 0) return 'bg-green-600';
  if (rate <= 2) return 'bg-green-500';
  if (rate <= 5) return 'bg-lime-500';
  if (rate <= 8) return 'bg-yellow-500';
  if (rate <= 12) return 'bg-yellow-600';
  if (rate <= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

/** Return a Tailwind bg class for the given interkey latency (ms). */
function latencyColor(lat) {
  if (lat == null) return 'bg-slate-700';
  if (lat < 80) return 'bg-green-600';
  if (lat < 110) return 'bg-green-500';
  if (lat < 140) return 'bg-yellow-500';
  if (lat < 180) return 'bg-orange-500';
  return 'bg-red-500';
}

// ─── Key component ─────────────────────────────────────────────────

function Key({ keyDef, stats, mode, onHover, onLeave }) {
  const { label, keyValue, isModifier, wide } = keyDef;
  const data = stats[keyValue];
  const width = wide ? `${wide * 2.5}rem` : '2.5rem';
  const lowSample = data && data.total < 5;

  let bgClass = 'bg-slate-700'; // default: no data / modifier
  let activeClass = '';

  if (!isModifier && data) {
    const value = mode === 'latency'
      ? data.avg_interkey_latency_ms
      : data.error_rate;

    bgClass = mode === 'latency'
      ? latencyColor(value)
      : errorColor(value);
  }

  if (lowSample) {
    activeClass = 'opacity-50';
  }

  if (isModifier) {
    bgClass = 'bg-slate-600';
    activeClass = 'text-slate-400';
  }

  const handleMouseEnter = (e) => {
    if (!isModifier && onHover) {
      const rect = e.currentTarget.getBoundingClientRect();
      onHover(keyValue, rect);
    }
  };

  return (
    <div
      className={`
        ${bgClass} ${activeClass}
        h-10 rounded-md flex items-center justify-center
        text-sm font-mono text-white cursor-default
        transition-all duration-150
        hover:brightness-125 hover:scale-105
        ${lowSample && !isModifier ? 'border border-dashed border-slate-500' : ''}
      `}
      style={{ width }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onLeave}
    >
      {label}
    </div>
  );
}

// ─── Tooltip component ─────────────────────────────────────────────

function Tooltip({ keyValue, stats, position, mode }) {
  if (!keyValue || !position) return null;

  const data = stats[keyValue];

  // Position the tooltip above the key, centred
  const style = {
    left: `${position.left + position.width / 2}px`,
    top: `${position.top - 8}px`,
    transform: 'translate(-50%, -100%)',
  };

  // Average latency across all keys for comparison
  const allKeys = Object.values(stats).filter(Boolean);
  const avgLatency = allKeys.length > 0
    ? Math.round(
        allKeys.reduce((s, k) => s + (k.avg_interkey_latency_ms || 0), 0) /
          allKeys.length
      )
    : 0;

  return (
    <div
      className="absolute z-50 pointer-events-none bg-slate-950 border border-slate-600 rounded-lg p-3 shadow-xl min-w-[160px] text-xs"
      style={style}
    >
      {!data ? (
        <p className="text-slate-400">No data yet — keep typing!</p>
      ) : (
        <>
          <p className="text-slate-200 font-bold text-sm mb-1.5">
            Key: <span className="font-mono text-white">{keyValue}</span>
          </p>
          <div className="space-y-1 text-slate-400">
            <p>
              Error rate:{' '}
              <span className="text-white font-mono">
                {data.error_rate.toFixed(1)}%
              </span>
            </p>
            <p>
              Errors:{' '}
              <span className="text-white font-mono">
                {data.errors} / {data.total}
              </span>
            </p>
            <p>
              Interkey latency:{' '}
              <span className="text-white font-mono">
                {Math.round(data.avg_interkey_latency_ms)} ms
              </span>
              {mode === 'latency' && data.avg_interkey_latency_ms > avgLatency && (
                <span className="text-orange-400">
                  {' '}— {Math.round(data.avg_interkey_latency_ms - avgLatency)}ms
                  slower than avg
                </span>
              )}
            </p>
            <p>
              Hold duration:{' '}
              <span className="text-white font-mono">
                {Math.round(data.avg_hold_duration_ms)} ms
              </span>
            </p>
            {data.total < 5 && (
              <p className="text-yellow-400 text-xs mt-1">
                ⚠ Low sample ({data.total} occurrences)
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export default function KeyboardHeatmap({ keys }) {
  const [mode, setMode] = useState('error'); // 'error' | 'latency'
  const [hoverKey, setHoverKey] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);

  // Build lookup: { "a": {...}, "b": {...}, ... }
  const statsMap = {};
  if (keys) {
    for (const k of keys) {
      statsMap[k.key] = k;
    }
  }

  const handleHover = useCallback((keyVal, rect) => {
    setHoverKey(keyVal);
    setHoverPos(rect);
  }, []);

  const handleLeave = useCallback(() => {
    setHoverKey(null);
    setHoverPos(null);
  }, []);

  // ─── No data state ──────────────────────────────────────────────
  if (!keys || keys.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl p-6 text-center">
        <h3 className="text-slate-200 text-lg font-bold mb-1">
          Keyboard Heatmap
        </h3>
        <p className="text-slate-500 text-xs mb-4">
          Hover over keys to see detailed stats. Toggle to view by error rate or latency.
        </p>

        {/* Render muted keyboard */}
        <div className="flex flex-col items-center gap-1.5">
          {ALL_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-1.5">
              {row.map((kd, ki) => (
                <div
                  key={ki}
                  className="bg-slate-700 h-10 rounded-md flex items-center justify-center text-sm font-mono text-slate-500"
                  style={{ width: kd.wide ? `${kd.wide * 2.5}rem` : '2.5rem' }}
                >
                  {kd.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-sm mt-4 font-mono">
          Complete a typing test to see your keyboard heatmap.
        </p>
      </div>
    );
  }

  // ─── Success state ───────────────────────────────────────────────
  return (
    <div className="bg-slate-900 rounded-xl p-6 relative">
      {/* Header + toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-slate-200 text-lg font-bold">
            Keyboard Heatmap
          </h3>
          <p className="text-slate-500 text-xs">
            Hover over keys to see detailed stats. Toggle to view by error rate or latency.
          </p>
        </div>

        <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setMode('error')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors ${
              mode === 'error'
                ? 'bg-yellow-500 text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Error Rate
          </button>
          <button
            onClick={() => setMode('latency')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-colors ${
              mode === 'latency'
                ? 'bg-yellow-500 text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Latency
          </button>
        </div>
      </div>

      {/* Keyboard */}
      <div className="flex flex-col items-center gap-1.5">
        {ALL_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.map((kd, ki) => (
              <Key
                key={ki}
                keyDef={kd}
                stats={statsMap}
                mode={mode}
                onHover={handleHover}
                onLeave={handleLeave}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 flex-wrap text-[10px] font-mono text-slate-400">
        {mode === 'error' ? (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-green-600" /> 0%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-green-500" /> &lt;2%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-lime-500" /> 2-5%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-yellow-500" /> 5-8%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-orange-500" /> 12-20%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-500" /> 20%+
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-green-600" /> &lt;80ms
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-green-500" /> 80-110
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-yellow-500" /> 110-140
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-orange-500" /> 140-180
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-red-500" /> 180ms+
            </span>
          </>
        )}
        <span className="text-slate-500">|</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-slate-700 border border-dashed border-slate-500" /> Low sample
        </span>
      </div>

      {/* Tooltip */}
      <Tooltip
        keyValue={hoverKey}
        stats={statsMap}
        position={hoverPos}
        mode={mode}
      />
    </div>
  );
}
