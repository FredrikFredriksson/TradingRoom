import { useEffect, useRef } from 'react';
import './TradingViewChart.css';

/**
 * TradingView Advanced Chart Widget - Free version
 * Uses TradingView's free Advanced Chart widget
 */
const TradingViewChart = ({ symbol, height = 400 }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    // Convert symbol format: BTC/USDT -> BTCUSDT
    const binanceSymbol = symbol.replace('/', '').toUpperCase();
    
    // Generate unique widget ID
    const widgetId = `tradingview_${binanceSymbol}_${Date.now()}`;
    widgetIdRef.current = widgetId;

    // Create script element for TradingView widget
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${binanceSymbol}`,
      interval: '15',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      support_host: 'https://www.tradingview.com',
      height: height,
    });

    // Clear container and add script
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height]);

  return (
    <div className="tradingview-chart-container">
      <div 
        ref={containerRef}
        className="tradingview-chart"
        style={{ height: `${height}px` }}
      />
    </div>
  );
};

export default TradingViewChart;
