import { useEffect, useRef } from 'react';
import { formatSymbolForBinance } from '../lib/binance';
import './TradingViewWidget.css';

/**
 * TradingView Advanced Chart Widget for Analytics page
 */
const TradingViewWidget = ({ symbol = 'BTC/USDT' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    // Convert symbol format: BTC/USDT -> BTCUSDT
    const binanceSymbol = formatSymbolForBinance(symbol);
    
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
  }, [symbol]);

  return (
    <div className="tradingview-widget-container">
      <div 
        ref={containerRef}
        className="tradingview-widget"
      />
    </div>
  );
};

export default TradingViewWidget;
