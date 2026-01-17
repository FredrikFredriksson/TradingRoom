// Script to close all active trades
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

// Close all active trades
async function closeAllTrades() {
  console.log('🔍 Fetching all open trades...');
  
  // Get all open trades
  const { data: openTrades, error: fetchError } = await supabase
    .from('trades')
    .select('*')
    .eq('status', 'open');
  
  if (fetchError) {
    console.error('❌ Error fetching open trades:', fetchError);
    process.exit(1);
  }
  
  if (!openTrades || openTrades.length === 0) {
    console.log('✅ No open trades to close!');
    return;
  }
  
  console.log(`📊 Found ${openTrades.length} open trade(s)`);
  
  let closedCount = 0;
  let errorCount = 0;
  
  for (const trade of openTrades) {
    try {
      // Calculate a random P&L between -2R and +3R
      const rMultiplier = -2 + Math.random() * 5; // -2R to +3R
      const pnlDollar = parseFloat((rValue * rMultiplier).toFixed(2));
      
      // Calculate close price based on trade type
      let closePrice;
      if (trade.type === 'long') {
        const priceChange = (pnlDollar / parseFloat(trade.position_size));
        closePrice = parseFloat((parseFloat(trade.open_price) + priceChange).toFixed(2));
      } else {
        const priceChange = (pnlDollar / parseFloat(trade.position_size));
        closePrice = parseFloat((parseFloat(trade.open_price) - priceChange).toFixed(2));
      }
      
      // Calculate P&L percentage
      let pnlPercent;
      if (trade.type === 'long') {
        pnlPercent = ((closePrice - parseFloat(trade.open_price)) / parseFloat(trade.open_price)) * 100;
      } else {
        pnlPercent = ((parseFloat(trade.open_price) - closePrice) / parseFloat(trade.open_price)) * 100;
      }
      pnlPercent = parseFloat(pnlPercent.toFixed(2));
      
      // Calculate R result
      const rResult = parseFloat((pnlDollar / parseFloat(trade.risk_amount) * parseFloat(trade.risk_multiple)).toFixed(2));
      
      // Spread close dates across different months
      // Close trades at various dates after their open date (1-30 days later)
      const openDate = new Date(trade.open_date);
      const daysAfterOpen = Math.floor(Math.random() * 30) + 1; // 1-30 days
      const closeDateObj = new Date(openDate);
      closeDateObj.setDate(closeDateObj.getDate() + daysAfterOpen);
      
      // Ensure close date doesn't exceed today
      const today = new Date();
      if (closeDateObj > today) {
        closeDateObj.setTime(today.getTime());
      }
      
      const closeDate = closeDateObj.toISOString();
      const comment = rResult > 0 ? 'Auto-closed: Good trade' : 'Auto-closed: Stopped out';
      
      // Close the trade
      const { data, error } = await supabase
        .from('trades')
        .update({
          close_price: closePrice,
          close_date: closeDate,
          status: 'closed',
          pnl_percent: pnlPercent,
          pnl_dollar: pnlDollar,
          r_result: rResult,
          notes: comment,
        })
        .eq('id', trade.id)
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Error closing trade ${trade.id} (${trade.symbol}):`, error);
        errorCount++;
      } else {
        console.log(`✅ Closed: ${trade.symbol} ${trade.type} - ${pnlDollar >= 0 ? '+' : ''}$${pnlDollar.toFixed(2)} (${rResult >= 0 ? '+' : ''}${rResult.toFixed(2)}R)`);
        closedCount++;
      }
    } catch (err) {
      console.error(`❌ Exception closing trade ${trade.id}:`, err);
      errorCount++;
    }
  }
  
  console.log(`\n✨ Done! Closed ${closedCount} trade(s)`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} trade(s) had errors`);
  }
  console.log('🔄 Refresh your app to see the updated trades.');
}

// Run the script
closeAllTrades().catch(console.error);
