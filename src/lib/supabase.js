import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function getCurrentUser() {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export const tradesApi = {
  async getAll() {
    if (!supabase) return { data: [], error: 'Supabase not configured' };

    const user = await getCurrentUser();
    if (!user) return { data: [], error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('open_date', { ascending: false });

    return { data: data || [], error };
  },

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

    const { data, error } = await supabase
      .from('trades')
      .insert([tradeData])
      .select()
      .single();

    return { data, error };
  },

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
      notes: comment,
    };

    const { data, error } = await supabase
      .from('trades')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    return { data, error };
  },

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
  },
};

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

    const { data: existing } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('settings')
        .update(settings)
        .eq('user_id', user.id)
        .select()
        .single();

      return { data, error };
    }

    const { data, error } = await supabase
      .from('settings')
      .insert([{ user_id: user.id, ...settings }])
      .select()
      .single();

    return { data, error };
  },
};

export function dbToAppTrade(dbTrade) {
  if (!dbTrade) {
    return null;
  }

  return {
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
    status: (dbTrade.status || 'open').toLowerCase(),
    pnlPercent: dbTrade.pnl_percent ? parseFloat(dbTrade.pnl_percent) : null,
    pnlDollar: dbTrade.pnl_dollar ? parseFloat(dbTrade.pnl_dollar) : null,
    rResult: dbTrade.r_result ? parseFloat(dbTrade.r_result) : null,
    fee: dbTrade.fee != null ? parseFloat(dbTrade.fee) : 0,
    comment: dbTrade.notes || '',
  };
}
