import { createClient } from '@supabase/supabase-js';

// These will be replaced with your actual Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Trade operations
export const tradesApi = {
  // Get all trades
  async getAll() {
    if (!supabase) return { data: [], error: 'Supabase not configured' };
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('open_date', { ascending: false });
    
    if (error) {
      console.error('❌ Supabase getAll error:', error);
    } else {
      console.log('📥 Raw trades from Supabase:', data?.length || 0, 'trades');
      if (data && data.length > 0) {
        console.log('📋 First trade raw data:', data[0]);
      }
    }
    
    return { data: data || [], error };
  },

  // Get trades by date range
  async getByDateRange(startDate, endDate) {
    if (!supabase) return { data: [], error: 'Supabase not configured' };
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .gte('open_date', startDate)
      .lte('open_date', endDate)
      .order('open_date', { ascending: false });
    
    return { data: data || [], error };
  },

  // Create a new trade
  async create(trade) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const tradeData = {
      symbol: trade.symbol,
      type: trade.type,
      open_price: trade.openPrice,
      stop_loss: trade.stopLoss,
      take_profit: trade.takeProfit,
      leverage: trade.leverage,
      position_size: trade.positionSize,
      risk_amount: trade.riskAmount,
      risk_multiple: trade.riskMultiple,
      open_date: trade.openDate,
      status: trade.status || 'open',
    };
    
    console.log('💾 Creating trade in Supabase:', tradeData);
    
    const { data, error } = await supabase
      .from('trades')
      .insert([tradeData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating trade in Supabase:', error);
    } else {
      console.log('✅ Trade created in Supabase:', data?.id);
    }
    
    return { data, error };
  },

  // Close a trade
  async closeTrade(id, closePrice, closeDate, pnlPercent, pnlDollar, rResult, comment = '') {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const updateData = {
      close_price: closePrice,
      close_date: closeDate,
      status: 'closed',
      pnl_percent: pnlPercent,
      pnl_dollar: pnlDollar,
      r_result: rResult,
      notes: comment || '',
    };
    
    console.log('💾 Closing trade in Supabase:', { id, ...updateData });
    
    const { data, error } = await supabase
      .from('trades')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error closing trade in Supabase:', error);
      console.error('Update query details:', { id, updateData });
    } else {
      console.log('✅ Trade closed in Supabase:', data?.id, 'Status:', data?.status);
    }
    
    return { data, error };
  },

  // Delete a trade
  async delete(id) {
    if (!supabase) return { error: 'Supabase not configured' };
    
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id);
    
    return { error };
  },

  // Update a trade
  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const { data, error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  }
};

// Settings operations (for R value, etc.)
export const settingsApi = {
  async get() {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();
    
    return { data, error };
  },

  async upsert(settings) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const { data, error } = await supabase
      .from('settings')
      .upsert([{ id: 1, ...settings }])
      .select()
      .single();
    
    return { data, error };
  }
};

// Helper to convert Supabase trade format to app format
export function dbToAppTrade(dbTrade) {
  if (!dbTrade) {
    console.error('❌ dbToAppTrade: dbTrade is null or undefined');
    return null;
  }
  
  const converted = {
    id: dbTrade.id,
    symbol: dbTrade.symbol || '',
    type: dbTrade.type || 'long',
    openPrice: parseFloat(dbTrade.open_price) || 0,
    stopLoss: parseFloat(dbTrade.stop_loss) || 0,
    takeProfit: dbTrade.take_profit ? parseFloat(dbTrade.take_profit) : null,
    leverage: parseFloat(dbTrade.leverage) || 1,
    positionSize: parseFloat(dbTrade.position_size) || 0,
    riskAmount: parseFloat(dbTrade.risk_amount) || 0,
    riskMultiple: parseFloat(dbTrade.risk_multiple) || 1,
    openDate: dbTrade.open_date || new Date().toISOString(),
    closePrice: dbTrade.close_price ? parseFloat(dbTrade.close_price) : null,
    closeDate: dbTrade.close_date || null,
    status: (dbTrade.status || 'open').toLowerCase(), // Ensure lowercase for consistency
    pnlPercent: dbTrade.pnl_percent ? parseFloat(dbTrade.pnl_percent) : null,
    pnlDollar: dbTrade.pnl_dollar ? parseFloat(dbTrade.pnl_dollar) : null,
    rResult: dbTrade.r_result ? parseFloat(dbTrade.r_result) : null,
    comment: dbTrade.notes || '',
  };
  
  return converted;
}
