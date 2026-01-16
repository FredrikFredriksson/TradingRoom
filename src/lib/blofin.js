/**
 * Blofin API Client for Frontend
 * Communicates with the backend server which handles secure API calls
 */

const API_BASE = 'http://localhost:3001/api/blofin';

class BlofinClient {
  constructor() {
    this.configured = false;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error(`Blofin API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // ============ Configuration ============

  async checkStatus() {
    return this.request('/status');
  }

  async configure(apiKey, secretKey, passphrase) {
    return this.request('/configure', {
      method: 'POST',
      body: JSON.stringify({ apiKey, secretKey, passphrase }),
    });
  }

  async testConnection() {
    return this.request('/test');
  }

  // ============ Account ============

  async getBalance() {
    const result = await this.request('/balance');
    return this.parseBalanceResponse(result);
  }

  async getPositions() {
    const result = await this.request('/positions');
    return this.parsePositionsResponse(result);
  }

  // ============ Trading ============

  async placeOrder(order) {
    return this.request('/order', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async cancelOrder(instId, orderId) {
    return this.request('/cancel-order', {
      method: 'POST',
      body: JSON.stringify({ instId, orderId }),
    });
  }

  async closePosition(instId, marginMode = 'cross') {
    return this.request('/close-position', {
      method: 'POST',
      body: JSON.stringify({ instId, marginMode }),
    });
  }

  async setLeverage(instId, leverage, marginMode = 'cross') {
    return this.request('/leverage', {
      method: 'POST',
      body: JSON.stringify({ instId, leverage, marginMode }),
    });
  }

  async getOpenOrders(instId = null) {
    const query = instId ? `?instId=${instId}` : '';
    return this.request(`/orders${query}`);
  }

  // ============ History ============

  async getOrderHistory(instId = null, limit = 100) {
    let query = `?limit=${limit}`;
    if (instId) query += `&instId=${instId}`;
    return this.request(`/order-history${query}`);
  }

  async getTradeHistory(instId = null, limit = 100) {
    let query = `?limit=${limit}`;
    if (instId) query += `&instId=${instId}`;
    const result = await this.request(`/trade-history${query}`);
    return this.parseTradeHistoryResponse(result);
  }

  // ============ Market Data ============

  async getTicker(instId) {
    return this.request(`/ticker?instId=${instId}`);
  }

  async getAllTickers() {
    return this.request('/tickers');
  }

  async getInstruments(instType = 'SWAP') {
    return this.request(`/instruments?instType=${instType}`);
  }

  // ============ Response Parsers ============

  parseBalanceResponse(response) {
    // Parse Blofin balance response to a simpler format
    console.log('Parsing balance response:', response);
    
    if (response.code !== '0' || !response.data) {
      console.warn('Balance response error:', response);
      return { totalBalance: 0, availableBalance: 0, currency: 'USDT' };
    }

    const balances = Array.isArray(response.data) ? response.data : [response.data];
    
    // Try to find USDT balance
    let usdtBalance = balances.find(b => 
      b.currency === 'USDT' || b.ccy === 'USDT' || b.coin === 'USDT'
    );
    
    // If no USDT found, use the first balance
    if (!usdtBalance && balances.length > 0) {
      usdtBalance = balances[0];
    }
    
    // Handle different response structures
    const total = parseFloat(
      usdtBalance?.equity || 
      usdtBalance?.totalEquity ||
      usdtBalance?.balance || 
      usdtBalance?.totalBalance ||
      usdtBalance?.availBal ||
      0
    );
    
    const available = parseFloat(
      usdtBalance?.availableBalance || 
      usdtBalance?.available || 
      usdtBalance?.availBal ||
      usdtBalance?.availEq ||
      total
    );
    
    console.log('Parsed balance:', { total, available, raw: usdtBalance });
    
    return {
      totalBalance: total,
      availableBalance: available,
      frozenBalance: parseFloat(usdtBalance?.frozenBalance || usdtBalance?.frozenBal || 0),
      unrealizedPnL: parseFloat(usdtBalance?.unrealizedPnl || usdtBalance?.upl || 0),
      currency: usdtBalance?.currency || usdtBalance?.ccy || 'USDT',
      raw: usdtBalance,
    };
  }

  parsePositionsResponse(response) {
    if (response.code !== '0' || !response.data) {
      console.warn('Positions response error:', response);
      return [];
    }

    return response.data.map(pos => ({
      instId: pos.instId,
      symbol: pos.instId?.replace('-USDT', '') || pos.instId,
      side: pos.posSide === 'long' ? 'long' : 'short',
      size: parseFloat(pos.pos || 0),
      avgPrice: parseFloat(pos.avgPx || 0),
      markPrice: parseFloat(pos.markPx || 0),
      liquidationPrice: parseFloat(pos.liqPx || 0),
      leverage: parseFloat(pos.lever || 1),
      marginMode: pos.marginMode || 'cross',
      unrealizedPnL: parseFloat(pos.upl || 0),
      unrealizedPnLPercent: parseFloat(pos.uplRatio || 0) * 100,
      margin: parseFloat(pos.margin || 0),
      raw: pos,
    }));
  }

  parseTradeHistoryResponse(response) {
    console.log('Parsing trade history response:', response);
    
    if (response.code !== '0' || !response.data) {
      console.warn('Trade history response error:', response);
      return [];
    }

    const trades = Array.isArray(response.data) ? response.data : [];
    console.log(`Found ${trades.length} trades in response`);

    return trades.map(trade => ({
      id: trade.tradeId || trade.billId || trade.orderId || `${trade.instId}-${trade.ts}`,
      instId: trade.instId,
      symbol: trade.instId?.replace('-USDT', '').replace('-SWAP', '') || trade.instId,
      side: trade.side,
      posSide: trade.posSide,
      price: parseFloat(trade.fillPx || trade.px || trade.avgPx || trade.price || 0),
      size: parseFloat(trade.fillSz || trade.sz || trade.size || 0),
      pnl: parseFloat(trade.pnl || trade.realizedPnl || 0),
      fee: parseFloat(trade.fee || trade.commission || 0),
      timestamp: trade.ts 
        ? new Date(parseInt(trade.ts)).toISOString() 
        : (trade.cTime || trade.createTime || new Date().toISOString()),
      raw: trade,
    }));
  }

  // ============ Helper Methods ============

  /**
   * Convert TradingRoom trade format to Blofin order format
   */
  formatOrder(trade) {
    // Convert symbol to Blofin format (e.g., "BTC" -> "BTC-USDT")
    const instId = trade.symbol.includes('-') ? trade.symbol : `${trade.symbol}-USDT`;
    
    return {
      instId,
      marginMode: 'cross',
      side: trade.type === 'long' ? 'buy' : 'sell',
      orderType: 'market', // or 'limit' if price specified
      size: String(trade.positionSize),
      leverage: String(trade.leverage || 1),
      // For limit orders:
      // price: String(trade.openPrice),
    };
  }

  /**
   * Convert Blofin position to TradingRoom trade format
   */
  positionToTrade(position, rValue = 100) {
    const riskAmount = rValue; // Default 1R
    return {
      id: `blofin_${position.instId}_${Date.now()}`,
      symbol: position.symbol,
      type: position.side,
      openPrice: position.avgPrice,
      stopLoss: null, // Blofin doesn't always provide this
      takeProfit: null,
      leverage: position.leverage,
      positionSize: Math.abs(position.size) * position.avgPrice,
      riskAmount: riskAmount,
      riskMultiple: 1,
      openDate: new Date().toISOString(),
      status: 'open',
      blofinPosition: position, // Keep original data
    };
  }
}

// Export singleton instance
export const blofinClient = new BlofinClient();
export default BlofinClient;
