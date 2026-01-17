import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  BarChart3 
} from 'lucide-react';
import { fetchKlines, createKlineWebSocket, formatSymbolForBinance } from '../lib/binance';
import './CandlestickChart.css';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const CandlestickChart = ({ symbol, height = 500 }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  
  const [klines, setKlines] = useState([]);
  const [timeframe, setTimeframe] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Chart dimensions and padding
  const padding = { top: 20, right: 80, bottom: 60, left: 80 };
  const volumeHeight = 100;
  const chartHeight = height - volumeHeight - padding.top - padding.bottom;

  // Fetch historical klines
  useEffect(() => {
    if (!symbol) return;

    const loadKlines = async () => {
      setLoading(true);
      setError(null);
      try {
        const binanceSymbol = formatSymbolForBinance(symbol);
        const data = await fetchKlines(binanceSymbol, timeframe, 500);
        setKlines(data);
        setPan(0); // Reset pan when timeframe changes
        setZoom(1); // Reset zoom when timeframe changes
      } catch (err) {
        setError('Failed to load chart data');
        console.error('Error loading klines:', err);
      } finally {
        setLoading(false);
      }
    };

    loadKlines();
  }, [symbol, timeframe]);

  // Set up WebSocket for real-time updates
  useEffect(() => {
    if (!symbol || klines.length === 0) return;

    const binanceSymbol = formatSymbolForBinance(symbol);
    
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    wsRef.current = createKlineWebSocket(binanceSymbol, timeframe, (newKline) => {
      setKlines(prev => {
        if (prev.length === 0) return prev;
        
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        
        if (newKline.isClosed) {
          // Replace last kline with new closed one
          if (updated[lastIndex]) {
            updated[lastIndex] = newKline;
          }
        } else {
          // Update current (last) kline in real-time
          if (updated[lastIndex]) {
            updated[lastIndex] = {
              ...updated[lastIndex],
              high: Math.max(updated[lastIndex].high, newKline.high),
              low: Math.min(updated[lastIndex].low, newKline.low),
              close: newKline.close,
              volume: newKline.volume,
            };
          }
        }
        
        return updated;
      });
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, timeframe, klines.length]);

  // Calculate visible klines based on zoom and pan
  const visibleKlines = useCallback(() => {
    const totalKlines = klines.length;
    const visibleCount = Math.floor(totalKlines / zoom);
    const startIndex = Math.max(0, Math.min(pan, totalKlines - visibleCount));
    const endIndex = Math.min(startIndex + visibleCount, totalKlines);
    return klines.slice(startIndex, endIndex);
  }, [klines, zoom, pan]);

  // Calculate price range
  const priceRange = useCallback(() => {
    const visible = visibleKlines();
    if (visible.length === 0) return { min: 0, max: 0 };
    
    const highs = visible.map(k => k.high);
    const lows = visible.map(k => k.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.1; // 10% padding
    
    return {
      min: min - padding,
      max: max + padding,
    };
  }, [visibleKlines]);

  // Calculate volume range
  const volumeRange = useCallback(() => {
    const visible = visibleKlines();
    if (visible.length === 0) return { min: 0, max: 0 };
    
    const volumes = visible.map(k => k.volume);
    return {
      min: 0,
      max: Math.max(...volumes),
    };
  }, [visibleKlines]);

  // Draw chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || klines.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const visible = visibleKlines();
    if (visible.length === 0) return;

    const price = priceRange();
    const volume = volumeRange();
    const chartAreaHeight = chartHeight;
    const volumeAreaHeight = volumeHeight;
    
    const candleWidth = (width - padding.left - padding.right) / visible.length;
    const priceScale = chartAreaHeight / (price.max - price.min);
    const volumeScale = volumeAreaHeight / (volume.max || 1);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines (price)
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const y = padding.top + (chartAreaHeight / priceSteps) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw volume bars
    visible.forEach((kline, index) => {
      const x = padding.left + index * candleWidth;
      const barHeight = kline.volume * volumeScale;
      const y = padding.top + chartAreaHeight + volumeAreaHeight - barHeight;
      
      ctx.fillStyle = kline.close >= kline.open 
        ? 'rgba(16, 185, 129, 0.3)' 
        : 'rgba(239, 68, 68, 0.3)';
      ctx.fillRect(x, y, candleWidth * 0.8, barHeight);
    });

    // Draw candlesticks
    visible.forEach((kline, index) => {
      const x = padding.left + index * candleWidth + candleWidth / 2;
      const openY = padding.top + chartAreaHeight - (kline.open - price.min) * priceScale;
      const closeY = padding.top + chartAreaHeight - (kline.close - price.min) * priceScale;
      const highY = padding.top + chartAreaHeight - (kline.high - price.min) * priceScale;
      const lowY = padding.top + chartAreaHeight - (kline.low - price.min) * priceScale;
      
      const isGreen = kline.close >= kline.open;
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const bodyHeight = Math.abs(closeY - openY) || 1;
      
      // Draw wick
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body
      ctx.fillStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.fillRect(
        x - candleWidth * 0.35,
        bodyTop,
        candleWidth * 0.7,
        bodyHeight
      );
      
      // Draw border
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        x - candleWidth * 0.35,
        bodyTop,
        candleWidth * 0.7,
        bodyHeight
      );
    });

    // Draw hover indicator
    if (hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < visible.length) {
      const kline = visible[hoveredIndex];
      const x = padding.left + hoveredIndex * candleWidth + candleWidth / 2;
      
      // Vertical line
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartAreaHeight + volumeAreaHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw price labels on Y-axis
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const priceValue = price.max - (price.max - price.min) * (i / priceSteps);
      const y = padding.top + (chartAreaHeight / priceSteps) * i;
      ctx.fillText(
        priceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }),
        padding.left - 10,
        y + 4
      );
    }

    // Draw time labels on X-axis
    ctx.textAlign = 'center';
    const timeSteps = Math.min(visible.length, 10);
    const step = Math.floor(visible.length / timeSteps);
    for (let i = 0; i < visible.length; i += step) {
      const kline = visible[i];
      const x = padding.left + i * candleWidth + candleWidth / 2;
      const date = new Date(kline.time);
      const timeStr = date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      ctx.fillText(
        timeStr,
        x,
        padding.top + chartAreaHeight + volumeAreaHeight + 20
      );
    }
  }, [klines, visibleKlines, priceRange, volumeRange, hoveredIndex, chartHeight, volumeHeight, padding]);

  // Redraw on data or interaction changes
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

  // Mouse handlers
  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (isDragging) {
      const delta = dragStart - x;
      const visible = visibleKlines();
      const candleWidth = (canvas.width - padding.left - padding.right) / visible.length;
      const deltaCandles = Math.round(delta / candleWidth);
      setPan(prev => Math.max(0, prev + deltaCandles));
      setDragStart(x);
    } else {
      // Calculate hovered candle
      const visible = visibleKlines();
      if (visible.length === 0) return;
      const candleWidth = (canvas.width - padding.left - padding.right) / visible.length;
      const index = Math.floor((x - padding.left) / candleWidth);
      if (index >= 0 && index < visible.length) {
        setHoveredIndex(index);
      } else {
        setHoveredIndex(null);
      }
    }
  }, [isDragging, dragStart, visibleKlines]);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragStart(e.clientX - rect.left);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)));
  }, []);

  const handleZoomIn = useCallback(() => setZoom(prev => Math.min(5, prev * 1.2)), []);
  const handleZoomOut = useCallback(() => setZoom(prev => Math.max(0.5, prev / 1.2)), []);
  const handlePanLeft = useCallback(() => setPan(prev => Math.min(klines.length, prev + 10)), [klines.length]);
  const handlePanRight = useCallback(() => setPan(prev => Math.max(0, prev - 10)), []);

  if (!symbol) {
    return (
      <div className="candlestick-chart-container empty">
        <div className="empty-chart">
          <BarChart3 size={48} strokeWidth={1.5} />
          <p>Select a trading pair to view chart</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="candlestick-chart-container loading">
        <div className="chart-loading">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="candlestick-chart-container error">
        <div className="chart-error">{error}</div>
      </div>
    );
  }

  const hoveredKline = hoveredIndex !== null && hoveredIndex >= 0 
    ? visibleKlines()[hoveredIndex] 
    : null;

  // Handle fullscreen
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullscreen]);

  return (
    <div 
      ref={containerRef}
      className={`candlestick-chart-container ${isFullscreen ? 'fullscreen' : ''}`}
    >
      {/* Chart Controls */}
      <div className="chart-controls">
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
        
        <div className="chart-actions">
          <button className="chart-action-btn" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <button className="chart-action-btn" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button className="chart-action-btn" onClick={handlePanLeft} title="Pan Left">
            <ChevronLeft size={16} />
          </button>
          <button className="chart-action-btn" onClick={handlePanRight} title="Pan Right">
            <ChevronRight size={16} />
          </button>
          <button 
            className="chart-action-btn" 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            title="Toggle Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="chart-wrapper">
        <canvas
          ref={canvasRef}
          className="candlestick-canvas"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        />

        {/* Hover Tooltip */}
        {hoveredKline && canvasRef.current && (
          <div 
            className="chart-tooltip"
            style={{
              left: `${padding.left + hoveredIndex * ((canvasRef.current.width - padding.left - padding.right) / visibleKlines().length) + (canvasRef.current.width - padding.left - padding.right) / visibleKlines().length / 2}px`,
              top: `${padding.top + 10}px`,
            }}
          >
            <div className="tooltip-row">
              <span className="tooltip-label">Time:</span>
              <span className="tooltip-value">
                {new Date(hoveredKline.time).toLocaleString()}
              </span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Open:</span>
              <span className="tooltip-value">${hoveredKline.open.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">High:</span>
              <span className="tooltip-value">${hoveredKline.high.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Low:</span>
              <span className="tooltip-value">${hoveredKline.low.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Close:</span>
              <span className="tooltip-value">${hoveredKline.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Volume:</span>
              <span className="tooltip-value">{hoveredKline.volume.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandlestickChart;
