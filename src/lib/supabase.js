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
    
    const { data, error } = await supabase
      .from('trades')
      .insert([{
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
        status: trade.status,
      }])
      .select()
      .single();
    
    return { data, error };
  },

  // Close a trade
  async closeTrade(id, closePrice, closeDate, pnlPercent, pnlDollar, rResult, comment = '') {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
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
      .eq('id', id)
      .select()
      .single();
    
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
  return {
    id: dbTrade.id,
    symbol: dbTrade.symbol,
    type: dbTrade.type,
    openPrice: dbTrade.open_price,
    stopLoss: dbTrade.stop_loss,
    takeProfit: dbTrade.take_profit,
    leverage: dbTrade.leverage,
    positionSize: dbTrade.position_size,
    riskAmount: dbTrade.risk_amount,
    riskMultiple: dbTrade.risk_multiple,
    openDate: dbTrade.open_date,
    closePrice: dbTrade.close_price,
    closeDate: dbTrade.close_date,
    status: dbTrade.status,
    pnlPercent: dbTrade.pnl_percent,
    pnlDollar: dbTrade.pnl_dollar,
    rResult: dbTrade.r_result,
    comment: dbTrade.notes || '',
  };
}
