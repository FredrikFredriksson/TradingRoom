// Script to generate and insert test trade data directly into Supabase
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env file
config();

// Get Supabase credentials from environment or .env.local
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials not found!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
  console.error('\nOr run this in your browser console while the app is open:');
  console.error('  generateTestTrades()');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate random date
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate test trades
async function generateTestTrades() {
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT'];
  const types = ['long', 'short'];
  const trades = [];
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');
  const rValue = 100; // Default R value

  console.log('🚀 Generating 120 test trades for all of 2024...');

  // Generate trades for each month to ensure activity across all months
  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(2024, month, 1);
    const monthEnd = new Date(2024, month + 1, 0); // Last day of month
    
    // Generate 8-12 trades per month
    const tradesPerMonth = 8 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < tradesPerMonth; i++) {
      const openDate = randomDate(monthStart, monthEnd);
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const leverage = [1, 2, 3, 5, 10][Math.floor(Math.random() * 5)];

      const basePrice = type === 'long' ? 40000 + Math.random() * 10000 : 3000 + Math.random() * 2000;
      const openPrice = parseFloat(basePrice.toFixed(2));

      const riskMultiple = 0.5 + Math.random() * 2.5;
      const riskAmount = rValue * riskMultiple;

      const stopLossPercent = 2 + Math.random() * 3;
      const stopLoss = type === 'long' 
        ? parseFloat((openPrice * (1 - stopLossPercent / 100)).toFixed(2))
        : parseFloat((openPrice * (1 + stopLossPercent / 100)).toFixed(2));

      const priceDiff = Math.abs(openPrice - stopLoss);
      const positionSize = parseFloat((riskAmount / priceDiff).toFixed(2));

      const isClosed = Math.random() > 0.15; // 85% closed

      let closePrice = null;
      let closeDate = null;
      let pnlPercent = null;
      let pnlDollar = null;
      let rResult = null;
      let status = 'open';

      if (isClosed) {
        closeDate = new Date(openDate);
        closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * 7) + 1);
        // Ensure close date doesn't exceed month end
        if (closeDate > monthEnd) {
          closeDate = new Date(monthEnd);
        }

        const rMultiplier = -2 + Math.random() * 5; // -2R to +3R
        rResult = parseFloat(rMultiplier.toFixed(2));
        pnlDollar = parseFloat((rValue * rMultiplier).toFixed(2));

        if (type === 'long') {
          const priceChange = (pnlDollar / positionSize);
          closePrice = parseFloat((openPrice + priceChange).toFixed(2));
        } else {
          const priceChange = (pnlDollar / positionSize);
          closePrice = parseFloat((openPrice - priceChange).toFixed(2));
        }

        pnlPercent = parseFloat(((pnlDollar / (positionSize * openPrice)) * 100).toFixed(2));
        status = 'closed';
      }

      trades.push({
        symbol,
        type,
        open_price: openPrice,
        stop_loss: stopLoss,
        take_profit: null,
        leverage,
        position_size: positionSize,
        risk_amount: riskAmount,
        risk_multiple: parseFloat(riskMultiple.toFixed(2)),
        open_date: openDate.toISOString(),
        close_price: closePrice,
        close_date: closeDate ? closeDate.toISOString() : null,
        status,
        pnl_percent: pnlPercent,
        pnl_dollar: pnlDollar,
        r_result: rResult,
        notes: isClosed ? (rResult > 0 ? 'Good trade' : 'Stopped out') : '',
      });
    }
  }

  trades.sort((a, b) => new Date(a.open_date) - new Date(b.open_date));

  console.log(`📊 Generated ${trades.length} trades`);
  console.log(`   Open: ${trades.filter(t => t.status === 'open').length}`);
  console.log(`   Closed: ${trades.filter(t => t.status === 'closed').length}`);

  // Insert trades
  const { data, error } = await supabase
    .from('trades')
    .insert(trades)
    .select();

  if (error) {
    console.error('❌ Error inserting trades:', error);
    process.exit(1);
  } else {
    console.log(`✅ Successfully inserted ${data?.length || 0} trades!`);
    console.log('🔄 Refresh your app to see the test data.');
  }
}

// Run the script
generateTestTrades().catch(console.error);
