/**
 * Binance API and WebSocket service for real-time price data
 * Free to use - no API key required for public data
 */

// Popular trading pairs on Binance
const POPULAR_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT',
  'LINKUSDT', 'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'ETCUSDT',
  'NEARUSDT', 'ALGOUSDT', 'FILUSDT', 'VETUSDT', 'ICPUSDT',
  'APTUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'SEIUSDT',
];

/**
 * Fetch all USDT trading pairs from Binance
 */
export async function fetchTradingPairs() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    const data = await response.json();
    
    // Filter for USDT pairs and sort by volume
    const usdtPairs = data.symbols
      .filter(s => s.symbol.endsWith('USDT') && s.status === 'TRADING')
      .map(s => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        // Format for display: BTC/USDT
        displaySymbol: `${s.baseAsset}/${s.quoteAsset}`,
      }))
      .sort((a, b) => {
        // Prioritize popular pairs
        const aIndex = POPULAR_PAIRS.indexOf(a.symbol);
        const bIndex = POPULAR_PAIRS.indexOf(b.symbol);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
    
    return usdtPairs;
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    // Fallback to popular pairs
    return POPULAR_PAIRS.map(symbol => ({
      symbol,
      baseAsset: symbol.replace('USDT', ''),
      quoteAsset: 'USDT',
      displaySymbol: `${symbol.replace('USDT', '')}/USDT`,
    }));
  }
}

/**
 * Fetch current price for a symbol
 */
export async function fetchCurrentPrice(symbol) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const data = await response.json();
    return parseFloat(data.price);
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch 24h ticker (OHLC) for all or one symbol. Used for volatility / variance bootstrap.
 * @param {string} [symbol] - Optional. e.g. 'BTCUSDT'. If omitted, returns all tickers.
 * @returns {Promise<Object>} Map of symbol -> { open, high, low, close } or single object
 */
export async function fetch24hTickers(symbol = null) {
  try {
    const url = symbol
      ? `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
      : 'https://api.binance.com/api/v3/ticker/24hr';
    const response = await fetch(url);
    const data = await response.json();
    const map = {};
    const mapOne = (t) => {
      const o = parseFloat(t.open);
      const h = parseFloat(t.high);
      const l = parseFloat(t.low);
      const c = parseFloat(t.lastPrice ?? t.close ?? t.last);
      return { open: o, high: h, low: l, close: c };
    };
    if (Array.isArray(data)) {
      data.forEach((t) => { map[t.symbol] = mapOne(t); });
      return map;
    }
    return { [data.symbol]: mapOne(data) };
  } catch (error) {
    console.error('Error fetching 24h tickers:', error);
    return {};
  }
}

/**
 * Create WebSocket for all symbols' ticker stream. Fires on each batch.
 * @param {function} onUpdate - (Map<string, number>) => void, symbol -> last price
 * @returns {WebSocket}
 */
export function createAllTickersWebSocket(onUpdate) {
  const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
  ws.onmessage = (event) => {
    try {
      const arr = JSON.parse(event.data);
      const map = {};
      arr.forEach((t) => {
        if (t.s && t.c) map[t.s] = parseFloat(t.c);
      });
      onUpdate(map);
    } catch (e) {
      console.error('Error parsing all-tickers stream:', e);
    }
  };
  ws.onerror = (e) => console.error('All-tickers WebSocket error:', e);
  ws.onclose = () => {};
  return ws;
}

/**
 * Fetch orderbook snapshot from Binance
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param {number} limit - Number of price levels (default 20, max 5000)
 * @returns {Promise<Object>} Orderbook snapshot
 */
export async function fetchOrderbookSnapshot(symbol, limit = 100) {
  try {
    // Binance allows up to 5000 levels, but we'll use 100 for good visualization
    const actualLimit = Math.min(limit, 100);
    const response = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${actualLimit}`
    );
    const data = await response.json();
    
    return {
      bids: data.bids.map(([price, quantity]) => [
        parseFloat(price),
        parseFloat(quantity)
      ]).sort((a, b) => b[0] - a[0]),
      asks: data.asks.map(([price, quantity]) => [
        parseFloat(price),
        parseFloat(quantity)
      ]).sort((a, b) => a[0] - b[0]),
      lastUpdateId: data.lastUpdateId,
    };
  } catch (error) {
    console.error(`Error fetching orderbook snapshot for ${symbol}:`, error);
    return { bids: [], asks: [], lastUpdateId: 0 };
  }
}

/**
 * Create WebSocket connection for real-time price updates
 */
export function createPriceWebSocket(symbol, onPriceUpdate) {
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.c) { // 'c' is the current price
        onPriceUpdate(parseFloat(data.c));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket closed');
  };
  
  return ws;
}

/**
 * Create WebSocket connection for 24h ticker updates (includes price, volume, etc.)
 */
export function createTickerWebSocket(symbol, onTickerUpdate) {
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onTickerUpdate({
        price: parseFloat(data.c), // Current price
        priceChange: parseFloat(data.P), // Price change percent
        high24h: parseFloat(data.h), // 24h high
        low24h: parseFloat(data.l), // 24h low
        volume24h: parseFloat(data.v), // 24h volume
        quoteVolume24h: parseFloat(data.q), // 24h quote volume
      });
    } catch (error) {
      console.error('Error parsing ticker WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('Ticker WebSocket error:', error);
  };
  
  return ws;
}

