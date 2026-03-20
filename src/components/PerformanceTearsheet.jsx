import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { StatHistogramChart, StatLineChart } from './StatCharts';
import './PerformanceTearsheet.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildReturnSeries(closedTrades, initialBalance) {
  const datedTrades = closedTrades
    .filter((trade) => trade.closeDate && trade.pnlDollar != null)
    .sort((a, b) => new Date(a.closeDate) - new Date(b.closeDate));

  if (datedTrades.length === 0) {
    return [];
  }

  const totalPnL = datedTrades.reduce((sum, trade) => sum + (trade.pnlDollar || 0), 0);
  let runningBalance = Math.max(initialBalance - totalPnL, Math.max(initialBalance * 0.1, 100));

  return datedTrades.map((trade) => {
    const pnl = trade.pnlDollar || 0;
    const balanceBefore = Math.max(runningBalance, 1);
    const cappedReturn = Math.max(-2, Math.min(2, pnl / balanceBefore));

    runningBalance = Math.max(0, runningBalance + pnl);

    return {
      date: String(trade.closeDate).slice(0, 10),
      return: cappedReturn,
    };
  });
}

function calculateMetrics(returnSeries) {
  const count = returnSeries.length;
  if (count === 0) {
    return {
      cumulativeReturn: null,
      annualizedReturn: null,
      annualizedVolatility: null,
      sharpeRatio: null,
      maxDrawdown: null,
      sortinoRatio: null,
    };
  }

  const cumulativeReturn = returnSeries.reduce((acc, item) => acc * (1 + item.return), 1) - 1;
  const first = new Date(returnSeries[0].date);
  const last = new Date(returnSeries[returnSeries.length - 1].date);
  const years = Math.max((last - first) / (365.25 * 24 * 60 * 60 * 1000), 1 / 365.25);
  const annualizedReturn = Math.pow(1 + cumulativeReturn, 1 / years) - 1;

  const averageReturn = returnSeries.reduce((sum, item) => sum + item.return, 0) / count;
  const variance =
    count > 1
      ? returnSeries.reduce((sum, item) => sum + (item.return - averageReturn) ** 2, 0) / (count - 1)
      : 0;
  const periodsPerYear = count / years;
  const annualizedVolatility = Math.sqrt(variance) * Math.sqrt(Math.max(periodsPerYear, 1));
  const sharpeRatio = annualizedVolatility > 0 ? annualizedReturn / annualizedVolatility : null;

  const cumulativeCurve = [1];
  returnSeries.forEach((item) => {
    cumulativeCurve.push(cumulativeCurve[cumulativeCurve.length - 1] * (1 + item.return));
  });

  let peak = cumulativeCurve[0];
  let maxDrawdown = 0;
  for (let index = 1; index < cumulativeCurve.length; index += 1) {
    peak = Math.max(peak, cumulativeCurve[index]);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - cumulativeCurve[index]) / peak : 0);
  }

  const negativeReturns = returnSeries.filter((item) => item.return < 0);
  const downsideVariance =
    negativeReturns.length > 0
      ? negativeReturns.reduce((sum, item) => sum + item.return * item.return, 0) / negativeReturns.length
      : 0;
  const annualizedDownside = Math.sqrt(downsideVariance) * Math.sqrt(Math.max(periodsPerYear, 1));
  const sortinoRatio = annualizedDownside > 0 ? annualizedReturn / annualizedDownside : null;

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
  const grouped = {};

  returnSeries.forEach((item) => {
    const date = new Date(item.date);
    const year = date.getFullYear();
    const month = date.getMonth();

    if (!grouped[year]) {
      grouped[year] = { monthly: Array(12).fill(null), yearly: null, cumulativeITD: null };
    }

    if (!grouped[year].monthly[month]) {
      grouped[year].monthly[month] = [];
    }

    grouped[year].monthly[month].push(item.return);
  });

  const years = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  let cumulativeITD = 1;
  years.forEach((year) => {
    let yearlyReturn = 1;

    grouped[year].monthly = grouped[year].monthly.map((monthReturns) => {
      if (!monthReturns || monthReturns.length === 0) {
        return null;
      }

      const monthReturn = monthReturns.reduce((acc, item) => acc * (1 + item), 1) - 1;
      yearlyReturn *= 1 + monthReturn;
      return monthReturn;
    });

    grouped[year].yearly = yearlyReturn - 1;
    cumulativeITD *= 1 + grouped[year].yearly;
    grouped[year].cumulativeITD = cumulativeITD - 1;
  });

  return { grouped, years };
}

