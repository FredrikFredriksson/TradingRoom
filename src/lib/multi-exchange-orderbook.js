/**
 * Multi-Exchange Orderbook Aggregator
 * Free public APIs: Binance, Kraken, Coinbase Advanced Trade
 * No API keys required for orderbook (level2) market data.
 */

const LEVELS = 50; // price levels per side to use for chart

/**
 * Normalize raw bids/asks to chart format: [{ price, volume, cumVolume }]
 * with a zero-volume bridge point at the spread for area continuity.
 */
function toChartFormat(bids, asks, levels = LEVELS) {
  // [ [price, qty], ... ] -> take first N, sort, add bridge, cumVolume
  const b = (bids || [])
    .map(([p, q]) => ({ price: parseFloat(p), volume: parseFloat(q) }))
    .filter((x) => x.volume > 0)
    .sort((a, b) => b.price - a.price)
    .slice(0, levels);
  const a = (asks || [])
    .map(([p, q]) => ({ price: parseFloat(p), volume: parseFloat(q) }))
    .filter((x) => x.volume > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, levels);

  if (b.length === 0 && a.length === 0) return { bids: [], asks: [] };

  // Bridge: zero-volume point just above best bid and just below best ask
  const firstBid = b.length ? 1.000001 * b[0].price : 0;
  const firstAsk = a.length ? 0.999999 * a[0].price : 0;
  b.splice(0, 0, { price: firstBid, volume: 0 });
  a.splice(0, 0, { price: firstAsk, volume: 0 });

  let cum = 0;
  b.forEach((d) => {
    cum += d.volume;
    d.cumVolume = cum;
  });
  cum = 0;
  a.forEach((d) => {
    cum += d.volume;
    d.cumVolume = cum;
  });

  return { bids: b, asks: a };
}

