import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import './PerformanceTearsheet.css';

/**
 * Build return series and equity from closed trades.
 * Period return = pnlDollar / balanceBefore (portfolio return).
 * startBalance is derived from initialBalance - totalPnL; if that is negative or
 * tiny (e.g. big profits or withdrawals), we use max(initialBalance, 1000) so
 * returns stay realistic instead of exploding (e.g. +44132% in a month).
 */
function buildReturnSeries(closedTrades, initialBalance) {
  const withDate = closedTrades.filter((t) => t.closeDate && (t.pnlDollar != null));
  const sorted = [...withDate].sort(
    (a, b) => new Date(a.closeDate) - new Date(b.closeDate)
  );
  if (sorted.length === 0) return { returnSeries: [], startBalance: initialBalance, totalPnL: 0 };

  const totalPnL = sorted.reduce((s, t) => s + (t.pnlDollar || 0), 0);
  let startBalance = initialBalance - totalPnL;
  const minSensible = Math.max(initialBalance * 0.1, 100);
  if (startBalance < minSensible) {
    startBalance = Math.max(initialBalance, 1000);
  }

  const returnSeries = [];
  let running = startBalance;

  for (const t of sorted) {
    const pnl = t.pnlDollar || 0;
    const balanceBefore = Math.max(running, 1);
    let r = balanceBefore > 0 ? pnl / balanceBefore : 0;
    r = Math.max(-2, Math.min(2, r)); // cap ±200% per trade so compounding stays realistic
    const dateStr = String(t.closeDate).slice(0, 10);
    returnSeries.push({ date: dateStr, return: r });
    running = Math.max(0, running + pnl);
  }

  return { returnSeries, startBalance, totalPnL };
}

function calculateMetrics(returnSeries) {
  const n = returnSeries.length;
  if (n === 0) {
    return {
      cumulativeReturn: null,
      annualizedReturn: null,
      annualizedVolatility: null,
      sharpeRatio: null,
      maxDrawdown: null,
      sortinoRatio: null,
    };
  }

  const cumulativeReturn =
    returnSeries.reduce((acc, r) => acc * (1 + r.return), 1) - 1;

  const first = new Date(returnSeries[0].date);
  const last = new Date(returnSeries[returnSeries.length - 1].date);
  const years = Math.max((last - first) / (365.25 * 24 * 60 * 60 * 1000), 1 / 365.25);

  const annualizedReturn = Math.pow(1 + cumulativeReturn, 1 / years) - 1;

  const avg = returnSeries.reduce((s, r) => s + r.return, 0) / n;
  const variance =
    n > 1
      ? returnSeries.reduce((s, r) => s + (r.return - avg) ** 2, 0) / (n - 1)
      : 0;
  const vol = Math.sqrt(variance);
  const periodsPerYear = n / years;
  const annualizedVolatility = vol * Math.sqrt(Math.max(periodsPerYear, 1));

  const sharpeRatio =
    annualizedVolatility > 0 ? annualizedReturn / annualizedVolatility : null;

  // Max drawdown from cumulative curve
  const cum = [1];
  returnSeries.forEach((r) => cum.push(cum[cum.length - 1] * (1 + r.return)));
  let peak = cum[0];
  let maxDrawdown = 0;
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] > peak) peak = cum[i];
    const dd = peak > 0 ? (peak - cum[i]) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const neg = returnSeries.filter((r) => r.return < 0);
  const downsideVar =
    neg.length > 0
      ? neg.reduce((s, r) => s + r.return * r.return, 0) / neg.length
      : 0;
  const downside = Math.sqrt(downsideVar);
  const annualizedDownside = downside * Math.sqrt(Math.max(periodsPerYear, 1));
  const sortinoRatio =
    annualizedDownside > 0 ? annualizedReturn / annualizedDownside : null;

  return {
    cumulativeReturn,
    annualizedReturn,
    annualizedVolatility,
    sharpeRatio,
    maxDrawdown,
    sortinoRatio,
  };
}

