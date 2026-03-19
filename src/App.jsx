import { useState, useCallback, useMemo } from 'react';
import { LayoutDashboard, Zap } from 'lucide-react';
import Header from './components/Header';
import PositionSizer from './components/PositionSizer';
import ActiveTrades from './components/ActiveTrades';
import TradingJournal from './components/TradingJournal';
import { useUnrealizedPnL } from './hooks/useUnrealizedPnL';
import { getDemoState } from './data/demoData';
import './App.css';

function App() {
  const demoState = useMemo(() => getDemoState(), []);
  const [rValue] = useState(demoState.account.rValue);
  const [balance, setBalance] = useState(demoState.account.currentBalance);
  const [trades, setTrades] = useState(demoState.trades);
  const [activeTab, setActiveTab] = useState('dashboard');

  const openTrades = useMemo(
    () => trades.filter((trade) => trade.status === 'open'),
    [trades]
  );
  const closedTrades = useMemo(
    () => trades.filter((trade) => trade.status === 'closed'),
    [trades]
  );

  const { totalUnrealizedPnL } = useUnrealizedPnL(openTrades);
  const displayedBalance = useMemo(
    () => balance + totalUnrealizedPnL,
    [balance, totalUnrealizedPnL]
  );
  const winRate = useMemo(() => {
    if (closedTrades.length === 0) {
      return 0;
    }
    const winners = closedTrades.filter((trade) => (trade.pnlDollar || 0) >= 0).length;
    return (winners / closedTrades.length) * 100;
  }, [closedTrades]);

  const handleNewTrade = useCallback((trade) => {
    const tradeWithDate = {
      ...trade,
      id: `demo-${Date.now()}`,
      openDate: trade.openDate || new Date().toISOString(),
    };
    setTrades((prev) => [tradeWithDate, ...prev]);
    setActiveTab('trade');
  }, []);

  const handleCloseTrade = useCallback((tradeId, closePrice, comment = '') => {
    const trade = trades.find((item) => item.id === tradeId);
    if (!trade) {
      return;
    }

    let pnlPercent;
    if (trade.type === 'long') {
      pnlPercent = ((closePrice - trade.openPrice) / trade.openPrice) * 100;
    } else {
      pnlPercent = ((trade.openPrice - closePrice) / trade.openPrice) * 100;
    }

    const pnlDollar = trade.positionSize * (pnlPercent / 100);
    const rResult = pnlDollar / trade.riskAmount * trade.riskMultiple;
    const closeDate = new Date().toISOString();

    setTrades((prev) =>
      prev.map((currentTrade) =>
        currentTrade.id === tradeId
          ? {
              ...currentTrade,
              closePrice,
              closeDate,
              status: 'closed',
              pnlPercent,
              pnlDollar,
              rResult,
              comment,
            }
          : currentTrade
      )
    );
    setBalance((prev) => prev + pnlDollar);
  }, [trades]);

  const handleDeleteTrade = useCallback((tradeId) => {
    const trade = trades.find((item) => item.id === tradeId);
    if (!trade) {
      return;
    }

    setTrades((prev) => prev.filter((item) => item.id !== tradeId));
    if (trade.status === 'closed' && trade.pnlDollar) {
      setBalance((prev) => prev - trade.pnlDollar);
    }
  }, [trades]);

  const handleUpdateTrade = useCallback((tradeId, updates) => {
    setTrades((prev) =>
      prev.map((trade) => (trade.id === tradeId ? { ...trade, ...updates } : trade))
    );
  }, []);

  return (
    <div className="app">
      <div className="app-bg"></div>

      <div className="app-container">
        <Header
          title={demoState.account.title}
          subtitle={demoState.account.subtitle}
          balance={displayedBalance}
          rValue={rValue}
          closedTrades={closedTrades.length}
          openTrades={openTrades.length}
          winRate={winRate}
        />

        <nav className="main-nav glass-card">
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="tab-icon">
              <LayoutDashboard size={18} />
            </span>
            <span className="tab-label">Dashboard</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'trade' ? 'active' : ''}`}
            onClick={() => setActiveTab('trade')}
          >
            <span className="tab-icon">
              <Zap size={18} />
            </span>
            <span className="tab-label">Trade Studio</span>
            {openTrades.length > 0 && <span className="tab-badge">{openTrades.length}</span>}
          </button>
        </nav>

        <main className="main-content">
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
                <PositionSizer rValue={rValue} onNewTrade={handleNewTrade} />
              </div>
              <aside className="trade-layout-active">
                <ActiveTrades trades={trades} onCloseTrade={handleCloseTrade} />
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
