import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

/**
 * Bar colour based on error rate:
 *  - >= 10%  → red
 *  - >= 5%   → yellow
 *  - < 5%    → green
 */
function barColor(errorRate) {
  if (errorRate >= 10) return '#ef4444'; // red-500
  if (errorRate >= 5) return '#eab308';  // yellow-500
  return '#22c55e';                      // green-500
}

/**
 * Format a bigram string "er" → "e → r".
 */
function formatBigram(raw) {
  if (!raw || raw.length < 2) return raw;
  return `${raw[0]} → ${raw[1]}`;
}

/**
 * Custom tooltip for the bigram bar chart.
 */
function CustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-200 font-mono font-bold">
        {formatBigram(d.bigram)}
      </p>
      <p className="text-slate-300">Error rate: {d.error_rate}%</p>
      <p className="text-slate-400">Occurrences: {d.total_occurrences}</p>
      <p className="text-slate-400">
        Interkey latency: {Math.round(d.avg_interkey_latency_ms)}ms
      </p>
    </div>
  );
}

/**
 * Horizontal bar chart showing the 10 worst bigrams by error rate.
 */
export default function BigramChart({ bigrams }) {
  // Transform data for the chart — add a display label
  const chartData = bigrams.map((b) => ({
    ...b,
    displayLabel: formatBigram(b.bigram),
  }));

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <ResponsiveContainer width="100%" height={chartData.length * 36 + 40}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 50, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#475569' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="displayLabel"
            tick={{ fill: '#e2e8f0', fontSize: 14, fontWeight: 'bold' }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155' }} />
          <Bar
            dataKey="error_rate"
            radius={[0, 4, 4, 0]}
            label={{
              position: 'right',
              fill: '#cbd5e1',
              fontSize: 12,
              formatter: (v) => `${v}%`,
            }}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.error_rate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