function buildMonthlyHeatmap(returnSeries) {
  const byYearMonth = {};

  returnSeries.forEach((r) => {
    const d = new Date(r.date);
    const y = d.getFullYear();
    const m = d.getMonth();
    if (!byYearMonth[y]) byYearMonth[y] = { monthly: Array(12).fill(null), yearly: null, cumulativeITD: null };
    if (!Array.isArray(byYearMonth[y].monthly)) byYearMonth[y].monthly = Array(12).fill(null);
    if (!byYearMonth[y].monthly[m]) byYearMonth[y].monthly[m] = [];
    byYearMonth[y].monthly[m].push(r.return);
  });

  const years = Object.keys(byYearMonth)
    .map(Number)
    .sort((a, b) => a - b);

  let itd = 1;
  years.forEach((y) => {
    let yRet = 1;
    byYearMonth[y].monthly = byYearMonth[y].monthly.map((arr) => {
      if (arr && arr.length) {
        const mRet = arr.reduce((a, r) => a * (1 + r), 1) - 1;
        yRet *= 1 + mRet;
        return mRet;
      }
      return null;
    });
    byYearMonth[y].yearly = yRet - 1;
    itd *= 1 + byYearMonth[y].yearly;
    byYearMonth[y].cumulativeITD = itd - 1;
  });

  return { byYearMonth, years };
}

function getHeatmapColor(value) {
  const themeColors = [
    '#e11d4870', // -15 and below (metallic red dark)
    '#f43f5e70', // -15 to -5 (metallic red)
    '#fb718570', // -5 to -0.25 (metallic rose)
    '#94a3b870', // -0.25 to 0.25 (neutral blue-gray)
    '#14b8a670', // 0.25 to 5 (metallic teal)
    '#2dd4bf70', // 5 to 15 (metallic teal bright)
    '#5eead470', // 15+ (metallic teal light)
  ];
  const pct = 100 * (value || 0);
  if (pct > 15) return themeColors[6];
  if (pct > 5) return themeColors[5];
  if (pct > 0.25) return themeColors[4];
  if (pct > -0.25) return themeColors[3];
  if (pct > -5) return themeColors[2];
  if (pct > -15) return themeColors[1];
  return themeColors[0];
}

function buildEquityData(returnSeries) {
  const out = [];
  let cum = 1;
  returnSeries.forEach((r) => {
    cum *= 1 + r.return;
    out.push({
      date: r.date,
      dateLabel: format(parseISO(r.date), 'MMM d'),
      value: (cum - 1) * 100,
    });
  });
  return out;
}

function buildDrawdownData(returnSeries) {
  const cum = [1];
  returnSeries.forEach((r) => cum.push(cum[cum.length - 1] * (1 + r.return)));

  const out = [];
  let peak = cum[0];
  returnSeries.forEach((r, i) => {
    const v = cum[i + 1];
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
    out.push({
      date: r.date,
      dateLabel: format(parseISO(r.date), 'MMM d'),
      value: -dd,
    });
  });
  return out;
}

