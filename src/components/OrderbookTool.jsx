import { useEffect, useRef } from 'react';
import './OrderbookTool.css';

/**
 * Orderbook Tool - Embeds the original orderbook.tool.html file
 */
const OrderbookTool = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create iframe to load the HTML file from public folder
    const iframe = document.createElement('iframe');
    iframe.src = '/orderbook.tool.html';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';
    iframe.setAttribute('sandbox', 'allow-scripts');
    
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(iframe);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="orderbook-tool-container" ref={containerRef} />
  );
};

export default OrderbookTool;
