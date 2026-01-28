import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LayoutDashboard, Zap, AlertTriangle, Wallet, BarChart3 } from 'lucide-react';
import Header from './components/Header';
import PositionSizer from './components/PositionSizer';
import ActiveTrades from './components/ActiveTrades';
import TradingJournal from './components/TradingJournal';
import Balance from './components/Balance';
import Auth from './components/Auth';
import Analytics from './components/Analytics';
import { supabase, tradesApi, settingsApi, dbToAppTrade } from './lib/supabase';
import { useUnrealizedPnL } from './hooks/useUnrealizedPnL';
import './App.css';

function App() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
  const xauTradeAddedRef = useRef(false);

  // Active tab: 'analytics' | 'dashboard' | 'balance' | 'trade'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Load user-specific data
  const loadUserData = useCallback(async (userId) => {
    if (!supabase || !userId) return;

    setLoading(true);
    try {
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
    } catch (err) {
      console.error('❌ Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication on mount and listen for auth changes
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    setSupabaseConnected(true);

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        loadUserData(currentUser.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        // Reload data when user logs in
        loadUserData(currentUser.id);
      } else {
        // Clear data when user logs out
        setTrades([]);
        setRValue(100);
        setBalance(1000);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  // Handle successful authentication
  const handleAuthSuccess = useCallback((session) => {
    setUser(session?.user ?? null);
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

  // Add XAUUSDT trade if it doesn't exist (runs after trades are loaded)
  useEffect(() => {
    if (loading || xauTradeAddedRef.current) return; // Wait for initial load and only run once
    
    const addXAUUSDTTrade = async () => {
      const symbol = 'XAU/USDT';
      const openPrice = 4787.21;
      
      // Check if trade already exists
      setTrades(prevTrades => {
        const exists = prevTrades.some(t => 
          t.symbol === symbol && 
          Math.abs(t.openPrice - openPrice) < 0.01 &&
          t.status === 'open'
        );
        
        if (exists) {
          xauTradeAddedRef.current = true; // Mark as checked
          return prevTrades; // Trade already exists
        }
        
        // Mark that we're attempting to add
        xauTradeAddedRef.current = true;
        
        // Calculate trade values
        const positionSize = 1717.84;
        const stopLoss = 4765;
        const takeProfit = 4870;
        const leverage = 20;
        const fee = 0.81;
        
        // Calculate riskAmount: for long, risk = positionSize * ((openPrice - stopLoss) / openPrice)
        const stopLossPercent = ((openPrice - stopLoss) / openPrice) * 100;
        const riskAmount = positionSize * (stopLossPercent / 100);
        
        // Get current R value
        const currentRValue = rValue || parseFloat(localStorage.getItem('tradingRoom_rValue')) || 100;
        const riskMultiple = currentRValue > 0 ? riskAmount / currentRValue : 1;
        
        const newTrade = {
          id: Date.now(),
          symbol: symbol,
          type: 'long',
          openPrice: openPrice,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
          leverage: leverage,
          positionSize: positionSize,
          riskAmount: riskAmount,
          riskMultiple: riskMultiple,
          openDate: new Date().toISOString(),
          status: 'open',
          fee: fee,
        };
        
        // Add trade to Supabase if connected, otherwise add locally
        if (supabaseConnected && supabase) {
          tradesApi.create(newTrade).then(({ data, error }) => {
            if (!error && data) {
              setTrades(prev => {
                // Double-check to avoid duplicates
                const alreadyExists = prev.some(t => 
                  t.symbol === symbol && 
                  Math.abs(t.openPrice - openPrice) < 0.01 &&
                  t.status === 'open'
                );
                if (alreadyExists) return prev;
                return [dbToAppTrade(data), ...prev];
              });
              console.log('✅ XAUUSDT trade added to Supabase:', data?.id);
            } else {
              console.error('❌ Error adding XAUUSDT trade:', error);
              // Fallback: add locally
              setTrades(prev => {
                const alreadyExists = prev.some(t => 
                  t.symbol === symbol && 
                  Math.abs(t.openPrice - openPrice) < 0.01 &&
                  t.status === 'open'
                );
                if (alreadyExists) return prev;
                return [newTrade, ...prev];
              });
            }
          }).catch(err => {
            console.error('❌ Exception adding XAUUSDT trade:', err);
            // Fallback: add locally
            setTrades(prev => {
              const alreadyExists = prev.some(t => 
                t.symbol === symbol && 
                Math.abs(t.openPrice - openPrice) < 0.01 &&
                t.status === 'open'
              );
              if (alreadyExists) return prev;
              return [newTrade, ...prev];
            });
          });
        } else {
          // No Supabase, add locally
        }
        
        // Return updated trades with new trade (local addition)
        return [newTrade, ...prevTrades];
      });
    };
    
    // Small delay to ensure state is ready
    const timer = setTimeout(addXAUUSDTTrade, 500);
    return () => clearTimeout(timer);
  }, [loading, rValue, supabaseConnected]);

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

  // Calculate unrealized P&L from open trades
  const { totalUnrealizedPnL } = useUnrealizedPnL(openTrades);

  // Calculate displayed balance (base balance + unrealized P&L)
  const displayedBalance = useMemo(() => {
    return balance + totalUnrealizedPnL;
  }, [balance, totalUnrealizedPnL]);

  // Handle balance change - convert displayed balance back to base balance
  const handleBalanceChange = useCallback((newDisplayedBalance) => {
    // When user edits the displayed balance, convert it to base balance
    // by subtracting unrealized P&L
    const newBaseBalance = newDisplayedBalance - totalUnrealizedPnL;
    setBalance(newBaseBalance);
  }, [totalUnrealizedPnL]);

  // Show auth screen if not authenticated
  if (authLoading) {
    return (
      <div className="app loading-screen">
        <div className="loader">
          <div className="spinner"></div>
          <p>Loading TradingRoom...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loader">
          <div className="spinner"></div>
          <p>Loading your trades...</p>
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
          balance={displayedBalance}
          onBalanceChange={handleBalanceChange}
          supabaseConnected={supabaseConnected}
          user={user}
          onLogout={async () => {
            if (supabase) {
              await supabase.auth.signOut();
            }
          }}
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
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <span className="tab-icon"><BarChart3 size={18} /></span>
            <span className="tab-label">Analytics</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            <span className="tab-icon">
              <Wallet size={18} />
            </span>
            <span className="tab-label">Balance</span>
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
                onUpdateTrade={handleUpdateTrade}
                initialBalance={balance}
              />
            </div>
          )}

          {activeTab === 'balance' && (
            <div className="balance-layout animate-fadeIn">
              <Balance initialBalance={balance} />
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
                  onDeleteTrade={handleDeleteTrade}
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
