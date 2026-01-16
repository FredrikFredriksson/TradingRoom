import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import PositionSizer from './components/PositionSizer';
import TradingJournal from './components/TradingJournal';
import Settings from './components/Settings';
import { supabase, tradesApi, settingsApi, dbToAppTrade } from './lib/supabase';
import { blofinClient } from './lib/blofin';
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
  
  // Blofin connection state
  const [blofinConnected, setBlofinConnected] = useState(false);
  const [blofinSyncing, setBlofinSyncing] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Check Blofin connection status
  const checkBlofinStatus = useCallback(async () => {
    try {
      const status = await blofinClient.checkStatus();
      setBlofinConnected(status.configured);
      return status.configured;
    } catch (error) {
      console.log('Blofin backend not available');
      setBlofinConnected(false);
      return false;
    }
  }, []);

  // Sync balance from Blofin
  const syncBlofinBalance = useCallback(async () => {
    if (!blofinConnected) return;
    
    try {
      const balanceData = await blofinClient.getBalance();
      if (balanceData.totalBalance > 0) {
        setBalance(balanceData.totalBalance);
      }
    } catch (error) {
      console.error('Error syncing Blofin balance:', error);
    }
  }, [blofinConnected]);

  // Import trade history from Blofin
  const importBlofinHistory = useCallback(async () => {
    if (!blofinConnected) return;
    
    setBlofinSyncing(true);
    try {
      const history = await blofinClient.getTradeHistory(null, 100);
      
      // Convert Blofin trades to our format and merge with existing trades
      const importedTrades = history.map(trade => ({
        id: `blofin_${trade.id}`,
        symbol: trade.symbol,
        type: trade.side === 'buy' ? 'long' : 'short',
        openPrice: trade.price,
        closePrice: trade.price,
        stopLoss: 0,
        takeProfit: null,
        leverage: 1,
        positionSize: trade.size * trade.price,
        riskAmount: rValue,
        riskMultiple: 1,
        openDate: trade.timestamp,
        closeDate: trade.timestamp,
        status: 'closed',
        pnlDollar: trade.pnl,
        pnlPercent: (trade.pnl / (trade.size * trade.price)) * 100,
        rResult: trade.pnl / rValue,
        comment: `Imported from Blofin - ${trade.instId}`,
        source: 'blofin',
      }));

      // Add imported trades that don't already exist
      setTrades(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const newTrades = importedTrades.filter(t => !existingIds.has(t.id));
        return [...newTrades, ...prev];
      });

      console.log(`Imported ${importedTrades.length} trades from Blofin`);
    } catch (error) {
      console.error('Error importing Blofin history:', error);
    } finally {
      setBlofinSyncing(false);
    }
  }, [blofinConnected, rValue]);

  // Check Supabase and Blofin connection and load initial data
  useEffect(() => {
    const initializeData = async () => {
      // Check Blofin status
      checkBlofinStatus();
      
      if (supabase) {
        setSupabaseConnected(true);
        
        // Load settings
        const { data: settings } = await settingsApi.get();
        if (settings?.r_value) {
          setRValue(settings.r_value);
        }
        if (settings?.balance !== undefined && settings?.balance !== null) {
          setBalance(settings.balance);
        }
        
        // Load trades
        const { data: dbTrades, error } = await tradesApi.getAll();
        if (!error && dbTrades) {
          setTrades(dbTrades.map(dbToAppTrade));
        }
      } else {
        // Fall back to localStorage
        const saved = localStorage.getItem('tradingRoom_trades');
        if (saved) {
          setTrades(JSON.parse(saved));
        }
      }
      setLoading(false);
    };

    initializeData();
  }, [checkBlofinStatus]);

  // Sync Blofin balance periodically when connected
  useEffect(() => {
    if (blofinConnected) {
      syncBlofinBalance();
      const interval = setInterval(syncBlofinBalance, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [blofinConnected, syncBlofinBalance]);

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

  // Handle new trade (with optional Blofin execution)
  const handleNewTrade = useCallback(async (trade, executeOnBlofin = false) => {
    // Ensure we have today's date
    const tradeWithDate = {
      ...trade,
      openDate: trade.openDate || new Date().toISOString(),
    };

    // If Blofin is connected and user wants to execute, place the order
    if (executeOnBlofin && blofinConnected) {
      try {
        const blofinOrder = blofinClient.formatOrder(trade);
        const result = await blofinClient.placeOrder(blofinOrder);
        
        if (result.code === '0') {
          tradeWithDate.blofinOrderId = result.data?.orderId;
          tradeWithDate.source = 'blofin';
          console.log('✅ Order placed on Blofin:', result);
        } else {
          console.error('❌ Blofin order failed:', result);
          alert(`Blofin order failed: ${result.msg || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error placing Blofin order:', error);
        alert(`Error placing order: ${error.message}`);
      }
    }

    if (supabaseConnected) {
      const { data, error } = await tradesApi.create(tradeWithDate);
      if (!error && data) {
        setTrades(prev => [dbToAppTrade(data), ...prev]);
      } else {
        console.error('Error creating trade:', error);
        setTrades(prev => [{ ...tradeWithDate, id: Date.now() }, ...prev]);
      }
    } else {
      setTrades(prev => [{ ...tradeWithDate, id: Date.now() }, ...prev]);
    }
    
    setActiveTab('dashboard');
  }, [supabaseConnected, blofinConnected]);

  // Handle closing a trade
  const handleCloseTrade = useCallback(async (tradeId, closePrice, comment = '') => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;

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
        setTrades(prev => prev.map(t => 
          t.id === tradeId ? dbToAppTrade(data) : t
        ));
      } else {
        console.error('Error closing trade:', error);
        updateTradeLocally();
      }
    } else {
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

    // Update balance with the P&L
    setBalance(prev => prev + pnlDollar);
  }, [trades, supabaseConnected]);

  // Handle deleting a trade
  const handleDeleteTrade = useCallback(async (tradeId) => {
    if (supabaseConnected) {
      const { error } = await tradesApi.delete(tradeId);
      if (error) {
        console.error('Error deleting trade:', error);
      }
    }
    setTrades(prev => prev.filter(t => t.id !== tradeId));
  }, [supabaseConnected]);

  // Handle Blofin configuration
  const handleBlofinConfigured = (configured) => {
    setBlofinConnected(configured);
    if (configured) {
      syncBlofinBalance();
    }
  };

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
          blofinConnected={blofinConnected}
          onSettingsClick={() => setSettingsOpen(true)}
          onSyncBlofin={syncBlofinBalance}
          onImportHistory={importBlofinHistory}
          blofinSyncing={blofinSyncing}
        />

        {/* Connection Warning */}
        {!supabaseConnected && (
          <div className="connection-warning">
            <span className="warning-icon">⚠️</span>
            <span>Supabase not configured. Data is stored locally only.</span>
          </div>
        )}

        {/* Main Navigation Tabs */}
        <nav className="main-nav">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Dashboard</span>
            {openTrades.length > 0 && (
              <span className="tab-badge">{openTrades.length}</span>
            )}
          </button>
          <button
            className={`nav-tab ${activeTab === 'trade' ? 'active' : ''}`}
            onClick={() => setActiveTab('trade')}
          >
            <span className="tab-icon">⚡</span>
            <span className="tab-label">Place Trade</span>
          </button>
        </nav>

        {/* Tab Content */}
        <main className="main-content">
          {activeTab === 'dashboard' && (
            <div className="dashboard-layout animate-fadeIn">
              <TradingJournal 
                trades={trades} 
                rValue={rValue}
                onDeleteTrade={handleDeleteTrade}
                onCloseTrade={handleCloseTrade}
              />
            </div>
          )}

          {activeTab === 'trade' && (
            <div className="trade-layout animate-fadeIn">
              <PositionSizer 
                rValue={rValue} 
                onNewTrade={handleNewTrade}
                blofinConnected={blofinConnected}
              />
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <Settings 
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onBlofinConfigured={handleBlofinConfigured}
      />
    </div>
  );
}

export default App;
