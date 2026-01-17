import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchKlines, formatSymbolForBinance, createPriceWebSocket } from '../lib/binance';
import './PriceChart.css';

const PriceChart = ({ symbol, height = 150 }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const initialPriceRef = useRef(null);

  // Fetch 24h price history
  useEffect(() => {
    if (!symbol) return;

    const loadPriceData = async () => {
      setLoading(true);
      try {
        const binanceSymbol = formatSymbolForBinance(symbol);
        // Fetch 1h candles for last 24 hours
        const klines = await fetchKlines(binanceSymbol, '1h', 24);
        
        if (klines.length > 0) {
          // Extract close prices
          const prices = klines.map(k => ({
            time: k.time,
            price: k.close,
          }));
          
          setPriceData(prices);
          
          // Store initial price for 24h change calculation
          initialPriceRef.current = prices[0].price;
          
          // Calculate price change
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
  }, [symbol]);

  // Set up WebSocket for real-time price updates
  useEffect(() => {
    if (!symbol || priceData.length === 0 || loading) return;

    const binanceSymbol = formatSymbolForBinance(symbol);
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Small delay to ensure priceData is set
    const timeoutId = setTimeout(() => {
      wsRef.current = createPriceWebSocket(binanceSymbol, (newPrice) => {
        // Update current price immediately
        setCurrentPrice(prev => {
          // Force update even if price is the same (for display refresh)
          return newPrice;
        });
        
        // Update the last data point with new price in real-time
        setPriceData(prev => {
          if (prev.length === 0) return prev;
          
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          
          // Update last price point with current time for real-time feel
          updated[lastIndex] = {
            time: Date.now(), // Use current time for real-time updates
            price: newPrice,
          };
          
          // Recalculate 24h change based on initial price
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
  }, [symbol, loading]); // Only depend on symbol and loading, not priceData.length

  // Draw chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || priceData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (priceData.length < 2) return;

    // Calculate price range
    const prices = priceData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const padding = priceRange * 0.1; // 10% padding
    
    const chartMin = minPrice - padding;
    const chartMax = maxPrice + padding;
    const chartRange = chartMax - chartMin;

    // Determine color based on price change
    const isUp = priceChange >= 0;
    const chartColor = isUp ? '#10b981' : '#ef4444'; // Green or Red

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isUp) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    // Draw area under line
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
      
      // Draw dot
      ctx.fillStyle = chartColor;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw outer ring
      ctx.strokeStyle = chartColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [priceData, priceChange]);

  // Redraw on data changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = height;
      drawChart();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [height, drawChart]);

  if (!symbol) {
    return null;
  }

  if (loading) {
    return (
      <div className="price-chart-container loading">
        <div className="chart-loading">Loading...</div>
      </div>
    );
  }

  if (priceData.length === 0) {
    return (
      <div className="price-chart-container empty">
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  const isUp = priceChange >= 0;
  // Use currentPrice if available, otherwise use last price from data
  const displayPrice = currentPrice !== null ? currentPrice : (priceData.length > 0 ? priceData[priceData.length - 1].price : null);

  return (
    <div ref={containerRef} className="price-chart-container">
      <div className="price-info">
        <div className="price-main">
          <span className="price-label">24h</span>
          {displayPrice !== null && (
            <span className={`price-value ${isUp ? 'up' : 'down'}`}>
              ${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </span>
          )}
        </div>
        <div className={`price-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '+' : ''}{priceChange.toFixed(2)}%
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="price-chart-canvas"
      />
    </div>
  );
};

export default PriceChart;
