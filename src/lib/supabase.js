import { createClient } from '@supabase/supabase-js';

// These will be replaced with your actual Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Get current user
export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Trade operations
export const tradesApi = {
  // Get all trades
  async getAll() {
    if (!supabase) return { data: [], error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: [], error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
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
    
    const user = await getCurrentUser();
    if (!user) return { data: [], error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .gte('open_date', startDate)
      .lte('open_date', endDate)
      .order('open_date', { ascending: false });
    
    return { data: data || [], error };
  },

  // Create a new trade
  async create(trade) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    
    const tradeData = {
      user_id: user.id,
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
      fee: trade.fee != null ? trade.fee : 0,
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
    
    const user = await getCurrentUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    
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
      .eq('user_id', user.id)
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
    
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };
    
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    return { error };
  },

  // Update a trade
  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('trades')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    return { data, error };
  }
};

// Settings operations (for R value, etc.)
export const settingsApi = {
  async get() {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    return { data, error };
  },

  async upsert(settings) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    
    // First try to get existing settings
    const { data: existing } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('settings')
        .update(settings)
        .eq('user_id', user.id)
        .select()
        .single();
      return { data, error };
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('settings')
        .insert([{ user_id: user.id, ...settings }])
        .select()
        .single();
      return { data, error };
    }
  }
};

// Budget operations
export const budgetApi = {
  // Get all transactions
  async getAll() {
    if (!supabase) return { data: [], error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: [], error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('budget_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Supabase budget getAll error:', error);
    }
    
    return { data: data || [], error };
  },

  // Get transactions by date range
  async getByDateRange(startDate, endDate) {
    if (!supabase) return { data: [], error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: [], error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('budget_transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    
    return { data: data || [], error };
  },

  // Get transactions by category
  async getByCategory(category) {
    if (!supabase) return { data: [], error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: [], error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('budget_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', category)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    
    return { data: data || [], error };
  },

  // Create a new transaction
  async create(transaction) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    
    const transactionData = {
      user_id: user.id,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description || null,
      date: transaction.date || new Date().toISOString().split('T')[0],
    };
    
    const { data, error } = await supabase
      .from('budget_transactions')
      .insert([transactionData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating budget transaction in Supabase:', error);
    } else {
      console.log('✅ Budget transaction created in Supabase:', data?.id);
    }
    
    return { data, error };
  },

  // Update a transaction
  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: null, error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('budget_transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error updating budget transaction in Supabase:', error);
    }
    
    return { data, error };
  },

  // Delete a transaction
  async delete(id) {
    if (!supabase) return { error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };
    
    const { error } = await supabase
      .from('budget_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('❌ Error deleting budget transaction in Supabase:', error);
    }
    
    return { error };
  },

  // Get unique categories for user
  async getCategories() {
    if (!supabase) return { data: [], error: 'Supabase not configured' };
    
    const user = await getCurrentUser();
    if (!user) return { data: [], error: 'Not authenticated' };
    
    const { data, error } = await supabase
      .from('budget_transactions')
      .select('category, type')
      .eq('user_id', user.id);
    
    if (error) {
      return { data: [], error };
    }
    
    // Get unique categories
    const categories = [...new Set((data || []).map(t => t.category))];
    
    return { data: categories, error: null };
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
    fee: dbTrade.fee != null ? parseFloat(dbTrade.fee) : 0,
    comment: dbTrade.notes || '',
  };
  
  return converted;
}
