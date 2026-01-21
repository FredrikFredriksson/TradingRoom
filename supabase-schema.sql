-- TradingRoom Database Schema
-- Run this in your Supabase SQL Editor

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('long', 'short')),
  open_price DECIMAL(20, 8) NOT NULL,
  stop_loss DECIMAL(20, 8) NOT NULL,
  take_profit DECIMAL(20, 8),
  leverage INTEGER DEFAULT 1,
  position_size DECIMAL(20, 2) NOT NULL,
  risk_amount DECIMAL(20, 2) NOT NULL,
  risk_multiple DECIMAL(5, 2) DEFAULT 1,
  open_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  close_price DECIMAL(20, 8),
  close_date TIMESTAMPTZ,
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  pnl_percent DECIMAL(10, 4),
  pnl_dollar DECIMAL(20, 2),
  r_result DECIMAL(10, 4),
  fee DECIMAL(20, 4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (for R value, balance, and other configurations)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  r_value DECIMAL(20, 2) DEFAULT 100,
  balance DECIMAL(20, 2) DEFAULT 1000,
  default_leverage INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_trades_open_date ON trades(open_date);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for single user)
-- You can make these more restrictive if you add authentication later
CREATE POLICY "Allow all operations on trades" ON trades FOR ALL USING (true);
CREATE POLICY "Allow all operations on settings" ON settings FOR ALL USING (true);

-- Insert default settings
INSERT INTO settings (id, r_value, balance, default_leverage) 
VALUES (1, 100, 1000, 1) 
ON CONFLICT (id) DO NOTHING;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on trades
CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on settings
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
