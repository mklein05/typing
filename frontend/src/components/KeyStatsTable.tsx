import { useState } from 'react';
import type { KeyStat } from '../types';

const COLUMNS: Array<{ key: keyof KeyStat; label: string }> = [
  { key: 'key', label: 'Key' },
  { key: 'total', label: 'Occurrences' },
  { key: 'errors', label: 'Errors' },
  { key: 'error_rate', label: 'Error Rate' },
  { key: 'avg_interkey_latency_ms', label: 'Interkey Latency' },
  { key: 'avg_hold_duration_ms', label: 'Hold Duration' },
];

/**
 * Format a cell value based on the column key.
 */
function formatCell(key: keyof KeyStat, value: KeyStat[keyof KeyStat]): string | number {
  if (key === 'error_rate') return `${Number(value).toFixed(1)}%`;
  if (key === 'avg_interkey_latency_ms') return `${Math.round(Number(value))} ms`;
  if (key === 'avg_hold_duration_ms') return `${Math.round(Number(value))} ms`;
  if (key === 'key') return String(value);
  return value;
}

export default function KeyStatsTable({ keys }: { keys: KeyStat[] }) {
  const [sortCol, setSortCol] = useState<keyof KeyStat>('error_rate');
  const [sortAsc, setSortAsc] = useState(false); // default: error_rate desc

  /** Toggle sort on a column click */
  function handleSort(colKey: keyof KeyStat) {
    if (sortCol === colKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(colKey);
      setSortAsc(colKey !== 'error_rate'); // default asc for others
    }
  }

  const sorted = [...keys].sort((a, b) => {
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-slate-700 text-slate-300 font-mono text-xs uppercase">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 cursor-pointer select-none hover:bg-slate-600 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortCol === col.key && (
                      <span className="text-amber-400">
                        {sortAsc ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.key}
                className={
                  i % 2 === 0
                    ? 'bg-slate-800/50'
                    : 'bg-slate-900/50'
                }
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 font-mono ${
                      col.key === 'key'
                        ? 'text-slate-200 font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {formatCell(col.key, row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
