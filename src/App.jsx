import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Zap, AlertTriangle } from 'lucide-react';
import Header from './components/Header';
import PositionSizer from './components/PositionSizer';
import ActiveTrades from './components/ActiveTrades';
import TradingJournal from './components/TradingJournal';
// import Analytics from './components/Analytics';
import { supabase, tradesApi, settingsApi, dbToAppTrade } from './lib/supabase';
import './App.css';

function App() {
  // R value configuration (how much $ equals 1R)
  const [rValue, setRValue] = useState(() => {
    const saved = localStorage.getItem('tradingRoom_rValue');
    return saved ? parseFloat(saved) : 100;
  });

  // Account balance
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('tradingRoom_balance');
    return saved ? parseFloat(saved) : 1000;
  });

  // All trades (both open and closed)
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  // Active tab (Analytics commented out for now: 'analytics' | 'dashboard' | 'trade')
  const [activeTab, setActiveTab] = useState('dashboard');

  // Check Supabase connection and load initial data
  useEffect(() => {
    const initializeData = async () => {
      if (supabase) {
        setSupabaseConnected(true);
        
        // Load settings (R value and balance)
        const { data: settings } = await settingsApi.get();
        if (settings?.r_value) {
          setRValue(settings.r_value);
        }
        if (settings?.balance !== undefined && settings?.balance !== null) {
          setBalance(settings.balance);
        }
        
        // Load all trades from Supabase
        const { data: dbTrades, error } = await tradesApi.getAll();
        if (!error && dbTrades && dbTrades.length > 0) {
          const convertedTrades = dbTrades.map(dbToAppTrade).filter(t => t !== null);
          setTrades(convertedTrades);
          console.log(`✅ Loaded ${convertedTrades.length} trades from Supabase`);
        } else if (error) {
          console.error('❌ Error loading trades from Supabase:', error);
        } else {
          console.log('⚠️ No trades found in Supabase (this is normal if you haven\'t created any yet)');
        }
      } else {
        // Fall back to localStorage if Supabase is not configured
        const saved = localStorage.getItem('tradingRoom_trades');
        if (saved) {
          try {
            const parsedTrades = JSON.parse(saved);
            setTrades(parsedTrades);
            console.log(`📦 Loaded ${parsedTrades.length} trades from localStorage`);
          } catch (e) {
            console.error('❌ Error parsing saved trades:', e);
          }
        }
      }
      setLoading(false);
    };

    initializeData();
  }, []);

  // Persist R value
  useEffect(() => {
    localStorage.setItem('tradingRoom_rValue', rValue.toString());
    
    if (supabaseConnected) {
      settingsApi.upsert({ r_value: rValue });
    }
  }, [rValue, supabaseConnected]);

  // Persist balance
  useEffect(() => {
    localStorage.setItem('tradingRoom_balance', balance.toString());
    
    if (supabaseConnected) {
      settingsApi.upsert({ balance: balance });
    }
  }, [balance, supabaseConnected]);

  // Persist trades to localStorage as backup
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('tradingRoom_trades', JSON.stringify(trades));
    }
  }, [trades, loading]);

  // Handle new trade
  const handleNewTrade = useCallback(async (trade) => {
    // Ensure we have today's date
    const tradeWithDate = {
      ...trade,
      openDate: trade.openDate || new Date().toISOString(),
    };

    if (supabaseConnected) {
      try {
        const { data, error } = await tradesApi.create(tradeWithDate);
        if (!error && data) {
          // Trade successfully saved to Supabase
          setTrades(prev => [dbToAppTrade(data), ...prev]);
          console.log('✅ Trade saved to Supabase:', data.id);
        } else {
          console.error('❌ Error creating trade in Supabase:', error);
          // Fallback: save locally
          setTrades(prev => [{ ...tradeWithDate, id: Date.now() }, ...prev]);
        }
      } catch (err) {
        console.error('❌ Exception creating trade:', err);
        // Fallback: save locally
        setTrades(prev => [{ ...tradeWithDate, id: Date.now() }, ...prev]);
      }
    } else {
      // Supabase not connected, save locally only
      setTrades(prev => [{ ...tradeWithDate, id: Date.now() }, ...prev]);
    }
    
    setActiveTab('trade');
  }, [supabaseConnected]);

  // Handle closing a trade
  const handleCloseTrade = useCallback(async (tradeId, closePrice, comment = '') => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) {
      console.error('❌ Trade not found for ID:', tradeId);
      console.log('Available trade IDs:', trades.map(t => t.id));
      return;
    }
    
    console.log('🔄 Closing trade:', { tradeId, symbol: trade.symbol, currentStatus: trade.status });

    // Calculate P&L
    let pnlPercent;
    if (trade.type === 'long') {
      pnlPercent = ((closePrice - trade.openPrice) / trade.openPrice) * 100;
    } else {
      pnlPercent = ((trade.openPrice - closePrice) / trade.openPrice) * 100;
    }

    const pnlDollar = trade.positionSize * (pnlPercent / 100);
    const rResult = pnlDollar / trade.riskAmount * trade.riskMultiple;
    const closeDate = new Date().toISOString();

    if (supabaseConnected) {
      try {
        const { data, error } = await tradesApi.closeTrade(
          tradeId,
          closePrice,
          closeDate,
          pnlPercent,
          pnlDollar,
          rResult,
          comment
        );

        if (!error && data) {
          // Trade successfully closed and saved to Supabase
          const updatedTrade = dbToAppTrade(data);
          console.log('✅ Trade closed and saved to Supabase:', {
            tradeId,
            updatedStatus: updatedTrade.status,
            pnlDollar: updatedTrade.pnlDollar,
            closePrice: updatedTrade.closePrice
          });
          setTrades(prev => prev.map(t => 
            t.id === tradeId ? updatedTrade : t
          ));
        } else {
          console.error('❌ Error closing trade in Supabase:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          updateTradeLocally();
        }
      } catch (err) {
        console.error('❌ Exception closing trade:', err);
        updateTradeLocally();
      }
    } else {
      // Supabase not connected, update locally only
      updateTradeLocally();
    }

    function updateTradeLocally() {
      setTrades(prev => prev.map(t => {
        if (t.id !== tradeId) return t;
        return {
          ...t,
          closePrice,
          closeDate,
          status: 'closed',
          pnlPercent,
          pnlDollar,
          rResult,
          comment,
        };
      }));
    }

    // Update balance with the P&L (this will automatically save to Supabase via useEffect)
    setBalance(prev => {
      const newBalance = prev + pnlDollar;
      console.log(`💰 Balance updated: $${prev.toFixed(2)} → $${newBalance.toFixed(2)} (${pnlDollar >= 0 ? '+' : ''}$${pnlDollar.toFixed(2)})`);
      return newBalance;
    });
  }, [trades, supabaseConnected]);

  // Handle deleting a trade
  const handleDeleteTrade = useCallback(async (tradeId) => {
    if (supabaseConnected) {
      const { error } = await tradesApi.delete(tradeId);
      if (error) {
        console.error('Error deleting trade:', error);
      } else {
        console.log('✅ Trade deleted from Supabase:', tradeId);
      }
    }
    setTrades(prev => prev.filter(t => t.id !== tradeId));
  }, [supabaseConnected]);

  // Handle updating a trade (e.g. fee)
  const handleUpdateTrade = useCallback(async (tradeId, updates) => {
    if (supabaseConnected) {
      const { data, error } = await tradesApi.update(tradeId, updates);
      if (error) {
        console.error('Error updating trade:', error);
      } else if (data) {
        setTrades(prev => prev.map(t => t.id === tradeId ? dbToAppTrade(data) : t));
      }
    } else {
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, ...updates } : t));
    }
  }, [supabaseConnected]);

  const openTrades = trades.filter(t => t.status === 'open');

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loader">
          <div className="spinner"></div>
          <p>Loading TradingRoom...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-bg"></div>
      
      <div className="app-container">
        <Header 
          rValue={rValue} 
          onRValueChange={setRValue}
          balance={balance}
          onBalanceChange={setBalance}
          supabaseConnected={supabaseConnected}
        />

        {/* Connection Warning */}
        {!supabaseConnected && (
          <div className="connection-warning">
            <span className="warning-icon">
              <AlertTriangle size={16} />
            </span>
            <span>Supabase not configured. Data is stored locally only.</span>
          </div>
        )}

        {/* Main Navigation Tabs (Analytics commented out) */}
        <nav className="main-nav glass-card">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="tab-icon">
              <LayoutDashboard size={18} />
            </span>
            <span className="tab-label">Dashboard</span>
            {openTrades.length > 0 && (
              <span className="tab-badge">{openTrades.length}</span>
            )}
          </button>
          <button
            className={`nav-tab ${activeTab === 'trade' ? 'active' : ''}`}
            onClick={() => setActiveTab('trade')}
          >
            <span className="tab-icon">
              <Zap size={18} />
            </span>
            <span className="tab-label">Place Trade</span>
          </button>
          {/* Analytics tab – commented out
          <button
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <span className="tab-icon"><BarChart3 size={18} /></span>
            <span className="tab-label">Analytics</span>
          </button>
          */}
        </nav>

        {/* Tab Content */}
        <main className="main-content">
          {/* Analytics – commented out
          {activeTab === 'analytics' && (
            <div className="analytics-layout animate-fadeIn">
              <Analytics />
            </div>
          )}
          */}

          {activeTab === 'dashboard' && (
            <div className="dashboard-layout animate-fadeIn">
              <TradingJournal 
                trades={trades} 
                rValue={rValue}
                onDeleteTrade={handleDeleteTrade}
                onCloseTrade={handleCloseTrade}
                onUpdateTrade={handleUpdateTrade}
                initialBalance={balance}
              />
            </div>
          )}

          {activeTab === 'trade' && (
            <div className="trade-layout animate-fadeIn">
              <div className="trade-layout-place">
                <PositionSizer 
                  rValue={rValue} 
                  onNewTrade={handleNewTrade}
                />
              </div>
              <aside className="trade-layout-active">
                <ActiveTrades 
                  trades={trades} 
                  onCloseTrade={handleCloseTrade}
                />
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
