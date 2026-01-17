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

    // Initialize GridStack - it should automatically read data-gs-* attributes
    gridInstanceRef.current = GridStack.init({
      column: 12,
      cellHeight: 70,
      margin: 10,
      minRow: 1,
      resizable: {
        handles: 'e, se, s, sw, w'
      },
      draggable: {
        handle: '.widget-header'
      },
      float: false, // Prevent floating/overlapping - items stay in grid positions
      animate: false, // Disable animation on initial load for better performance
      disableOneColumnMode: true
    }, gridRef.current);
    
    // Function to compact grid and prevent overlaps - only when needed
    const compactGrid = () => {
      if (!gridInstanceRef.current) return;
      try {
        // Compact items to fill gaps and prevent overlaps
        // Only compact if there are actually overlaps or gaps
        if (typeof gridInstanceRef.current.compact === 'function') {
          // Use compact method to move items to best available space
          gridInstanceRef.current.compact();
        }
      } catch (e) {
        // Silently handle - compact might not be available in all versions
        console.debug('GridStack compact:', e);
      }
    };

    // Handle drag stop to ensure proper positioning and prevent overlaps
    const handleDragStop = (event, element) => {
      // Compact after drag to ensure items are properly positioned and no overlaps
      // Use a small delay to ensure GridStack has finished processing the drag
      setTimeout(() => {
        compactGrid();
      }, 100);
    };

    // Handle resize stop to ensure proper positioning and prevent overlaps
    const handleResizeStop = (event, element) => {
      // Compact after resize to ensure items are properly positioned and no overlaps
      // Use a small delay to ensure GridStack has finished processing the resize
      setTimeout(() => {
        compactGrid();
      }, 100);
    };

    // Attach event listeners - only on drag/resize stops, not on every change
    gridInstanceRef.current.on('dragstop', handleDragStop);
    gridInstanceRef.current.on('resizestop', handleResizeStop);

    // Force widgets to maintain their preset sizes after initialization
    // GridStack should read data-gs-* attributes, but we'll enforce them explicitly
    setTimeout(() => {
      if (gridInstanceRef.current && gridRef.current) {
        const items = Array.from(gridRef.current.querySelectorAll('.grid-stack-item'));
        items.forEach((item) => {
          const w = parseInt(item.getAttribute('data-gs-w')) || 4;
          const h = parseInt(item.getAttribute('data-gs-h')) || 3;
          const x = parseInt(item.getAttribute('data-gs-x')) || 0;
          const y = parseInt(item.getAttribute('data-gs-y')) || 0;
          
          // Get the GridStack item object for this element
          const gridItems = gridInstanceRef.current.getGridItems();
          const gridItem = gridItems.find(gi => gi.el === item);
          
          if (gridItem) {
            // Update widget with explicit position and size
            gridInstanceRef.current.update(gridItem, { x, y, w, h });
          }
        });
        
        // Don't compact on initial load - let items stay in their preset positions
      }
    }, 100);

    return () => {
      if (gridInstanceRef.current) {
        // Remove event listeners
        gridInstanceRef.current.off('dragstop', handleDragStop);
        gridInstanceRef.current.off('resizestop', handleResizeStop);
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
