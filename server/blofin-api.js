import crypto from 'crypto';

const BLOFIN_BASE_URL = 'https://openapi.blofin.com';

/**
 * Blofin API Client
 * Handles authentication and API calls to Blofin exchange
 */
class BlofinAPI {
  constructor(apiKey, secretKey, passphrase) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.passphrase = passphrase;
  }

  /**
   * Generate a unique nonce for request
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate signature for authenticated requests
   * Blofin signature: timestamp + method + requestPath + body (+ nonce in some cases)
   */
  sign(timestamp, method, requestPath, body = '', nonce = '') {
    // The signature message format for Blofin
    const message = timestamp + method.toUpperCase() + requestPath + body;
    const hmac = crypto.createHmac('sha256', this.secretKey);
    return hmac.update(message).digest('base64');
  }

  /**
   * Make authenticated request to Blofin API
   */
  async request(method, path, body = null) {
    // Blofin requires millisecond timestamp
    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = this.sign(timestamp, method, path, bodyStr, nonce);

    const headers = {
      'ACCESS-KEY': this.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-NONCE': nonce,
      'ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
    };

    const options = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = bodyStr;
    }

    console.log(`📡 ${method} ${path}`);
    console.log('   Headers:', { ...headers, 'ACCESS-KEY': '***', 'ACCESS-SIGN': '***', 'ACCESS-PASSPHRASE': '***' });

    try {
      const response = await fetch(`${BLOFIN_BASE_URL}${path}`, options);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Blofin API Error:', error);
      throw error;
    }
  }

  // ============ Account Endpoints ============

  /**
   * Get asset balances (spot)
   */
  async getBalance(accountType = 'futures') {
    return this.request('GET', `/api/v1/asset/balances?accountType=${accountType}`);
  }

  /**
   * Get futures account balance
   */
  async getFuturesBalance() {
    return this.request('GET', '/api/v1/account/balance');
  }

  /**
   * Get current positions
   */
  async getPositions(instId = null) {
    let path = '/api/v1/account/positions';
    if (instId) {
      path += `?instId=${instId}`;
    }
    return this.request('GET', path);
  }

  // ============ Trading Endpoints ============

  /**
   * Place an order
   * @param {Object} order - Order parameters
   * @param {string} order.instId - Instrument ID (e.g., "BTC-USDT")
   * @param {string} order.marginMode - "cross" or "isolated"
   * @param {string} order.side - "buy" or "sell"
   * @param {string} order.orderType - "market" or "limit"
   * @param {string} order.size - Order size
   * @param {string} order.price - Price (required for limit orders)
   * @param {string} order.leverage - Leverage (e.g., "10")
   */
  async placeOrder(order) {
    return this.request('POST', '/api/v1/trade/order', order);
  }

  /**
   * Place order with stop loss and take profit
   */
  async placeOrderWithTPSL(order) {
    // Blofin might have a different endpoint for TP/SL orders
    // This creates a main order + conditional orders
    return this.request('POST', '/api/v1/trade/order', order);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(instId, orderId) {
    return this.request('POST', '/api/v1/trade/cancel-order', {
      instId,
      orderId,
    });
  }

  /**
   * Get open orders
   */
  async getOpenOrders(instId = null) {
    let path = '/api/v1/trade/orders-pending';
    if (instId) {
      path += `?instId=${instId}`;
    }
    return this.request('GET', path);
  }

  /**
   * Get order history
   */
  async getOrderHistory(instId = null, limit = 100) {
    let path = `/api/v1/trade/orders-history?limit=${limit}`;
    if (instId) {
      path += `&instId=${instId}`;
    }
    return this.request('GET', path);
  }

  /**
   * Get trade history (filled orders)
   */
  async getTradeHistory(instId = null, limit = 100) {
    // Use fills-history endpoint for historical trades
    let path = `/api/v1/trade/fills-history?limit=${limit}`;
    if (instId) {
      path += `&instId=${instId}`;
    }
    return this.request('GET', path);
  }

  // ============ Market Data Endpoints ============

  /**
   * Get ticker price
   */
  async getTicker(instId) {
    return this.request('GET', `/api/v1/market/ticker?instId=${instId}`);
  }

  /**
   * Get all tickers
   */
  async getAllTickers() {
    return this.request('GET', '/api/v1/market/tickers');
  }

  /**
   * Get instruments (trading pairs)
   */
  async getInstruments(instType = 'SWAP') {
    return this.request('GET', `/api/v1/market/instruments?instType=${instType}`);
  }

  // ============ Position Endpoints ============

  /**
   * Set leverage for an instrument
   */
  async setLeverage(instId, leverage, marginMode = 'cross') {
    return this.request('POST', '/api/v1/account/set-leverage', {
      instId,
      leverage: String(leverage),
      marginMode,
    });
  }

  /**
   * Close a position
   */
  async closePosition(instId, marginMode = 'cross') {
    return this.request('POST', '/api/v1/trade/close-position', {
      instId,
      marginMode,
    });
  }
}

export default BlofinAPI;
