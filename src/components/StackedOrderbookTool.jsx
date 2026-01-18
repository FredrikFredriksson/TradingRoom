import { useEffect, useRef } from 'react';
import './StackedOrderbookTool.css';

/**
 * Stacked Orderbook Tool - Embeds the stacked-orderbook.tool.html (multi-exchange: Binance, Kraken, Coinbase)
 */
const StackedOrderbookTool = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const iframe = document.createElement('iframe');
    iframe.src = '/stacked-orderbook.tool.html';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(iframe);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="stacked-orderbook-tool-container" ref={containerRef} />
  );
};

export default StackedOrderbookTool;
