// Script to delete all trades and regenerate with 2025 dates
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Try to load .env file
config();

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials not found!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const rValue = 100; // Default R value

// Generate random date
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Delete all trades and regenerate with 2025 dates
async function regenerateTrades() {
  console.log('🗑️  Deleting all existing trades...');
  
  // Delete all trades
  const { error: deleteError } = await supabase
    .from('trades')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (this condition is always true)
  
  if (deleteError) {
    console.error('❌ Error deleting trades:', deleteError);
    process.exit(1);
  }
  
  console.log('✅ All trades deleted');
  console.log('🚀 Generating new trades for 2025...');
  
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT'];
  const types = ['long', 'short'];
  const trades = [];
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-12-31');
  
  // Months that should be net losing (0-indexed: Jan=0, Feb=1, Mar=2, ... Aug=7)
  const losingMonths = [1, 2, 7]; // Feb, Mar, Aug 2025

  // Generate trades for each month to ensure activity across all months
  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(2025, month, 1);
    const monthEnd = new Date(2025, month + 1, 0); // Last day of month
    
    // Generate 10-15 trades per month
    const tradesPerMonth = 10 + Math.floor(Math.random() * 6);
    
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

      // All trades are closed
      const closeDate = new Date(openDate);
      const daysToClose = Math.floor(Math.random() * 7) + 1; // 1-7 days
      closeDate.setDate(closeDate.getDate() + daysToClose);
      
      // Ensure close date doesn't exceed month end
      if (closeDate > monthEnd) {
        closeDate.setTime(monthEnd.getTime());
      }

      // In losing months: bias R to -1.5..0 (net red). Else: -2R to +3R.
      let rMultiplier;
      if (losingMonths.includes(month)) {
        rMultiplier = -1.5 + Math.random() * 1.2; // roughly -1.5 to -0.3
      } else {
        rMultiplier = -2 + Math.random() * 5; // -2R to +3R
      }
      const rResult = parseFloat(rMultiplier.toFixed(2));
      const pnlDollar = parseFloat((rValue * rMultiplier).toFixed(2));

      let closePrice;
      if (type === 'long') {
        const priceChange = (pnlDollar / positionSize);
        closePrice = parseFloat((openPrice + priceChange).toFixed(2));
      } else {
        const priceChange = (pnlDollar / positionSize);
        closePrice = parseFloat((openPrice - priceChange).toFixed(2));
      }

      const pnlPercent = parseFloat(((pnlDollar / (positionSize * openPrice)) * 100).toFixed(2));

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
        close_date: closeDate.toISOString(),
        status: 'closed',
        pnl_percent: pnlPercent,
        pnl_dollar: pnlDollar,
        r_result: rResult,
        notes: rResult > 0 ? 'Good trade' : 'Stopped out',
      });
    }
  }

  trades.sort((a, b) => new Date(a.open_date) - new Date(b.open_date));

  console.log(`📊 Generated ${trades.length} trades`);
  console.log(`   All closed: ${trades.filter(t => t.status === 'closed').length}`);
  
  // Group by month to show distribution
  const byMonth = {};
  trades.forEach(trade => {
    const closeDate = new Date(trade.close_date);
    const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { count: 0, pnl: 0 };
    }
    byMonth[monthKey].count++;
    byMonth[monthKey].pnl += trade.pnl_dollar;
  });
  
  console.log('\n📅 Trades by month (close date):');
  Object.keys(byMonth).sort().forEach(month => {
    console.log(`   ${month}: ${byMonth[month].count} trades, P&L: $${byMonth[month].pnl.toFixed(2)}`);
  });

  // Insert trades in batches
  const batchSize = 20;
  let inserted = 0;
  
  for (let i = 0; i < trades.length; i += batchSize) {
    const batch = trades.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('trades')
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
    } else {
      inserted += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} trades (${inserted}/${trades.length})`);
    }
  }
  
  console.log(`\n✨ Done! Inserted ${inserted} trades into Supabase.`);
  console.log('🔄 Refresh your app to see the new test data.');
}

// Run the script
regenerateTrades().catch(console.error);
