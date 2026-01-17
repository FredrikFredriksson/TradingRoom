import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { createOrderbookWebSocket, formatSymbolForBinance, fetchOrderbookSnapshot } from '../lib/binance';
import './Orderbook.css';

const Orderbook = ({ symbol = 'BTC/USDT' }) => {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [range, setRange] = useState(0.002); // 20 bps default
  const [loading, setLoading] = useState(true);
  const chartElementsRef = useRef(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    const binanceSymbol = formatSymbolForBinance(symbol);
    
    // Function to get dimensions and create/update chart
    const setupChart = () => {
      if (!containerRef.current) return null;

      // Set up dimensions - use full container width
      const margin = { top: 20, right: 30, bottom: 30, left: 60 };
      
      // Wait a bit for container to be properly sized
      const containerWidth = containerRef.current.clientWidth || 900;
      const containerHeight = containerRef.current.clientHeight || 500;
      
      const width = Math.max(containerWidth - margin.left - margin.right, 400);
      const height = Math.max(containerHeight - margin.top - margin.bottom, 300);

      // Clear previous SVG
      d3.select(containerRef.current).select('svg').remove();

      // Create SVG with full width - use actual pixel dimensions for viewBox
      const svgWidth = width + margin.left + margin.right;
      const svgHeight = height + margin.top + margin.bottom;
      
      const svg = d3.select(containerRef.current)
        .append('svg')
        .attr('width', '100%')
        .attr('height', svgHeight)
        .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
        .attr('preserveAspectRatio', 'none')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      return { svg, width, height, margin };
    };

    const chartSetup = setupChart();
    if (!chartSetup) return;

    const { svg, width, height, margin } = chartSetup;

    // Initialize scales
    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    // Initialize axes
    const xAxis = svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .attr('class', 'orderbook-axis');

    const yAxis = svg.append('g')
      .attr('class', 'orderbook-axis');

    // Line generators
    const bidLine = d3.line()
      .x(d => x(d.price))
      .y(d => y(d.cumVolume));

    const askLine = d3.line()
      .x(d => x(d.price))
      .y(d => y(d.cumVolume));

    // Area generators
    const bidArea = d3.area()
      .x(d => x(d.price))
      .y0(height)
      .y1(d => y(d.cumVolume));

    const askArea = d3.area()
      .x(d => x(d.price))
      .y0(height)
      .y1(d => y(d.cumVolume));

    // Create paths
    const bidAreaPath = svg.append('path')
      .attr('class', 'orderbook-area orderbook-bid-area');

    const askAreaPath = svg.append('path')
      .attr('class', 'orderbook-area orderbook-ask-area');

    const bidPath = svg.append('path')
      .attr('class', 'orderbook-line orderbook-bid-line');

    const askPath = svg.append('path')
      .attr('class', 'orderbook-line orderbook-ask-line');

    // Store chart elements
    chartElementsRef.current = {
      svg, x, y, width, height, margin, bidArea, askArea, bidLine, askLine,
      bidAreaPath, askAreaPath, bidPath, askPath, xAxis, yAxis
    };

    // Update function - matches original HTML implementation exactly
    const updateChart = (orderbookData) => {
      if (!orderbookData || !orderbookData.bids || !orderbookData.asks || !chartElementsRef.current) return;

      const { bids, asks } = orderbookData;
      const { x, y, width, height, xAxis, yAxis, bidArea, askArea, bidLine, askLine, bidAreaPath, askAreaPath, bidPath, askPath } = chartElementsRef.current;

      // Process bids exactly as in original: volume = price * quantity, then calculate cumulative
      const bidData = bids
        .slice(0, 1900)
        .map((d) => ({ price: d[0], volume: d[0] * d[1] }))
        .map((d, i, arr) => {
          d.cumVolume = d.volume + (i > 0 ? arr[i - 1].cumVolume : 0);
          return d;
        });

      // Process asks exactly as in original
      const askData = asks
        .slice(0, 1900)
        .map((d) => ({ price: d[0], volume: d[0] * d[1] }))
        .map((d, i, arr) => {
          d.cumVolume = d.volume + (i > 0 ? arr[i - 1].cumVolume : 0);
          return d;
        });

      if (bidData.length === 0 || askData.length === 0) return;

      // Calculate mid price
      const midPrice = 0.5 * (bidData[0].price + askData[0].price);

      // Filter data based on range (exactly as original)
      const bpsWidth = range;
      const minPrice = (1 - bpsWidth) * midPrice;
      const maxPrice = (1 + bpsWidth) * midPrice;

      const filteredBids = bidData.filter(d => d.price > minPrice);
      const filteredAsks = askData.filter(d => d.price < maxPrice);

      if (filteredBids.length === 0 || filteredAsks.length === 0) return;

      // Update scales - exactly as original
      x.domain([minPrice, maxPrice]);
      
      // Get last items from filtered arrays for y domain (as in original)
      const lastBid = filteredBids.slice(-1)[0];
      const lastAsk = filteredAsks.slice(-1)[0];
      const maxCumVolume = Math.max(
        lastBid ? lastBid.cumVolume : 0,
        lastAsk ? lastAsk.cumVolume : 0
      );
      y.domain([0, maxCumVolume]);

      // Update axes
      xAxis.transition().duration(100).call(d3.axisBottom(x));
      yAxis.transition().duration(100).call(d3.axisLeft(y));

      // Update bid area
      bidAreaPath
        .datum(filteredBids)
        .transition()
        .duration(100)
        .attr('d', bidArea);

      // Update ask area
      askAreaPath
        .datum(filteredAsks)
        .transition()
        .duration(100)
        .attr('d', askArea);

      // Update bid line - add starting point with cumVolume 0
      bidPath
        .datum([{ price: filteredBids[0].price, cumVolume: 0 }, ...filteredBids])
        .transition()
        .duration(100)
        .attr('d', bidLine);

      // Update ask line - add starting point with cumVolume 0
      askPath
        .datum([{ price: filteredAsks[0].price, cumVolume: 0 }, ...filteredAsks])
        .transition()
        .duration(100)
        .attr('d', askLine);

      setLoading(false);
      
      // Store last orderbook data for resize re-rendering
      if (chartElementsRef.current) {
        chartElementsRef.current.lastOrderbookData = orderbookData;
      }
    };

    // Fetch initial snapshot and set up WebSocket
    const initializeOrderbook = async () => {
      setLoading(true);
      
      // Fetch initial snapshot with more levels for better visualization
      const snapshot = await fetchOrderbookSnapshot(binanceSymbol, 100);
      if (snapshot.bids.length > 0 && snapshot.asks.length > 0) {
        updateChart(snapshot);
        
        // Set up WebSocket for real-time updates with initial snapshot
        if (wsRef.current) {
          wsRef.current.close();
        }

        wsRef.current = createOrderbookWebSocket(binanceSymbol, (orderbook) => {
          updateChart(orderbook);
        }, snapshot);
      }
    };

    initializeOrderbook();

    // Handle resize - re-render chart with new dimensions
    const handleResize = () => {
      if (!containerRef.current || !chartElementsRef.current) return;
      
      const margin = { top: 20, right: 30, bottom: 30, left: 60 };
      const containerWidth = containerRef.current.clientWidth || 900;
      const newWidth = containerWidth - margin.left - margin.right;
      const newHeight = (containerRef.current.clientHeight || 500) - margin.top - margin.bottom;

      // Update scales range
      chartElementsRef.current.x.range([0, newWidth]);
      chartElementsRef.current.y.range([newHeight, 0]);
      
      // Update area generators
      chartElementsRef.current.bidArea.y0(newHeight);
      chartElementsRef.current.askArea.y0(newHeight);
      
      // Update axes position
      chartElementsRef.current.xAxis.attr('transform', `translate(0,${newHeight})`);
      
      // Update stored dimensions
      chartElementsRef.current.width = newWidth;
      chartElementsRef.current.height = newHeight;
      
      // Update SVG viewBox and height
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.setAttribute('viewBox', `0 0 ${newWidth + margin.left + margin.right} ${newHeight + margin.top + margin.bottom}`);
        svgElement.setAttribute('height', newHeight + margin.top + margin.bottom);
      }
      
      // Re-render the chart with current data if we have it
      // We'll need to store the last orderbook data to re-render on resize
      if (chartElementsRef.current.lastOrderbookData) {
        updateChart(chartElementsRef.current.lastOrderbookData);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [symbol, range]);

  return (
    <div className="orderbook-container">
      <div className="orderbook-controls">
        <select
          className="orderbook-range-select"
          value={range}
          onChange={(e) => setRange(parseFloat(e.target.value))}
        >
          <option value={0.002}>20 bps</option>
          <option value={0.004}>40 bps</option>
          <option value={0.006}>60 bps</option>
          <option value={0.008}>80 bps</option>
          <option value={0.01}>100 bps</option>
          <option value={0.012}>120 bps</option>
          <option value={0.014}>140 bps</option>
          <option value={0.016}>160 bps</option>
          <option value={0.018}>180 bps</option>
          <option value={0.02}>200 bps</option>
          <option value={0.03}>300 bps</option>
          <option value={0.04}>400 bps</option>
          <option value={0.05}>5%</option>
          <option value={0.1}>10%</option>
        </select>
      </div>
      <div ref={containerRef} className="orderbook-chart">
        {loading && (
          <div className="orderbook-loading">Loading orderbook data...</div>
        )}
      </div>
    </div>
  );
};

export default Orderbook;
