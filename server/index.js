import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import BlofinAPI from './blofin-api.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function readCredentials() {
  return {
    apiKey: process.env.BLOFIN_API_KEY || '',
    secretKey: process.env.BLOFIN_SECRET_KEY || '',
    passphrase: process.env.BLOFIN_PASSPHRASE || '',
  };
}

function isConfigured() {
  const credentials = readCredentials();
  return Boolean(credentials.apiKey && credentials.secretKey && credentials.passphrase);
}

function getClient() {
  if (!isConfigured()) {
    throw new Error(
      'Blofin credentials are not configured. Add BLOFIN_API_KEY, BLOFIN_SECRET_KEY, and BLOFIN_PASSPHRASE to server/.env.'
    );
  }

  const credentials = readCredentials();
  return new BlofinAPI(credentials.apiKey, credentials.secretKey, credentials.passphrase);
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unexpected server error' });
    }
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    configured: isConfigured(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/blofin/status', (_req, res) => {
  const credentials = readCredentials();

  res.json({
    configured: isConfigured(),
    hasApiKey: Boolean(credentials.apiKey),
    hasSecretKey: Boolean(credentials.secretKey),
    hasPassphrase: Boolean(credentials.passphrase),
  });
});

app.get(
  '/api/blofin/test',
  asyncRoute(async (_req, res) => {
    const client = getClient();
    const result = await client.getBalance();
    res.json({ success: true, data: result });
  })
);

app.get(
  '/api/blofin/balance',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const accountType = req.query.accountType || 'futures';
    const futuresResult = await client.getFuturesBalance();

    if (futuresResult.code === '0' && futuresResult.data) {
      res.json(futuresResult);
      return;
    }

    res.json(await client.getBalance(accountType));
  })
);

app.get(
  '/api/blofin/positions',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const instId = req.query.instId || null;
    res.json(await client.getPositions(instId));
  })
);

app.post(
  '/api/blofin/order',
  asyncRoute(async (req, res) => {
    const client = getClient();
    res.json(await client.placeOrder(req.body));
  })
);

app.post(
  '/api/blofin/cancel-order',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const { instId, orderId } = req.body;
    res.json(await client.cancelOrder(instId, orderId));
  })
);

app.get(
  '/api/blofin/orders',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const instId = req.query.instId || null;
    res.json(await client.getOpenOrders(instId));
  })
);

app.post(
  '/api/blofin/close-position',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const { instId, marginMode } = req.body;
    res.json(await client.closePosition(instId, marginMode));
  })
);

app.post(
  '/api/blofin/leverage',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const { instId, leverage, marginMode } = req.body;
    res.json(await client.setLeverage(instId, leverage, marginMode));
  })
);

app.get(
  '/api/blofin/order-history',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const instId = req.query.instId || null;
    const limit = Number(req.query.limit || 100);
    res.json(await client.getOrderHistory(instId, limit));
  })
);

app.get(
  '/api/blofin/trade-history',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const instId = req.query.instId || null;
    const limit = Number(req.query.limit || 100);
    res.json(await client.getTradeHistory(instId, limit));
  })
);

app.get(
  '/api/blofin/ticker',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const instId = req.query.instId;

    if (!instId) {
      res.status(400).json({ error: 'instId is required' });
      return;
    }

    res.json(await client.getTicker(instId));
  })
);

app.get(
  '/api/blofin/tickers',
  asyncRoute(async (_req, res) => {
    const client = getClient();
    res.json(await client.getAllTickers());
  })
);

app.get(
  '/api/blofin/instruments',
  asyncRoute(async (req, res) => {
    const client = getClient();
    const instType = req.query.instType || 'SWAP';
    res.json(await client.getInstruments(instType));
  })
);

app.listen(PORT, () => {
  console.log(`TradingRoom Blofin example server listening on http://localhost:${PORT}`);
  if (!isConfigured()) {
    console.log('Blofin env vars are not set. See server/.env.example and server/README.md.');
  }
});
