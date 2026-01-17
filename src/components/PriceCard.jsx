import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchKlines, formatSymbolForBinance, createPriceWebSocket } from '../lib/binance';
import { getCryptoIcon } from '../lib/cryptoIcons';
import './PriceCard.css';

const TIMEFRAMES = [
  { label: '24h', value: '24h', interval: '1h', limit: 24 },
  { label: '7d', value: '7d', interval: '4h', limit: 42 },
  { label: '30d', value: '30d', interval: '1d', limit: 30 },
];

const PriceCard = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('24h');
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const initialPriceRef = useRef(null);

  const currentTimeframe = TIMEFRAMES.find(tf => tf.value === timeframe) || TIMEFRAMES[0];

  // Fetch price history
  useEffect(() => {
    if (!symbol) return;

    const loadPriceData = async () => {
      setLoading(true);
      try {
        const binanceSymbol = formatSymbolForBinance(symbol);
        const klines = await fetchKlines(binanceSymbol, currentTimeframe.interval, currentTimeframe.limit);
        
        if (klines.length > 0) {
          const prices = klines.map(k => ({
            time: k.time,
            price: k.close,
          }));
          
          setPriceData(prices);
          initialPriceRef.current = prices[0].price;
          
          const firstPrice = prices[0].price;
          const lastPrice = prices[prices.length - 1].price;
          const change = ((lastPrice - firstPrice) / firstPrice) * 100;
          setPriceChange(change);
          setCurrentPrice(lastPrice);
        }
      } catch (error) {
        console.error('Error loading price data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPriceData();
  }, [symbol, timeframe, currentTimeframe.interval, currentTimeframe.limit]);

  // Set up WebSocket for real-time updates
  useEffect(() => {
    if (!symbol || priceData.length === 0 || loading) return;

    const binanceSymbol = formatSymbolForBinance(symbol);
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const timeoutId = setTimeout(() => {
      wsRef.current = createPriceWebSocket(binanceSymbol, (newPrice) => {
        setCurrentPrice(newPrice);
        
        setPriceData(prev => {
          if (prev.length === 0) return prev;
          
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          
          updated[lastIndex] = {
            time: Date.now(),
            price: newPrice,
          };
          
          if (initialPriceRef.current) {
            const change = ((newPrice - initialPriceRef.current) / initialPriceRef.current) * 100;
            setPriceChange(change);
          }
          
          return updated;
        });
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, loading]);

  // Draw chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || priceData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (priceData.length < 2) return;

    const prices = priceData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const padding = priceRange * 0.1;
    
    const chartMin = minPrice - padding;
    const chartMax = maxPrice + padding;
    const chartRange = chartMax - chartMin;

    const isUp = priceChange >= 0;
    const chartColor = isUp ? '#10b981' : '#ef4444';

    // Draw gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isUp) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    // Draw area
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    priceData.forEach((point, index) => {
      const x = (index / (priceData.length - 1)) * width;
      const y = height - ((point.price - chartMin) / chartRange) * height;
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = chartColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    priceData.forEach((point, index) => {
      const x = (index / (priceData.length - 1)) * width;
      const y = height - ((point.price - chartMin) / chartRange) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();

    // Draw current price indicator
    if (priceData.length > 0) {
      const lastIndex = priceData.length - 1;
      const lastX = (lastIndex / (priceData.length - 1)) * width;
      const lastY = height - ((priceData[lastIndex].price - chartMin) / chartRange) * height;
      
      ctx.fillStyle = chartColor;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [priceData, priceChange]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 80;
      drawChart();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawChart]);

  const isUp = priceChange >= 0;
  const displayPrice = currentPrice !== null ? currentPrice : (priceData.length > 0 ? priceData[priceData.length - 1].price : null);
  const IconComponent = getCryptoIcon(symbol);

  return (
    <div className="price-card">
      <div className="price-card-header">
        <div className="price-card-symbol">
          {IconComponent && <IconComponent size={20} />}
          <select
            className="symbol-select"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            <option value="BTC/USDT">BTC/USDT</option>
            <option value="ETH/USDT">ETH/USDT</option>
            <option value="BNB/USDT">BNB/USDT</option>
            <option value="SOL/USDT">SOL/USDT</option>
            <option value="XRP/USDT">XRP/USDT</option>
            <option value="ADA/USDT">ADA/USDT</option>
            <option value="DOGE/USDT">DOGE/USDT</option>
            <option value="DOT/USDT">DOT/USDT</option>
            <option value="MATIC/USDT">MATIC/USDT</option>
            <option value="AVAX/USDT">AVAX/USDT</option>
          </select>
        </div>
        
        <div className="timeframe-selector">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              className={`timeframe-btn ${timeframe === tf.value ? 'active' : ''}`}
              onClick={() => setTimeframe(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="price-card-loading">Loading...</div>
      ) : displayPrice !== null ? (
        <>
          <div className="price-card-info">
            <div className="price-main-info">
              <span className="price-label">{timeframe}</span>
              <span className={`price-value ${isUp ? 'up' : 'down'}`}>
                ${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
              </span>
            </div>
            <div className={`price-change-badge ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          </div>
          
          <div ref={containerRef} className="price-card-chart">
            <canvas ref={canvasRef} className="price-card-canvas" />
          </div>
        </>
      ) : (
        <div className="price-card-empty">No data available</div>
      )}
    </div>
  );
};

export default PriceCard;
