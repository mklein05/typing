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
 * Custom tooltip for the bar chart.
 */
function CustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-200 font-mono font-bold">{d.key}</p>
      <p className="text-slate-300">Error rate: {d.error_rate}%</p>
      <p className="text-slate-400">Occurrences: {d.total}</p>
    </div>
  );
}

export default function KeyStatsChart({ keys }) {
  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-slate-200 text-lg font-bold mb-4">
        Top 10 Worst Keys
      </h3>
      <ResponsiveContainer width="100%" height={keys.length * 36 + 40}>
        <BarChart
          data={keys}
          layout="vertical"
          margin={{ top: 0, right: 30, left: 30, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fill: '#9BB291', fontSize: 12 }}
            axisLine={{ stroke: '#35503F' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="key"
            tick={{ fill: '#D9FFF8', fontSize: 14, fontWeight: 'bold' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#22402F' }} />
          <Bar
            dataKey="error_rate"
            radius={[0, 0, 0, 0]}
            label={{
              position: 'right',
              fill: '#C4F4C7',
              fontSize: 12,
              formatter: (v) => `${v}%`,
            }}
          >
            {keys.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.error_rate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
