import { useState, useEffect, useRef } from 'react';
import { createPriceWebSocket, fetchCurrentPrice, formatSymbolForBinance } from '../lib/binance';

/**
 * Hook for managing live price updates via Binance WebSocket
 */
export function useLivePrice(symbol) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!symbol) {
      setPrice(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch initial price
    const binanceSymbol = formatSymbolForBinance(symbol);
    fetchCurrentPrice(binanceSymbol)
      .then(initialPrice => {
        if (initialPrice !== null) {
          setPrice(initialPrice);
          setLoading(false);
        } else {
          setError('Failed to fetch initial price');
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Error fetching initial price:', err);
        setError('Failed to fetch price');
        setLoading(false);
      });

    // Set up WebSocket for live updates
    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      wsRef.current = createPriceWebSocket(binanceSymbol, (newPrice) => {
        setPrice(newPrice);
        setLoading(false);
        setError(null);
      });
    } catch (err) {
      console.error('Error setting up WebSocket:', err);
      setError('Failed to connect to price stream');
      setLoading(false);
    }

    // Cleanup on unmount or symbol change
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol]);

  return { price, loading, error };
}
