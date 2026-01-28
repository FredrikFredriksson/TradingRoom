import { useEffect, useRef } from 'react';
import { BarChart3 } from 'lucide-react';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import PriceCard from './PriceCard';
import TradingViewWidget from './TradingViewWidget';
import OrderbookTool from './OrderbookTool';
import StackedOrderbookTool from './StackedOrderbookTool';
import MultiGauge from './MultiGauge';
import './Analytics.css';

/**
 * Analytics Component
 * 
 * A dashboard-style analytics page featuring a customizable grid layout of trading tools.
 * Uses GridStack for drag-and-drop widget management with responsive breakpoints.
 * 
 * Widgets included:
 * - PriceCard: Small BTC price graph with real-time updates
 * - TradingViewWidget: Interactive TradingView chart for BTC/USDT
 * - MultiGauge: Volatility gauges showing market metrics
 * - OrderbookTool: Single exchange orderbook visualization
 * - StackedOrderbookTool: Multi-exchange orderbook comparison (Binance, Kraken, Coinbase, HyperLiquid)
 */
const Analytics = () => {
  // Ref to the GridStack container DOM element
  const gridRef = useRef(null);
  // Ref to store the GridStack instance for cleanup
  const gridInstanceRef = useRef(null);

  useEffect(() => {
    if (!gridRef.current) return;

    // GridStack attribute conversion
    // GridStack library reads gs-x, gs-y, gs-w, gs-h attributes (not data-gs-*).
    // React passes data-* attributes to the DOM, so we use data-gs-* in JSX for React
    // and then copy them to gs-* attributes before GridStack initialization.
    const gridEl = gridRef.current;
    gridEl.querySelectorAll('.grid-stack-item').forEach((el) => {
      const copy = (from, to) => { const v = el.getAttribute(from); if (v != null) el.setAttribute(to, v); };
      copy('data-gs-x', 'gs-x');      // X position in grid
      copy('data-gs-y', 'gs-y');      // Y position in grid
      copy('data-gs-w', 'gs-w');      // Width in grid units
      copy('data-gs-h', 'gs-h');      // Height in grid units
      copy('data-gs-min-w', 'gs-min-w'); // Minimum width constraint
      copy('data-gs-min-h', 'gs-min-h'); // Minimum height constraint
    });

    // GridStack initialization configuration
    // Matches leverage-gridstack logic: cellHeight 'auto', responsive columnOpts, animate on.
    // float: true allows items to pack upward and fit the grid after resize/drag operations.
    const grid = GridStack.init({
      column: 12,                    // 12-column grid system
      cellHeight: 'auto',            // Auto-calculate cell height based on content
      margin: 5,                     // 5px margin between grid items
      minRow: 1,                     // Minimum 1 row in the grid
      animate: true,                 // Enable smooth animations for drag/resize
      float: true,                   // Allow items to float and pack upward
      columnOpts: {
        breakpointForWindow: true,   // Use window width for responsive breakpoints
        breakpoints: [
          { w: 700, c: 1 },   // Mobile: 1 column at 700px and below
          { w: 850, c: 4 },   // Tablet: 4 columns at 850px
          { w: 1100, c: 6 },  // Small desktop: 6 columns at 1100px
          { w: 1400, c: 8 },  // Medium desktop: 8 columns at 1400px
          { w: 1800, c: 12 }  // Large desktop: 12 columns at 1800px and above
        ]
      },
      resizable: {
        handles: 'se',               // Only allow resizing from southeast corner
        autoHide: false             // Always show resize handles
      },
      draggable: {
        handle: '.widget-header',   // Only allow dragging by the widget header
        scroll: true                // Enable scrolling during drag
      }
    }, gridRef.current);
    gridInstanceRef.current = grid;

    // Iframe pointer events handling
    // Problem: Iframes capture pointer events, so mouseup never reaches the parent
    // and resize/drag operations never end properly — you have to click again.
    // Solution: Disable pointer-events on all iframes during resize/drag operations
    // so the mouse release always lands on the grid and the interaction ends smoothly.
    const disableIframePointers = () => {
      gridEl.querySelectorAll('iframe').forEach((f) => { f.style.pointerEvents = 'none'; });
    };
    const enableIframePointers = () => {
      gridEl.querySelectorAll('iframe').forEach((f) => { f.style.pointerEvents = ''; });
    };
    // Attach event listeners to manage iframe pointer events during interactions
    grid.on('resizestart', disableIframePointers);
    grid.on('resizestop', enableIframePointers);
    grid.on('dragstart', disableIframePointers);
    grid.on('dragstop', enableIframePointers);

    // Cleanup: Destroy GridStack instance when component unmounts
    return () => {
      if (gridInstanceRef.current) {
        gridInstanceRef.current.destroy(false);
      }
    };
  }, []);

  return (
    <div className="analytics-page">
      {/* Page header with title and description */}
      <div className="analytics-header">
        <h2>
          <BarChart3 size={24} />
          Analytics
        </h2>
        <p className="analytics-subtitle">Trading tools and market insights - Drag and resize widgets to customize your layout</p>
      </div>

      {/* GridStack container - all widgets are draggable and resizable */}
      <div className="analytics-grid grid-stack" ref={gridRef}>
        {/* 
          Price Card Widget
          Displays a small BTC price graph with real-time price updates.
          Initial size: 5 columns wide x 4 rows tall
          Minimum size: 4 columns x 2 rows (ensures graph remains readable)
          Position: Top-left (x=0, y=0)
          Resize only from southeast corner (grow diagonally)
        */}
        <div 
          className="grid-stack-item" 
          data-gs-x="0"
          data-gs-y="0"
          data-gs-w="5"
          data-gs-h="4"
          data-gs-min-w="4"
          data-gs-min-h="2"
        >
          <div className="grid-stack-item-content widget-wrapper">
            <div className="widget-header">
              <span>Price Card</span>
            </div>
            <PriceCard />
          </div>
        </div>
        
        {/* 
          TradingView Chart Widget
          Interactive TradingView chart for BTC/USDT pair with full charting capabilities.
          Initial size: 7 columns wide x 4 rows tall
          Minimum size: 6 columns x 3 rows (ensures chart controls are accessible)
          Position: Top-right (x=5, y=0) - adjacent to Price Card
        */}
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

        {/* 
          Volatility Gauges Widget
          Multi-gauge component displaying various market volatility metrics.
          Initial size: 4 columns wide x 3 rows tall
          Minimum size: 3 columns x 2 rows (ensures gauges remain visible)
          Position: Left side, below Price Card (x=0, y=4)
        */}
        <div 
          className="grid-stack-item" 
          data-gs-x="0"
          data-gs-y="4"
          data-gs-w="4"
          data-gs-h="3"
          data-gs-min-w="3"
          data-gs-min-h="2"
        >
          <div className="grid-stack-item-content widget-wrapper">
            <div className="widget-header">
              <span>Volatility Gauges</span>
            </div>
            <MultiGauge />
          </div>
        </div>

        {/* 
          Orderbook Tool Widget
          Single exchange orderbook visualization with depth chart.
          Initial size: 10 columns wide x 6 rows tall
          Minimum size: 7 columns x 4 rows (ensures orderbook data and chart are readable)
          Note: X-axis ticks/numbers scale with widget size for better readability
          Position: Right side, below TradingView chart (x=4, y=4)
        */}
        <div 
          className="grid-stack-item" 
          data-gs-x="4"
          data-gs-y="4"
          data-gs-w="10"
          data-gs-h="6"
          data-gs-min-w="7"
          data-gs-min-h="4"
        >
          <div className="grid-stack-item-content widget-wrapper">
            <div className="widget-header">
              <span>Orderbook Tool</span>
            </div>
            <OrderbookTool />
          </div>
        </div>

        {/* 
          Stacked Orderbook Tool Widget
          Multi-exchange orderbook comparison showing aggregated depth across:
          - Binance
          - Kraken
          - Coinbase
          - HyperLiquid
          Initial size: 8 columns wide x 4 rows tall
          Minimum size: 4 columns x 3 rows (ensures exchange labels and data remain visible)
          Position: Bottom-left (x=0, y=11) - below other widgets
        */}
        <div 
          className="grid-stack-item" 
          data-gs-x="0"
          data-gs-y="11"
          data-gs-w="8"
          data-gs-h="4"
          data-gs-min-w="4"
          data-gs-min-h="3"
        >
          <div className="grid-stack-item-content widget-wrapper">
            <div className="widget-header">
              <span>Stacked Orderbook (Binance, Kraken, Coinbase, HyperLiquid)</span>
            </div>
            <StackedOrderbookTool />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