// --- Binance ---
function startBinance(displaySymbol, onBook) {
  const symbol = displaySymbol.replace('/', '').toUpperCase(); // BTCUSDT
  let ws = null;
  let orderbook = { bids: [], asks: [] };
  let lastUpdateId = 0;
  let isFirst = true;

  function emit() {
    const { bids, asks } = toChartFormat(orderbook.bids, orderbook.asks);
    if (bids.length || asks.length) onBook('Binance', { bids, asks });
  }

  function run() {
    // 1) Snapshot from REST
    fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        orderbook = {
          bids: (data.bids || []).map(([p, q]) => [parseFloat(p), parseFloat(q)]).sort((a, b) => b[0] - a[0]),
          asks: (data.asks || []).map(([p, q]) => [parseFloat(p), parseFloat(q)]).sort((a, b) => a[0] - b[0]),
        };
        lastUpdateId = data.lastUpdateId || 0;
        emit();
      })
      .catch((e) => console.warn('Binance snapshot failed', e));

    // 2) Diff stream @depth@100ms
    ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth@100ms`);
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.e !== 'depthUpdate') return;
        if (isFirst && d.u <= lastUpdateId) return;
        isFirst = false;

        (d.b || []).forEach(([p, q]) => {
          const pn = parseFloat(p);
          const qn = parseFloat(q);
          if (qn === 0) orderbook.bids = orderbook.bids.filter((b) => Math.abs(b[0] - pn) > 1e-9);
          else {
            const i = orderbook.bids.findIndex((b) => Math.abs(b[0] - pn) < 1e-9);
            if (i >= 0) orderbook.bids[i][1] = qn;
            else orderbook.bids.push([pn, qn]);
          }
        });
        (d.a || []).forEach(([p, q]) => {
          const pn = parseFloat(p);
          const qn = parseFloat(q);
          if (qn === 0) orderbook.asks = orderbook.asks.filter((a) => Math.abs(a[0] - pn) > 1e-9);
          else {
            const i = orderbook.asks.findIndex((a) => Math.abs(a[0] - pn) < 1e-9);
            if (i >= 0) orderbook.asks[i][1] = qn;
            else orderbook.asks.push([pn, qn]);
          }
        });
        orderbook.bids.sort((a, b) => b[0] - a[0]);
        orderbook.asks.sort((a, b) => a[0] - b[0]);
        lastUpdateId = d.u;
        emit();
      } catch (e) {
        console.warn('Binance WS parse', e);
      }
    };
    ws.onerror = () => {};
    ws.onclose = () => {};
  }

  run();
  return () => {
    if (ws) try { ws.close(); } catch (_) {}
  };
}

// --- Kraken (v2) ---
function startKraken(displaySymbol, onBook) {
  const symbol = displaySymbol; // "BTC/USDT"
  let ws = null;
  const orderbook = { bids: [], asks: [] };
  const DEPTH = 100;

  function applyBids(levels) {
    levels.forEach((l) => {
      const p = parseFloat(l.price);
      const q = parseFloat(l.qty);
      if (q === 0) {
        const i = orderbook.bids.findIndex((b) => Math.abs(b[0] - p) < 1e-9);
        if (i >= 0) orderbook.bids.splice(i, 1);
      } else {
        const i = orderbook.bids.findIndex((b) => Math.abs(b[0] - p) < 1e-9);
        if (i >= 0) orderbook.bids[i][1] = q;
        else orderbook.bids.push([p, q]);
      }
    });
    orderbook.bids.sort((a, b) => b[0] - a[0]);
    orderbook.bids.splice(DEPTH);
  }

  function applyAsks(levels) {
    levels.forEach((l) => {
      const p = parseFloat(l.price);
      const q = parseFloat(l.qty);
      if (q === 0) {
        const i = orderbook.asks.findIndex((a) => Math.abs(a[0] - p) < 1e-9);
        if (i >= 0) orderbook.asks.splice(i, 1);
      } else {
        const i = orderbook.asks.findIndex((a) => Math.abs(a[0] - p) < 1e-9);
        if (i >= 0) orderbook.asks[i][1] = q;
        else orderbook.asks.push([p, q]);
      }
    });
    orderbook.asks.sort((a, b) => a[0] - b[0]);
    orderbook.asks.splice(DEPTH);
  }

  function emit() {
    const { bids, asks } = toChartFormat(orderbook.bids, orderbook.asks);
    if (bids.length || asks.length) onBook('Kraken', { bids, asks });
  }

  ws = new WebSocket('wss://ws.kraken.com/v2');
  ws.onopen = () => {
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: { channel: 'book', symbol: [symbol], depth: DEPTH, snapshot: true },
      req_id: 1,
    }));
  };
  ws.onmessage = (ev) => {
    try {
      const j = JSON.parse(ev.data);
      if (j.channel !== 'book' || !j.data || !j.data[0]) return;
      const d = j.data[0];
      if (d.symbol !== symbol) return;

      if (j.type === 'snapshot') {
        orderbook.bids = (d.bids || []).map((l) => [parseFloat(l.price), parseFloat(l.qty)]).sort((a, b) => b[0] - a[0]).slice(0, DEPTH);
        orderbook.asks = (d.asks || []).map((l) => [parseFloat(l.price), parseFloat(l.qty)]).sort((a, b) => a[0] - b[0]).slice(0, DEPTH);
      } else {
        if (d.bids && d.bids.length) applyBids(d.bids);
        if (d.asks && d.asks.length) applyAsks(d.asks);
      }
      emit();
    } catch (e) {
      console.warn('Kraken WS parse', e);
    }
  };
  ws.onerror = () => {};
  ws.onclose = () => {};

  return () => {
    if (ws) try { ws.close(); } catch (_) {}
  };
}

// --- Coinbase Advanced Trade (level2) ---
function startCoinbase(displaySymbol, onBook) {
  // Coinbase uses BTC-USD, ETH-USD (no USDT)
  const productId = displaySymbol.replace('/USDT', '-USD').replace('/', '-'); // BTC/USDT -> BTC-USD
  let ws = null;
  const orderbook = { bids: [], asks: [] };
  const DEPTH = 100;

  function apply(side, priceLevel, newQty) {
    const p = parseFloat(priceLevel);
    const q = parseFloat(newQty);
    const arr = side === 'bid' ? orderbook.bids : orderbook.asks;
    const i = arr.findIndex((x) => Math.abs(x[0] - p) < 1e-9);
    if (q === 0) {
      if (i >= 0) arr.splice(i, 1);
    } else {
      if (i >= 0) arr[i][1] = q;
      else arr.push([p, q]);
    }
    if (side === 'bid') {
      orderbook.bids.sort((a, b) => b[0] - a[0]);
      orderbook.bids.splice(DEPTH);
    } else {
      orderbook.asks.sort((a, b) => a[0] - b[0]);
      orderbook.asks.splice(DEPTH);
    }
  }

  function emit() {
    const { bids, asks } = toChartFormat(orderbook.bids, orderbook.asks);
    if (bids.length || asks.length) onBook('Coinbase', { bids, asks });
  }

  ws = new WebSocket('wss://advanced-trade-ws.coinbase.com');
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'level2', product_ids: [productId] }));
  };
  ws.onmessage = (ev) => {
    try {
      const j = JSON.parse(ev.data);
      const ch = j.channel;
      if (ch !== 'l2_data' && ch !== 'level2') return;
      (j.events || []).forEach((e) => {
        if (e.product_id !== productId) return;
        (e.updates || []).forEach((u) => apply(u.side, u.price_level, u.new_quantity));
      });
      emit();
    } catch (e) {
      console.warn('Coinbase WS parse', e);
    }
  };
  ws.onerror = () => {};
  ws.onclose = () => {};

  return () => {
    if (ws) try { ws.close(); } catch (_) {}
  };
}

/**
 * Start aggregating orderbooks from Binance, Kraken, and Coinbase.
 * @param {string} displaySymbol - e.g. "BTC/USDT" (Kraken/Binance). Coinbase gets "BTC-USD".
 * @param {function} onData - (data: { exchange, bids, asks }[]) => void
 * @returns {function} disconnect()
 */
function startMultiExchangeOrderbook(displaySymbol, onData) {
  const state = { Binance: null, Kraken: null, Coinbase: null };
  const unsub = [];

  function put(exchange, book) {
    state[exchange] = book;
    const list = Object.entries(state)
      .filter(([, b]) => b && (b.bids?.length || b.asks?.length))
      .map(([ex, b]) => ({ exchange: ex, bids: b.bids, asks: b.asks }));
    onData(list);
  }

  unsub.push(startBinance(displaySymbol, (ex, b) => put(ex, b)));
  unsub.push(startKraken(displaySymbol, (ex, b) => put(ex, b)));
  unsub.push(startCoinbase(displaySymbol, (ex, b) => put(ex, b)));

  return () => unsub.forEach((f) => f());
}

if (typeof window !== 'undefined') {
  window.startMultiExchangeOrderbook = startMultiExchangeOrderbook;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startMultiExchangeOrderbook };
}