function buildEquityData(returnSeries) {
  let cumulative = 1;

  return returnSeries.map((item) => {
    cumulative *= 1 + item.return;

    return {
      dateLabel: format(parseISO(item.date), 'MMM d'),
      value: (cumulative - 1) * 100,
    };
  });
}

function buildDrawdownData(returnSeries) {
  let cumulative = 1;
  let peak = 1;

  return returnSeries.map((item) => {
    cumulative *= 1 + item.return;
    peak = Math.max(peak, cumulative);

    return {
      dateLabel: format(parseISO(item.date), 'MMM d'),
      value: peak > 0 ? -((peak - cumulative) / peak) * 100 : 0,
    };
  });
}

function buildHistogramData(returnSeries, bucketsCount = 12) {
  const returns = returnSeries.map((item) => item.return * 100);
  if (returns.length === 0) {
    return [];
  }

  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const span = Math.max(max - min, 0.5);
  const step = span / bucketsCount || 0.5;
  const buckets = {};

  for (let index = 0; index < bucketsCount; index += 1) {
    const low = min + index * step;
    buckets[low.toFixed(1)] = 0;
  }

  returns.forEach((value) => {
    const bucketIndex = Math.max(0, Math.min(Math.floor((value - min) / step), bucketsCount - 1));
    const low = min + bucketIndex * step;
    const label = low.toFixed(1);
    buckets[label] += 1;
  });

  return Object.entries(buckets)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => parseFloat(a.label) - parseFloat(b.label));
}

function getHeatmapColor(value) {
  const pct = 100 * (value || 0);
  if (pct > 15) return '#5eead470';
  if (pct > 5) return '#2dd4bf70';
  if (pct > 0.25) return '#14b8a670';
  if (pct > -0.25) return '#94a3b870';
  if (pct > -5) return '#fb718570';
  if (pct > -15) return '#f43f5e70';
  return '#e11d4870';
}

function formatMetric(value, isPercent = false) {
  if (value == null || Number.isNaN(value)) {
    return 'N/A';
  }

  return isPercent ? `${(value * 100).toFixed(2)}%` : value.toFixed(2);
}

