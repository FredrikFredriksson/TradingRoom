import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { fetchKlines, formatSymbolForBinance } from '../lib/binance';
import './TradePositionChart.css';

const TradePositionChart = ({ 
  symbol, 
  entryPrice, 
  stopLoss, 
  takeProfit, 
  type = 'long',
  height = 380 
}) => {
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch price data
  useEffect(() => {
    if (!symbol) return;

    const loadPriceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const binanceSymbol = formatSymbolForBinance(symbol);
        // Fetch 24h of 1h candles
        const klines = await fetchKlines(binanceSymbol, '1h', 24);
        
        if (klines && klines.length > 0) {
          // Transform to chart data format
          const data = klines.map(k => ({
            time: new Date(k.time).getTime(),
            price: k.close,
            timestamp: new Date(k.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          }));
          
          setPriceData(data);
        } else {
          setError('No chart data available');
          setPriceData([]);
        }
      } catch (err) {
        console.error('Error loading price data:', err);
        setError('Failed to load chart data');
        setPriceData([]);
      } finally {
        setLoading(false);
      }
    };

    loadPriceData();
  }, [symbol]);

  // Calculate Y-axis domain to include all price levels with minimal padding for dramatic effect
  const yAxisDomain = useMemo(() => {
    if (!priceData || priceData.length === 0) {
      // Fallback to entry/SL/TP if no price data
      const levels = [entryPrice, stopLoss, takeProfit].filter(Boolean);
      if (levels.length === 0) return [0, 1];
      const min = Math.min(...levels);
      const max = Math.max(...levels);
      const range = max - min || max * 0.1;
      const padding = Math.max(range * 0.02, max * 0.001);
      return [min - padding, max + padding];
    }
    
    const prices = priceData.map(d => d.price);
    const allLevels = [
      ...prices,
      entryPrice,
      stopLoss,
      takeProfit
    ].filter(Boolean);
    
    if (allLevels.length === 0) return [0, 1];
    
    const minPrice = Math.min(...allLevels);
    const maxPrice = Math.max(...allLevels);
    const range = maxPrice - minPrice;
    // Use minimal padding (2-3%) to make price movements appear more dramatic
    const minPadding = range > 0 ? range * 0.02 : maxPrice * 0.001;
    const padding = Math.max(minPadding, range * 0.03);
    
    return [minPrice - padding, maxPrice + padding];
  }, [priceData, entryPrice, stopLoss, takeProfit]);

  // Determine chart color based on position type
  const chartColor = type === 'long' ? '#2dd4bf' : '#f43f5e';

  if (loading) {
    return (
      <div className="trade-position-chart loading">
        <div className="chart-loading">Loading chart...</div>
      </div>
    );
  }

  if (error || !priceData || priceData.length === 0) {
    return (
      <div className="trade-position-chart error">
        <div className="chart-error">{error || 'Chart data unavailable'}</div>
      </div>
    );
  }

  return (
    <div className="trade-position-chart" style={{ height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={priceData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <defs>
            <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 211, 238, 0.1)" />
          <XAxis 
            dataKey="timestamp"
            stroke="var(--text-muted)"
            style={{ fontSize: '0.7rem' }}
            tick={{ fill: 'var(--text-muted)' }}
            interval="preserveStartEnd"
            tickCount={6}
          />
          <YAxis 
            domain={yAxisDomain}
            stroke="var(--text-muted)"
            style={{ fontSize: '0.7rem' }}
            tick={{ fill: 'var(--text-muted)' }}
            tickFormatter={(value) => {
              // Format price based on magnitude
              if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
              if (value >= 1) return `$${value.toFixed(2)}`;
              return `$${value.toFixed(4)}`;
            }}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
            }}
            labelStyle={{ color: 'var(--text-primary)', fontSize: '0.7rem' }}
            formatter={(value) => [`$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`, 'Price']}
          />
          
          {/* Price area */}
          <Area
            type="monotone"
            dataKey="price"
            stroke={chartColor}
            strokeWidth={2.5}
            fill={`url(#gradient-${type})`}
          />
          
          {/* Entry price line */}
          <ReferenceLine
            y={entryPrice}
            stroke="var(--accent-primary)"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            opacity={0.9}
          />
          
          {/* Stop Loss line */}
          <ReferenceLine
            y={stopLoss}
            stroke="var(--color-danger)"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            opacity={0.9}
          />
          
          {/* Take Profit line (if exists) */}
          {takeProfit && (
            <ReferenceLine
              y={takeProfit}
              stroke="var(--color-success)"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              opacity={0.9}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TradePositionChart;