/**
 * Convert Binance symbol format (BTCUSDT) to display format (BTC/USDT)
 */
export function formatSymbolForDisplay(symbol) {
  if (symbol.endsWith('USDT')) {
    return `${symbol.replace('USDT', '')}/USDT`;
  }
  return symbol;
}

/**
 * Convert display format (BTC/USDT) to Binance symbol format (BTCUSDT)
 */
export function formatSymbolForBinance(displaySymbol) {
  return displaySymbol.replace('/', '').toUpperCase();
}

/**
 * Fetch historical klines (candlestick data) from Binance
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param {string} interval - Kline interval (1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M)
 * @param {number} limit - Number of klines to fetch (max 1000)
 * @returns {Promise<Array>} Array of kline data
 */
export async function fetchKlines(symbol, interval = '15m', limit = 500) {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    const data = await response.json();
    
    // Transform Binance kline format to our format
    return data.map(kline => ({
      time: kline[0], // Open time
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
      closeTime: kline[6],
      quoteVolume: parseFloat(kline[7]),
      trades: kline[8],
      takerBuyBaseVolume: parseFloat(kline[9]),
      takerBuyQuoteVolume: parseFloat(kline[10]),
    }));
  } catch (error) {
    console.error(`Error fetching klines for ${symbol}:`, error);
    return [];
  }
}

/**
 * Create WebSocket connection for real-time kline (candlestick) updates
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param {string} interval - Kline interval
 * @param {function} onKlineUpdate - Callback function for kline updates
 * @returns {WebSocket} WebSocket connection
 */
export function createKlineWebSocket(symbol, interval, onKlineUpdate) {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
  );
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.k) {
        const kline = data.k;
        onKlineUpdate({
          time: kline.t, // Open time
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
          closeTime: kline.T,
          isClosed: kline.x, // Is this kline closed?
        });
      }
    } catch (error) {
      console.error('Error parsing kline WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('Kline WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('Kline WebSocket closed');
  };
  
  return ws;
}

/**
 * Create WebSocket connection for real-time orderbook depth updates
 * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param {function} onOrderbookUpdate - Callback function for orderbook updates
 * @param {Object} initialSnapshot - Initial orderbook snapshot to merge with
 * @returns {WebSocket} WebSocket connection
 */
export function createOrderbookWebSocket(symbol, onOrderbookUpdate, initialSnapshot = null) {
  // Use depth stream with 20 levels and 100ms updates
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth20@100ms`
  );
  
  // Initialize with snapshot if provided
  let orderbook = initialSnapshot 
    ? {
        bids: initialSnapshot.bids.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
        asks: initialSnapshot.asks.map(([p, q]) => [parseFloat(p), parseFloat(q)])
      }
    : { bids: [], asks: [] };
  
  let lastUpdateId = initialSnapshot?.lastUpdateId || 0;
  let isFirstUpdate = true;
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.e === 'depthUpdate') {
        // Skip updates before snapshot
        if (isFirstUpdate && data.u <= lastUpdateId) {
          return;
        }
        isFirstUpdate = false;
        
        // Update orderbook with incremental updates
        // Process bid updates
        if (data.b) {
          data.b.forEach(([price, quantity]) => {
            const priceNum = parseFloat(price);
            const qtyNum = parseFloat(quantity);
            
            if (qtyNum === 0) {
              // Remove price level
              orderbook.bids = orderbook.bids.filter(b => Math.abs(b[0] - priceNum) > 0.00000001);
            } else {
              // Update or add price level
              const existingIndex = orderbook.bids.findIndex(b => Math.abs(b[0] - priceNum) < 0.00000001);
              if (existingIndex >= 0) {
                orderbook.bids[existingIndex][1] = qtyNum;
              } else {
                orderbook.bids.push([priceNum, qtyNum]);
              }
            }
          });
          // Sort bids descending
          orderbook.bids.sort((a, b) => b[0] - a[0]);
        }
        
        // Process ask updates
        if (data.a) {
          data.a.forEach(([price, quantity]) => {
            const priceNum = parseFloat(price);
            const qtyNum = parseFloat(quantity);
            
            if (qtyNum === 0) {
              // Remove price level
              orderbook.asks = orderbook.asks.filter(a => Math.abs(a[0] - priceNum) > 0.00000001);
            } else {
              // Update or add price level
              const existingIndex = orderbook.asks.findIndex(a => Math.abs(a[0] - priceNum) < 0.00000001);
              if (existingIndex >= 0) {
                orderbook.asks[existingIndex][1] = qtyNum;
              } else {
                orderbook.asks.push([priceNum, qtyNum]);
              }
            }
          });
          // Sort asks ascending
          orderbook.asks.sort((a, b) => a[0] - b[0]);
        }
        
        // Send updated orderbook
        onOrderbookUpdate({
          bids: [...orderbook.bids],
          asks: [...orderbook.asks],
          lastUpdateId: data.u,
        });
      }
    } catch (error) {
      console.error('Error parsing orderbook WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('Orderbook WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('Orderbook WebSocket closed');
  };
  
  return ws;
}
