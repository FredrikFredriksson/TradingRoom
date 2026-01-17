import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import Header from './components/Header';
import PositionSizer from './components/PositionSizer';
import TradingJournal from './components/TradingJournal';
import Analytics from './components/Analytics';
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

  // Active tab
  const [activeTab, setActiveTab] = useState('analytics');

  // Generate test trades function (exposed to window for console access)
  const generateTestTrades = useCallback(async () => {
    if (!supabase) {
      console.error('❌ Supabase not configured');
      return;
    }

    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT'];
    const types = ['long', 'short'];
    const trades = [];
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-03-31');
    const currentRValue = rValue;

    console.log('🚀 Generating 30 test trades for Jan-March 2024...');

    for (let i = 0; i < 30; i++) {
      const openDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const leverage = [1, 2, 3, 5, 10][Math.floor(Math.random() * 5)];

      const basePrice = type === 'long' ? 40000 + Math.random() * 10000 : 3000 + Math.random() * 2000;
      const openPrice = parseFloat(basePrice.toFixed(2));

      const riskMultiple = 0.5 + Math.random() * 2.5;
      const riskAmount = currentRValue * riskMultiple;

      const stopLossPercent = 2 + Math.random() * 3;
      const stopLoss = type === 'long' 
        ? parseFloat((openPrice * (1 - stopLossPercent / 100)).toFixed(2))
        : parseFloat((openPrice * (1 + stopLossPercent / 100)).toFixed(2));

      const priceDiff = Math.abs(openPrice - stopLoss);
      const positionSize = parseFloat((riskAmount / priceDiff).toFixed(2));

      const isClosed = Math.random() > 0.2;

      let closePrice = null;
      let closeDate = null;
      let pnlPercent = null;
      let pnlDollar = null;
      let rResult = null;
      let status = 'open';

      if (isClosed) {
        closeDate = new Date(openDate);
        closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * 7) + 1);

        const rMultiplier = -2 + Math.random() * 5; // -2R to +3R
        rResult = parseFloat(rMultiplier.toFixed(2));
        pnlDollar = parseFloat((currentRValue * rMultiplier).toFixed(2));

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

    trades.sort((a, b) => new Date(a.open_date) - new Date(b.open_date));

    console.log(`📊 Generated ${trades.length} trades`);
    console.log(`   Open: ${trades.filter(t => t.status === 'open').length}`);
    console.log(`   Closed: ${trades.filter(t => t.status === 'closed').length}`);

    const { data, error } = await supabase
      .from('trades')
      .insert(trades)
      .select();

    if (error) {
      console.error('❌ Error inserting trades:', error);
    } else {
      console.log(`✅ Successfully inserted ${data?.length || 0} trades!`);
      // Reload trades
      const { data: dbTrades } = await tradesApi.getAll();
      if (dbTrades) {
        const convertedTrades = dbTrades.map(dbToAppTrade).filter(t => t !== null);
        setTrades(convertedTrades);
        console.log('🔄 Trades reloaded in app');
      }
    }
  }, [rValue]);

  // Expose function to window for console access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.generateTestTrades = generateTestTrades;
      console.log('💡 Tip: Run generateTestTrades() in the console to add test data');
    }
  }, [generateTestTrades]);

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
          console.log('📊 Trades breakdown:', {
            total: convertedTrades.length,
            open: convertedTrades.filter(t => t.status === 'open').length,
            closed: convertedTrades.filter(t => t.status === 'closed').length,
          });
          // Log all trades for debugging
          console.log('📋 All loaded trades:', convertedTrades.map(t => ({
            id: t.id,
            symbol: t.symbol,
            status: t.status,
            hasClosePrice: !!t.closePrice,
            pnlDollar: t.pnlDollar
          })));
          // Log first trade for debugging
          if (convertedTrades.length > 0) {
            console.log('🔍 Sample trade (full):', convertedTrades[0]);
          }
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
    
    setActiveTab('dashboard');
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

        {/* Main Navigation Tabs */}
        <nav className="main-nav">
          <button
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <span className="tab-icon">
              <BarChart3 size={18} />
            </span>
            <span className="tab-label">Analytics</span>
          </button>
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
        </nav>

        {/* Tab Content */}
        <main className="main-content">
          {activeTab === 'analytics' && (
            <div className="analytics-layout animate-fadeIn">
              <Analytics />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="dashboard-layout animate-fadeIn">
              <TradingJournal 
                trades={trades} 
                rValue={rValue}
                onDeleteTrade={handleDeleteTrade}
                onCloseTrade={handleCloseTrade}
                initialBalance={balance}
              />
            </div>
          )}

          {activeTab === 'trade' && (
            <div className="trade-layout animate-fadeIn">
              <PositionSizer 
                rValue={rValue} 
                onNewTrade={handleNewTrade}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
