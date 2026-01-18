import { useEffect, useRef } from 'react';
import { BarChart3 } from 'lucide-react';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import PriceCard from './PriceCard';
import TradingViewWidget from './TradingViewWidget';
import OrderbookTool from './OrderbookTool';
import './Analytics.css';

const Analytics = () => {
  const gridRef = useRef(null);
  const gridInstanceRef = useRef(null);

  useEffect(() => {
    if (!gridRef.current) return;

    // GridStack reads gs-x, gs-y, gs-w, gs-h (not data-gs-*). React passes data-* to DOM,
    // so we use data-gs-* in JSX and copy to gs-* before init.
    const gridEl = gridRef.current;
    gridEl.querySelectorAll('.grid-stack-item').forEach((el) => {
      const copy = (from, to) => { const v = el.getAttribute(from); if (v != null) el.setAttribute(to, v); };
      copy('data-gs-x', 'gs-x');
      copy('data-gs-y', 'gs-y');
      copy('data-gs-w', 'gs-w');
      copy('data-gs-h', 'gs-h');
      copy('data-gs-min-w', 'gs-min-w');
      copy('data-gs-min-h', 'gs-min-h');
    });

    // Match leverage-gridstack logic: cellHeight 'auto', responsive columnOpts, animate on,
    // no float/disableOneColumnMode. Smooth drag/resize and breakpoint transitions.
    gridInstanceRef.current = GridStack.init({
      column: 12,
      cellHeight: 'auto',
      margin: 5,
      minRow: 1,
      animate: true,
      columnOpts: {
        breakpointForWindow: true,
        breakpoints: [
          { w: 700, c: 1 },
          { w: 850, c: 4 },
          { w: 1100, c: 6 },
          { w: 1400, c: 8 },
          { w: 1800, c: 12 }
        ]
      },
      resizable: {
        handles: 'e, se, s, sw, w',
        autoHide: false
      },
      draggable: {
        handle: '.widget-header',
        scroll: true
      }
    }, gridRef.current);

    return () => {
      if (gridInstanceRef.current) {
        gridInstanceRef.current.destroy(false);
      }
    };
  }, []);

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h2>
          <BarChart3 size={24} />
          Analytics
        </h2>
        <p className="analytics-subtitle">Trading tools and market insights - Drag and resize widgets to customize your layout</p>
      </div>

      <div className="analytics-grid grid-stack" ref={gridRef}>
        {/* Price Card - Small BTC graph */}
        <div 
          className="grid-stack-item" 
          data-gs-x="0"
          data-gs-y="0"
          data-gs-w="5"
          data-gs-h="4"
          data-gs-min-w="4"
          data-gs-min-h="3"
        >
          <div className="grid-stack-item-content widget-wrapper">
            <div className="widget-header">
              <span>Price Card</span>
            </div>
            <PriceCard />
          </div>
        </div>
        
        {/* TradingView Chart */}
        <div 
          className="grid-stack-item" 
          data-gs-x="5"
          data-gs-y="0"
          data-gs-w="7"
          data-gs-h="4"
          data-gs-min-w="6"
          data-gs-min-h="3"
        >
          <div className="grid-stack-item-content widget-wrapper">
            <div className="widget-header">
              <span>TradingView Chart - BTC/USDT</span>
            </div>
            <TradingViewWidget symbol="BTC/USDT" />
          </div>
        </div>

        {/* Orderbook */}
        <div 
          className="grid-stack-item" 
          data-gs-x="0"
          data-gs-y="4"
          data-gs-w="12"
          data-gs-h="7"
          data-gs-min-w="10"
          data-gs-min-h="6"
        >
          <div className="grid-stack-item-content widget-wrapper">
            <div className="widget-header">
              <span>Orderbook Tool</span>
            </div>
            <OrderbookTool />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
