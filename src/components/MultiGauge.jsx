import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { fetch24hTickers, createAllTickersWebSocket } from '../lib/binance';
import './MultiGauge.css';

/** EMA half-life in seconds for each label. Factor = 2/(s+1). */
export const EMA_PERIODS = {
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
};

const GAUGE_CONFIG = {
  width: 36,
  height: 180,
  ledCount: 24,
  ledSpacing: 2,
  maxValue: 2.0,
};

const SYMBOLS = [
  'BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'ADA', 'TRX', 'DOGE',
  'LTC', 'XLM', 'PEPE', 'FLOKI',
];

/** Project colors for low (teal) → high (red) */
const LED_LOW = '#2dd4bf';
const LED_HIGH = '#f43f5e';

function initialVariance(open, high, low, close) {
  if (!(open > 0 && high > 0 && low > 0 && close > 0)) return 0;
  const a = Math.log(open / high) * Math.log(close / high);
  const b = Math.log(open / low) * Math.log(close / low);
  const v = 365 * (a + b);
  return Math.max(0, v);
}

const EMA_OPTIONS = Object.keys(EMA_PERIODS);

function MultiGauge() {
  const [gaugeData, setGaugeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emaPeriod, setEmaPeriod] = useState('15m');
  const stripRef = useRef(null);
  const seriesRef = useRef(Object.create(null));
  const wsRef = useRef(null);

  const movingSeconds = EMA_PERIODS[emaPeriod] ?? 900;

  // Bootstrap from 24h tickers (real Binance OHLC)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const tickers = await fetch24hTickers();
        const next = [];
        for (const base of SYMBOLS) {
          const sym = base + 'USDT';
          const t = tickers[sym];
          if (!t) continue;
          const { open: o, high: h, low: l, close: c } = t;
          const variance = initialVariance(o, h, l, c);
          const value = Math.sqrt(Math.max(0, variance));
          seriesRef.current[sym] = { variance, lastPrice: c };
          next.push({ label: base, value, symbol: sym });
        }

        next.sort((a, b) => a.label.localeCompare(b.label));
        if (!cancelled) {
          setGaugeData(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load tickers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Stream: real-time tickers from Binance WebSocket, EMA of squared log-returns
  useEffect(() => {
    if (gaugeData.length === 0) return;

    const factor = 2 / (movingSeconds + 1);
    const secPerYear = 8760 * 3600;

    wsRef.current = createAllTickersWebSocket((map) => {
      setGaugeData((prev) =>
        prev.map((d) => {
          const price = map[d.symbol];
          if (price == null) return d;
          const r = seriesRef.current[d.symbol];
          if (!r) return d;
          const prevPrice = r.lastPrice;
          const lr = Math.log(price / prevPrice);
          r.variance = factor * secPerYear * lr * lr + r.variance * (1 - factor);
          r.lastPrice = price;
          const value = Math.sqrt(Math.max(0, r.variance));
          return { ...d, value };
        })
      );
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [gaugeData.length, movingSeconds]);

  // D3: draw/update gauges
  useEffect(() => {
    const el = stripRef.current;
    if (!el || gaugeData.length === 0) return;

    const ledHeight =
      (GAUGE_CONFIG.height - (GAUGE_CONFIG.ledCount - 1) * GAUGE_CONFIG.ledSpacing) /
      GAUGE_CONFIG.ledCount;

    const colorScale = d3
      .scaleLinear()
      .domain([
        0,
        0.5 * (GAUGE_CONFIG.ledCount - 1),
        0.9 * (GAUGE_CONFIG.ledCount - 1),
        GAUGE_CONFIG.ledCount - 1,
      ])
      .range([LED_LOW, LED_LOW, LED_HIGH, LED_HIGH]);

    const sel = d3.select(el).selectAll('.multi-gauge-cell').data(gaugeData, (d) => d.label);

    const enter = sel
      .enter()
      .append('div')
      .attr('class', 'multi-gauge-container multi-gauge-cell')
      .each(function () {
        const g = d3.select(this);
        g.append('svg')
          .attr('class', 'multi-gauge-svg')
          .attr('width', GAUGE_CONFIG.width)
          .attr('height', GAUGE_CONFIG.height);
        g.append('div').attr('class', 'multi-gauge-label');
      });

    const merged = enter.merge(sel);

    merged.each(function (d) {
      const g = d3.select(this);
      const svg = g.select('.multi-gauge-svg');
      let rects = svg.selectAll('rect');

      if (rects.empty()) {
        rects = svg
          .selectAll('rect')
          .data(d3.range(GAUGE_CONFIG.ledCount))
          .enter()
          .append('rect')
          .attr('x', 0)
          .attr('y', (i) =>
            GAUGE_CONFIG.height - (i + 1) * (ledHeight + GAUGE_CONFIG.ledSpacing)
          )
          .attr('width', GAUGE_CONFIG.width)
          .attr('height', ledHeight)
          .attr('fill', (i) => colorScale(i))
          .attr('opacity', 0.2);
      }

      const litCount = Math.round(
        Math.tanh(d.value / GAUGE_CONFIG.maxValue) * GAUGE_CONFIG.ledCount
      );
      rects.attr('opacity', (_, i) => (i < litCount ? 1 : 0.2));

      const label = g.select('.multi-gauge-label');
      label.selectAll('*').remove();
      label
        .append('div')
        .attr('class', 'multi-gauge-value')
        .text(`${(d.value * 100).toFixed(1)}%`);
      label
        .append('div')
        .attr('class', 'multi-gauge-symbol')
        .text(d.label);
    });

    sel.exit().remove();
  }, [gaugeData]);

  const headerBlock = (
    <div className="multi-gauge-header">
      <div>
        <div className="multi-gauge-title">EMA Volatility (annualized)</div>
        <div className="multi-gauge-subtitle">Log-return variance, EMA-smoothed from live ticks</div>
      </div>
      <div className="multi-gauge-period">
        {EMA_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            className={`multi-gauge-period-btn ${emaPeriod === p ? 'active' : ''}`}
            onClick={() => setEmaPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="multi-gauge">
        {headerBlock}
        <div className="multi-gauge-loading">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="multi-gauge">
        {headerBlock}
        <div className="multi-gauge-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="multi-gauge">
      {headerBlock}
      <div className="multi-gauge-strip" ref={stripRef} />
    </div>
  );
}

export default MultiGauge;
