import crypto from 'crypto';

const BLOFIN_BASE_URL = 'https://openapi.blofin.com';

class BlofinAPI {
  constructor(apiKey, secretKey, passphrase) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.passphrase = passphrase;
  }

  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  sign(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    const hmac = crypto.createHmac('sha256', this.secretKey);
    return hmac.update(message).digest('base64');
  }

  async request(method, path, body = null) {
    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = this.sign(timestamp, method, path, bodyStr);

    const headers = {
      'ACCESS-KEY': this.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-NONCE': nonce,
      'ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${BLOFIN_BASE_URL}${path}`, {
      method,
      headers,
      ...(body && method !== 'GET' ? { body: bodyStr } : {}),
    });

    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      const message =
        data.msg ||
        data.message ||
        `Blofin request failed with status ${response.status}`;
      throw new Error(message);
    }

    return data;
  }

  async getBalance(accountType = 'futures') {
    return this.request('GET', `/api/v1/asset/balances?accountType=${accountType}`);
  }

  async getFuturesBalance() {
    return this.request('GET', '/api/v1/account/balance');
  }

  async getPositions(instId = null) {
    const query = instId ? `?instId=${instId}` : '';
    return this.request('GET', `/api/v1/account/positions${query}`);
  }

  async placeOrder(order) {
    return this.request('POST', '/api/v1/trade/order', order);
  }

  async cancelOrder(instId, orderId) {
    return this.request('POST', '/api/v1/trade/cancel-order', {
      instId,
      orderId,
    });
  }

  async getOpenOrders(instId = null) {
    const query = instId ? `?instId=${instId}` : '';
    return this.request('GET', `/api/v1/trade/orders-pending${query}`);
  }

  async getOrderHistory(instId = null, limit = 100) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (instId) {
      query.set('instId', instId);
    }
    return this.request('GET', `/api/v1/trade/orders-history?${query.toString()}`);
  }

  async getTradeHistory(instId = null, limit = 100) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (instId) {
      query.set('instId', instId);
    }
    return this.request('GET', `/api/v1/trade/fills-history?${query.toString()}`);
  }

  async getTicker(instId) {
    return this.request('GET', `/api/v1/market/ticker?instId=${instId}`);
  }

  async getAllTickers() {
    return this.request('GET', '/api/v1/market/tickers');
  }

  async getInstruments(instType = 'SWAP') {
    return this.request('GET', `/api/v1/market/instruments?instType=${instType}`);
  }

  async setLeverage(instId, leverage, marginMode = 'cross') {
    return this.request('POST', '/api/v1/account/set-leverage', {
      instId,
      leverage: String(leverage),
      marginMode,
    });
  }

  async closePosition(instId, marginMode = 'cross') {
    return this.request('POST', '/api/v1/trade/close-position', {
      instId,
      marginMode,
    });
  }
}

export default BlofinAPI;