function formatSignedPercent(value) {
  if (value == null || Number.isNaN(value)) {
    return 'N/A';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function PerformanceTearsheet({ closedTrades = [], initialBalance = 1000 }) {
  const returnSeries = useMemo(
    () => buildReturnSeries(closedTrades, initialBalance),
    [closedTrades, initialBalance]
  );
  const metrics = useMemo(() => calculateMetrics(returnSeries), [returnSeries]);
  const { grouped, years } = useMemo(() => buildMonthlyHeatmap(returnSeries), [returnSeries]);
  const equityData = useMemo(() => buildEquityData(returnSeries), [returnSeries]);
  const drawdownData = useMemo(() => buildDrawdownData(returnSeries), [returnSeries]);
  const histogramData = useMemo(() => buildHistogramData(returnSeries), [returnSeries]);

  if (returnSeries.length === 0) {
    return (
      <div className="performance-tearsheet empty">
        <p>No closed trades with P&amp;L yet. Close some trades to unlock the tearsheet.</p>
      </div>
    );
  }

  const heatmapYears = [...years].reverse();
  const latestEquity = equityData[equityData.length - 1]?.value ?? 0;
  const bestEquity = equityData.length > 0 ? Math.max(...equityData.map((item) => item.value)) : 0;
  const latestDrawdown = drawdownData[drawdownData.length - 1]?.value ?? 0;
  const worstDrawdown =
    drawdownData.length > 0 ? Math.min(...drawdownData.map((item) => item.value)) : 0;
  const returnPctSeries = returnSeries.map((item) => item.return * 100);
  const bestReturn = returnPctSeries.length > 0 ? Math.max(...returnPctSeries) : 0;
  const worstReturn = returnPctSeries.length > 0 ? Math.min(...returnPctSeries) : 0;

  return (
    <div className="performance-tearsheet">
      <h4 className="tearsheet-title">Performance Tearsheet</h4>

      <div className="tearsheet-grid">
        <div className="tearsheet-left">
          <div className="kpi-table-wrap">
            <h5>Key performance metrics</h5>
            <table className="kpi-table">
              <tbody>
                <tr>
                  <td>Cumulative return</td>
                  <td className="mono">{formatMetric(metrics.cumulativeReturn, true)}</td>
                </tr>
                <tr>
                  <td>Annualized return</td>
                  <td className="mono">{formatMetric(metrics.annualizedReturn, true)}</td>
                </tr>
                <tr>
                  <td>Annualized volatility</td>
                  <td className="mono">{formatMetric(metrics.annualizedVolatility, true)}</td>
                </tr>
                <tr>
                  <td>Sharpe ratio</td>
                  <td className="mono">{formatMetric(metrics.sharpeRatio)}</td>
                </tr>
                <tr>
                  <td>Max drawdown</td>
                  <td className="mono">{formatMetric(metrics.maxDrawdown, true)}</td>
                </tr>
                <tr>
                  <td>Sortino ratio</td>
                  <td className="mono">{formatMetric(metrics.sortinoRatio)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="tearsheet-chart">
            <h5>Return distribution</h5>
            <div className="stat-chart-meta">
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Best Trade</span>
                <span className="stat-chart-metric-value positive">
                  {formatSignedPercent(bestReturn)}
                </span>
              </div>
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Worst Trade</span>
                <span className="stat-chart-metric-value negative">
                  {formatSignedPercent(worstReturn)}
                </span>
              </div>
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Buckets</span>
                <span className="stat-chart-metric-value">{histogramData.length}</span>
              </div>
            </div>
            <StatHistogramChart data={histogramData} valueKey="count" labelKey="label" height={200} />
          </div>

          <div className="heatmap-wrap">
            <h5>Monthly returns heatmap</h5>
            <div className="heatmap-scroll">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    {MONTHS.map((month) => (
                      <th key={month}>{month}</th>
                    ))}
                    <th>YTD</th>
                    <th>ITD</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapYears.map((year) => {
                    const row = grouped[year];
                    if (!row) {
                      return null;
                    }

                    return (
                      <tr key={year}>
                        <td className="heatmap-year">{year}</td>
                        {row.monthly.map((monthValue, index) => (
                          <td
                            key={`${year}-${index}`}
                            className="heatmap-cell"
                            style={{
                              backgroundColor:
                                monthValue != null ? getHeatmapColor(monthValue) : undefined,
                            }}
                          >
                            {monthValue != null ? `${(monthValue * 100).toFixed(2)}%` : '--'}
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

        <div className="tearsheet-right">
          <div className="tearsheet-chart">
            <h5>Cumulative return over time</h5>
            <div className="stat-chart-meta">
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Latest</span>
                <span
                  className={`stat-chart-metric-value ${latestEquity >= 0 ? 'positive' : 'negative'}`}
                >
                  {formatSignedPercent(latestEquity)}
                </span>
              </div>
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Peak</span>
                <span className="stat-chart-metric-value positive">
                  {formatSignedPercent(bestEquity)}
                </span>
              </div>
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Trades</span>
                <span className="stat-chart-metric-value">{returnSeries.length}</span>
              </div>
            </div>
            <StatLineChart
              data={equityData}
              valueKey="value"
              labelKey="dateLabel"
              color={latestEquity >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
              area
              height={220}
              includeZero
            />
          </div>

          <div className="tearsheet-chart">
            <h5>Drawdown over time</h5>
            <div className="stat-chart-meta">
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Worst</span>
                <span className="stat-chart-metric-value negative">
                  {formatSignedPercent(worstDrawdown)}
                </span>
              </div>
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Latest</span>
                <span
                  className={`stat-chart-metric-value ${latestDrawdown < 0 ? 'negative' : 'positive'}`}
                >
                  {formatSignedPercent(latestDrawdown)}
                </span>
              </div>
              <div className="stat-chart-metric">
                <span className="stat-chart-metric-label">Status</span>
                <span className="stat-chart-metric-value">
                  {latestDrawdown === 0 ? 'Recovered' : 'In Drawdown'}
                </span>
              </div>
            </div>
            <StatLineChart
              data={drawdownData}
              valueKey="value"
              labelKey="dateLabel"
              color="var(--color-danger)"
              height={220}
              includeZero
            />
          </div>

        </div>
      </div>
    </div>
  );
}