function buildHistogramData(returnSeries, numBuckets = 12) {
  const pcts = returnSeries.map((r) => r.return * 100);
  if (pcts.length === 0) return [];

  const min = Math.min(...pcts);
  const max = Math.max(...pcts);
  const span = Math.max(max - min, 0.5);
  const step = span / numBuckets || 0.5;
  const buckets = {};

  for (let i = 0; i < numBuckets; i++) {
    const low = min + i * step;
    const key = low.toFixed(1);
    buckets[key] = 0;
  }

  pcts.forEach((p) => {
    let i = Math.min(Math.floor((p - min) / step), numBuckets - 1);
    i = Math.max(0, i);
    const low = min + i * step;
    const key = low.toFixed(1);
    buckets[key] = (buckets[key] || 0) + 1;
  });

  return Object.entries(buckets)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => parseFloat(a.label) - parseFloat(b.label));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PerformanceTearsheet({ closedTrades = [], initialBalance = 1000 }) {
  const { returnSeries, startBalance } = useMemo(
    () => buildReturnSeries(closedTrades, initialBalance),
    [closedTrades, initialBalance]
  );

  const metrics = useMemo(() => calculateMetrics(returnSeries), [returnSeries]);
  const { byYearMonth, years } = useMemo(
    () => buildMonthlyHeatmap(returnSeries),
    [returnSeries]
  );
  const equityData = useMemo(() => buildEquityData(returnSeries), [returnSeries]);
  const drawdownData = useMemo(() => buildDrawdownData(returnSeries), [returnSeries]);
  const histogramData = useMemo(() => buildHistogramData(returnSeries), [returnSeries]);

  const fmt = (v, isPct = false) => {
    if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
    if (isPct) return `${(v * 100).toFixed(2)}%`;
    return v.toFixed(2);
  };

  if (returnSeries.length === 0) {
    return (
      <div className="performance-tearsheet empty">
        <p>No closed trades with P&L yet. Close some trades to see performance metrics, monthly heatmap, and charts.</p>
      </div>
    );
  }

  const heatmapYears = [...years].reverse();

  return (
    <div className="performance-tearsheet">
      <h4 className="tearsheet-title">Performance Tearsheet</h4>

      <div className="tearsheet-grid">
        {/* Left: KPI table + heatmap */}
        <div className="tearsheet-left">
          <div className="kpi-table-wrap">
            <h5>Key performance metrics</h5>
            <table className="kpi-table">
              <tbody>
                <tr>
                  <td>Cumulative return</td>
                  <td className="mono">{fmt(metrics.cumulativeReturn, true)}</td>
                </tr>
                <tr>
                  <td>Annualized return</td>
                  <td className="mono">{fmt(metrics.annualizedReturn, true)}</td>
                </tr>
                <tr>
                  <td>Annualized volatility</td>
                  <td className="mono">{fmt(metrics.annualizedVolatility, true)}</td>
                </tr>
                <tr>
                  <td>Sharpe ratio</td>
                  <td className="mono">{fmt(metrics.sharpeRatio)}</td>
                </tr>
                <tr>
                  <td>Max drawdown</td>
                  <td className="mono">{fmt(metrics.maxDrawdown, true)}</td>
                </tr>
                <tr>
                  <td>Sortino ratio</td>
                  <td className="mono">{fmt(metrics.sortinoRatio)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="heatmap-wrap">
            <h5>Monthly returns heatmap</h5>
            <div className="heatmap-scroll">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    {MONTHS.map((m) => (
                      <th key={m}>{m}</th>
                    ))}
                    <th>YTD</th>
                    <th>ITD</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapYears.map((y) => {
                    const row = byYearMonth[y];
                    if (!row) return null;
                    return (
                      <tr key={y}>
                        <td className="heatmap-year">{y}</td>
                        {row.monthly.map((m, i) => (
                          <td
                            key={i}
                            className="heatmap-cell"
                            style={{ backgroundColor: m != null ? getHeatmapColor(m) : undefined }}
                          >
                            {m != null ? `${(m * 100).toFixed(2)}%` : '—'}
                          </td>
                        ))}
                        <td
                          className="heatmap-cell heatmap-ytd"
                          style={{ backgroundColor: getHeatmapColor(row.yearly) }}
                        >
                          {(row.yearly * 100).toFixed(2)}%
                        </td>
                        <td
                          className="heatmap-cell heatmap-itd"
                          style={{ backgroundColor: getHeatmapColor(row.cumulativeITD) }}
                        >
                          {(row.cumulativeITD * 100).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Charts */}
        <div className="tearsheet-right">
          <div className="tearsheet-chart">
            <h5>Cumulative return over time</h5>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={equityData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="dateLabel" stroke="var(--text-muted)" style={{ fontSize: '0.7rem' }} />
                <YAxis
                  stroke="var(--text-muted)"
                  style={{ fontSize: '0.7rem' }}
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                  formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Cumulative return']}
                  labelFormatter={(l) => l}
                />
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--accent-primary)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="tearsheet-chart">
            <h5>Drawdown over time</h5>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={drawdownData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="dateLabel" stroke="var(--text-muted)" style={{ fontSize: '0.7rem' }} />
                <YAxis
                  stroke="var(--text-muted)"
                  style={{ fontSize: '0.7rem' }}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                  formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Drawdown']}
                  labelFormatter={(l) => l}
                />
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-danger)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--color-danger)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="tearsheet-chart">
            <h5>Return distribution</h5>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={histogramData}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--text-muted)"
                  style={{ fontSize: '0.7rem' }}
                  label={{ value: 'Return (%)', position: 'insideBottom', offset: -4, style: { fill: 'var(--text-muted)', fontSize: '0.7rem' } }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  style={{ fontSize: '0.7rem' }}
                  label={{ value: 'Frequency', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: '0.7rem' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                  formatter={(v) => [v, 'Trades']}
                  labelFormatter={(l) => `Return ${l}%`}
                />
                <Bar dataKey="count" fill="var(--accent-primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
