import { useState, useEffect, useRef, useMemo } from 'react';
import { createPriceWebSocket, fetchCurrentPrice, formatSymbolForBinance } from '../lib/binance';

/**
 * Hook for calculating total unrealized P&L from open trades
 * Tracks live prices for all unique symbols in open trades
 */
export function useUnrealizedPnL(openTrades) {
  const [prices, setPrices] = useState({}); // symbol -> price
  const [loading, setLoading] = useState(true);
  const wsRefs = useRef({}); // symbol -> WebSocket

  // Get unique symbols from open trades (memoized)
  const uniqueSymbols = useMemo(() => {
    return openTrades
      .map(t => t.symbol)
      .filter((symbol, index, self) => self.indexOf(symbol) === index);
  }, [openTrades]);

  // Create a stable string key for the dependency
  const symbolsKey = useMemo(() => uniqueSymbols.sort().join(','), [uniqueSymbols]);

  // Fetch initial prices and set up WebSockets for all symbols
  useEffect(() => {
    if (uniqueSymbols.length === 0) {
      setPrices({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const newPrices = {};

    // Fetch initial prices for all symbols
    (async () => {
      try {
        const pricePromises = uniqueSymbols.map(async (symbol) => {
          try {
            const binanceSymbol = formatSymbolForBinance(symbol);
            const price = await fetchCurrentPrice(binanceSymbol);
            return { symbol, price };
          } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error);
            return { symbol, price: null };
          }
        });

        const results = await Promise.all(pricePromises);
        results.forEach(({ symbol, price }) => {
          if (price !== null) {
            newPrices[symbol] = price;
          }
        });

        setPrices(newPrices);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching prices:', error);
        setPrices(newPrices);
        setLoading(false);
      }
    })();

    // Set up WebSockets for real-time updates
    uniqueSymbols.forEach((symbol) => {
      // Close existing WebSocket for this symbol
      if (wsRefs.current[symbol]) {
        wsRefs.current[symbol].close();
        delete wsRefs.current[symbol];
      }

      try {
        const binanceSymbol = formatSymbolForBinance(symbol);
        wsRefs.current[symbol] = createPriceWebSocket(binanceSymbol, (newPrice) => {
          setPrices(prev => ({
            ...prev,
            [symbol]: newPrice
          }));
        });
      } catch (error) {
        console.error(`Error setting up WebSocket for ${symbol}:`, error);
      }
    });

    // Cleanup: close all WebSockets
    return () => {
      Object.values(wsRefs.current).forEach(ws => {
        if (ws) ws.close();
      });
      wsRefs.current = {};
    };
  }, [symbolsKey]); // Re-run when symbols change

  // Calculate total unrealized P&L
  const totalUnrealizedPnL = openTrades.reduce((total, trade) => {
    const currentPrice = prices[trade.symbol];
    if (!currentPrice) return total;

    let pnlPercent;
    if (trade.type === 'long') {
      pnlPercent = ((currentPrice - trade.openPrice) / trade.openPrice) * 100;
    } else {
      pnlPercent = ((trade.openPrice - currentPrice) / trade.openPrice) * 100;
    }

    const pnlDollar = trade.positionSize * (pnlPercent / 100);
    return total + pnlDollar;
  }, 0);

  return { totalUnrealizedPnL, prices, loading };
}
