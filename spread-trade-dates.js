// Script to spread out trade open and close dates across different months
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

// Spread out trade dates
async function spreadTradeDates() {
  console.log('🔍 Fetching all trades...');
  
  // Get all trades
  const { data: allTrades, error: fetchError } = await supabase
    .from('trades')
    .select('*')
    .order('open_date', { ascending: true });
  
  if (fetchError) {
    console.error('❌ Error fetching trades:', fetchError);
    process.exit(1);
  }
  
  if (!allTrades || allTrades.length === 0) {
    console.log('✅ No trades found!');
    return;
  }
  
  console.log(`📊 Found ${allTrades.length} trade(s)`);
  
  // Group trades by month to spread them out
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');
  const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  let updatedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < allTrades.length; i++) {
    const trade = allTrades[i];
    
    try {
      // Spread open dates across the year
      const dayOffset = Math.floor((i / allTrades.length) * totalDays);
      const newOpenDate = new Date(startDate);
      newOpenDate.setDate(newOpenDate.getDate() + dayOffset);
      
      // Add some randomness to avoid all trades on same day
      const randomOffset = Math.floor(Math.random() * 5) - 2; // -2 to +2 days
      newOpenDate.setDate(newOpenDate.getDate() + randomOffset);
      
      // Ensure date is within 2024
      if (newOpenDate < startDate) newOpenDate.setTime(startDate.getTime());
      if (newOpenDate > endDate) newOpenDate.setTime(endDate.getTime());
      
      let updateData = {
        open_date: newOpenDate.toISOString(),
      };
      
      // If trade is closed, set close date 1-7 days after open date
      if (trade.status === 'closed') {
        const closeDate = new Date(newOpenDate);
        const daysToClose = Math.floor(Math.random() * 7) + 1; // 1-7 days
        closeDate.setDate(closeDate.getDate() + daysToClose);
        
        // Ensure close date doesn't exceed end of year
        if (closeDate > endDate) {
          closeDate.setTime(endDate.getTime());
        }
        
        updateData.close_date = closeDate.toISOString();
      }
      
      // Update the trade
      const { error } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', trade.id);
      
      if (error) {
        console.error(`❌ Error updating trade ${trade.id} (${trade.symbol}):`, error);
        errorCount++;
      } else {
        const dateStr = newOpenDate.toISOString().split('T')[0];
        const closeStr = updateData.close_date ? new Date(updateData.close_date).toISOString().split('T')[0] : 'N/A';
        console.log(`✅ Updated: ${trade.symbol} - Open: ${dateStr}, Close: ${closeStr}`);
        updatedCount++;
      }
    } catch (err) {
      console.error(`❌ Exception updating trade ${trade.id}:`, err);
      errorCount++;
    }
  }
  
  console.log(`\n✨ Done! Updated ${updatedCount} trade(s)`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} trade(s) had errors`);
  }
  console.log('🔄 Refresh your app to see the updated dates.');
}

// Run the script
spreadTradeDates().catch(console.error);
