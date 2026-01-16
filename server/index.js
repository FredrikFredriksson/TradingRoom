import express from 'express';
import cors from 'cors';
import BlofinAPI from './blofin-api.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Store credentials in memory (loaded from config file)
let credentials = null;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Load credentials from config file
function loadCredentials() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      credentials = JSON.parse(data);
      console.log('✅ Blofin credentials loaded');
      return true;
    }
  } catch (error) {
    console.error('Error loading credentials:', error);
  }
  return false;
}

// Save credentials to config file
function saveCredentials(creds) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(creds, null, 2));
    credentials = creds;
    console.log('✅ Blofin credentials saved');
    return true;
  } catch (error) {
    console.error('Error saving credentials:', error);
    return false;
  }
}

// Get Blofin API client
function getClient() {
  if (!credentials) {
    throw new Error('Blofin credentials not configured');
  }
  return new BlofinAPI(
    credentials.apiKey,
    credentials.secretKey,
    credentials.passphrase
  );
}

// ============ API Routes ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    configured: !!credentials,
    timestamp: new Date().toISOString()
  });
});

// Check if Blofin is configured
app.get('/api/blofin/status', (req, res) => {
  res.json({
    configured: !!credentials,
    hasApiKey: !!credentials?.apiKey,
    hasSecretKey: !!credentials?.secretKey,
    hasPassphrase: !!credentials?.passphrase,
  });
});

// Save Blofin credentials
app.post('/api/blofin/configure', (req, res) => {
  const { apiKey, secretKey, passphrase } = req.body;
  
  if (!apiKey || !secretKey || !passphrase) {
    return res.status(400).json({ 
      error: 'Missing required credentials (apiKey, secretKey, passphrase)' 
    });
  }

  const success = saveCredentials({ apiKey, secretKey, passphrase });
  
  if (success) {
    res.json({ success: true, message: 'Credentials saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

// Test connection
app.get('/api/blofin/test', async (req, res) => {
  try {
    const client = getClient();
    const result = await client.getBalance();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Account Routes ============

// Get balance
app.get('/api/blofin/balance', async (req, res) => {
  try {
    const client = getClient();
    const accountType = req.query.accountType || 'futures';
    
    // Try futures balance first
    console.log('📊 Fetching balance...');
    const futuresResult = await client.getFuturesBalance();
    console.log('📊 Futures balance response:', JSON.stringify(futuresResult, null, 2));
    
    // If futures returns data, use it
    if (futuresResult.code === '0' && futuresResult.data) {
      return res.json(futuresResult);
    }
    
    // Otherwise try asset balances
    const assetResult = await client.getBalance(accountType);
    console.log('📊 Asset balance response:', JSON.stringify(assetResult, null, 2));
    
    res.json(assetResult);
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get positions
app.get('/api/blofin/positions', async (req, res) => {
  try {
    const client = getClient();
    const result = await client.getPositions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Trading Routes ============

// Place order
app.post('/api/blofin/order', async (req, res) => {
  try {
    const client = getClient();
    const order = req.body;
    
    console.log('📤 Placing order:', order);
    const result = await client.placeOrder(order);
    console.log('📥 Order result:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
app.post('/api/blofin/cancel-order', async (req, res) => {
  try {
    const client = getClient();
    const { instId, orderId } = req.body;
    const result = await client.cancelOrder(instId, orderId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get open orders
app.get('/api/blofin/orders', async (req, res) => {
  try {
    const client = getClient();
    const { instId } = req.query;
    const result = await client.getOpenOrders(instId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close position
app.post('/api/blofin/close-position', async (req, res) => {
  try {
    const client = getClient();
    const { instId, marginMode } = req.body;
    const result = await client.closePosition(instId, marginMode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set leverage
app.post('/api/blofin/leverage', async (req, res) => {
  try {
    const client = getClient();
    const { instId, leverage, marginMode } = req.body;
    const result = await client.setLeverage(instId, leverage, marginMode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ History Routes ============

// Get order history
app.get('/api/blofin/order-history', async (req, res) => {
  try {
    const client = getClient();
    const { instId, limit } = req.query;
    const result = await client.getOrderHistory(instId, limit || 100);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trade history (fills)
app.get('/api/blofin/trade-history', async (req, res) => {
  try {
    const client = getClient();
    const { instId, limit } = req.query;
    
    console.log('📜 Fetching trade history...');
    const result = await client.getTradeHistory(instId, limit || 100);
    console.log('📜 Trade history response:', JSON.stringify(result, null, 2));
    
    res.json(result);
  } catch (error) {
    console.error('Trade history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ Market Data Routes ============

// Get ticker
app.get('/api/blofin/ticker', async (req, res) => {
  try {
    const client = getClient();
    const { instId } = req.query;
    if (!instId) {
      return res.status(400).json({ error: 'instId is required' });
    }
    const result = await client.getTicker(instId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tickers
app.get('/api/blofin/tickers', async (req, res) => {
  try {
    const client = getClient();
    const result = await client.getAllTickers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get instruments
app.get('/api/blofin/instruments', async (req, res) => {
  try {
    const client = getClient();
    const { instType } = req.query;
    const result = await client.getInstruments(instType || 'SWAP');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Start Server ============

// Load credentials on startup
loadCredentials();

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         TradingRoom Backend Server                     ║
╠════════════════════════════════════════════════════════╣
║  🚀 Server running on http://localhost:${PORT}            ║
║  📊 Blofin API: ${credentials ? '✅ Configured' : '❌ Not configured'}                     ║
╚════════════════════════════════════════════════════════╝
  `);
  
  if (!credentials) {
    console.log('⚠️  Configure your Blofin API credentials via POST /api/blofin/configure');
    console.log('   or create a config.json file in the server folder.\n');
  }
});
