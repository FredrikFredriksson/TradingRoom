import { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  isWithinInterval,
  subMonths,
  addMonths,
} from 'date-fns';
import './TradingJournal.css';

const TradingJournal = ({ trades, rValue, onDeleteTrade, onCloseTrade }) => {
  // Main tab: 'active', 'stats', 'trades'
  const [mainTab, setMainTab] = useState('active');
  
  // View mode for trades/stats: 'month', 'range', 'all'
  const [viewMode, setViewMode] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTrade, setSelectedTrade] = useState(null);
  
  // Active trade closing state
  const [closingTrade, setClosingTrade] = useState(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeComment, setCloseComment] = useState('');

  // Split trades
  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');

  // Filter trades based on view mode
  const filteredTrades = useMemo(() => {
    if (viewMode === 'all') return closedTrades;

    let start, end;
    if (viewMode === 'month') {
      start = startOfMonth(selectedMonth);
      end = endOfMonth(selectedMonth);
    } else {
      start = parseISO(dateRange.start);
      end = parseISO(dateRange.end);
    }

    return closedTrades.filter(trade => {
      const tradeDate = parseISO(trade.closeDate || trade.openDate);
      return isWithinInterval(tradeDate, { start, end });
    });
  }, [closedTrades, viewMode, selectedMonth, dateRange]);

  // Sort trades
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'date':
          aVal = new Date(a.closeDate || a.openDate);
          bVal = new Date(b.closeDate || b.openDate);
          break;
        case 'pnl':
          aVal = a.pnlDollar || 0;
          bVal = b.pnlDollar || 0;
          break;
        case 'rResult':
          aVal = a.rResult || 0;
          bVal = b.rResult || 0;
          break;
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredTrades, sortBy, sortOrder]);

  // Calculate statistics for filtered trades
  const stats = useMemo(() => {
    const wins = filteredTrades.filter(t => (t.pnlDollar || 0) >= 0);
    const losses = filteredTrades.filter(t => (t.pnlDollar || 0) < 0);
    
    const totalPnL = filteredTrades.reduce((sum, t) => sum + (t.pnlDollar || 0), 0);
    const totalR = filteredTrades.reduce((sum, t) => sum + (t.rResult || 0), 0);
    
    const avgWinDollar = wins.length > 0 
      ? wins.reduce((sum, t) => sum + (t.pnlDollar || 0), 0) / wins.length 
      : 0;
    const avgWinR = wins.length > 0 
      ? wins.reduce((sum, t) => sum + (t.rResult || 0), 0) / wins.length 
      : 0;
    
    const avgLossDollar = losses.length > 0 
      ? losses.reduce((sum, t) => sum + (t.pnlDollar || 0), 0) / losses.length 
      : 0;
    const avgLossR = losses.length > 0 
      ? losses.reduce((sum, t) => sum + (t.rResult || 0), 0) / losses.length 
      : 0;

    const largestWin = wins.length > 0 
      ? Math.max(...wins.map(t => t.pnlDollar || 0)) 
      : 0;
    const largestLoss = losses.length > 0 
      ? Math.min(...losses.map(t => t.pnlDollar || 0)) 
      : 0;

    const grossProfit = wins.reduce((sum, t) => sum + (t.pnlDollar || 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnlDollar || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      totalTrades: filteredTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: filteredTrades.length > 0 ? (wins.length / filteredTrades.length) * 100 : 0,
      totalPnL,
      totalR,
      avgWinDollar,
      avgWinR,
      avgLossDollar,
      avgLossR,
      largestWin,
      largestLoss,
      profitFactor,
    };
  }, [filteredTrades]);

  // Get monthly summaries for the year
  const monthlySummaries = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const summaries = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = endOfMonth(monthStart);
      
      const monthTrades = closedTrades.filter(trade => {
        const tradeDate = parseISO(trade.closeDate || trade.openDate);
        return isWithinInterval(tradeDate, { start: monthStart, end: monthEnd });
      });
      
      const pnl = monthTrades.reduce((sum, t) => sum + (t.pnlDollar || 0), 0);
      const rTotal = monthTrades.reduce((sum, t) => sum + (t.rResult || 0), 0);
      const wins = monthTrades.filter(t => (t.pnlDollar || 0) >= 0).length;
      
      summaries.push({
        month: monthStart,
        trades: monthTrades.length,
        pnl,
        rTotal,
        winRate: monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0,
      });
    }
    
    return summaries;
  }, [closedTrades, selectedMonth]);

  const handlePrevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));

  const formatCurrency = (value) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}$${value.toFixed(2)}`;
  };

  const formatR = (value) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}R`;
  };

  // Active trade handlers
  const handleCloseClick = (trade) => {
    setClosingTrade(trade);
    setClosePrice('');
    setCloseComment('');
  };

  const handleConfirmClose = () => {
    if (!closePrice) {
      alert('Please enter the closing price');
      return;
    }
    onCloseTrade(closingTrade.id, parseFloat(closePrice), closeComment);
    setClosingTrade(null);
    setClosePrice('');
    setCloseComment('');
  };

  const handleCancelClose = () => {
    setClosingTrade(null);
    setClosePrice('');
    setCloseComment('');
  };

  // Calculate P&L preview for active trade
  const calculatePnL = (trade, closePriceVal) => {
    if (!closePriceVal) return null;
    const close = parseFloat(closePriceVal);
    let pnlPercent;
    if (trade.type === 'long') {
      pnlPercent = ((close - trade.openPrice) / trade.openPrice) * 100;
    } else {
      pnlPercent = ((trade.openPrice - close) / trade.openPrice) * 100;
    }
    const pnlDollar = trade.positionSize * (pnlPercent / 100);
    return { pnlPercent, pnlDollar };
  };

  return (
    <div className="trading-journal-enhanced">
      {/* Header */}
      <div className="journal-header">
        <h2>📊 Trading Dashboard</h2>
        <div className="r-info">
          <span className="r-label">1R =</span>
          <span className="r-value">${rValue}</span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="main-tabs">
        <button 
          className={`main-tab ${mainTab === 'active' ? 'active' : ''}`}
          onClick={() => setMainTab('active')}
        >
          <span className="tab-icon">🎯</span>
          Active Trades
          {openTrades.length > 0 && (
            <span className="tab-count">{openTrades.length}</span>
          )}
        </button>
        <button 
          className={`main-tab ${mainTab === 'stats' ? 'active' : ''}`}
          onClick={() => setMainTab('stats')}
        >
          <span className="tab-icon">📈</span>
          Statistics
        </button>
        <button 
          className={`main-tab ${mainTab === 'trades' ? 'active' : ''}`}
          onClick={() => setMainTab('trades')}
        >
          <span className="tab-icon">📋</span>
          Trade History
          <span className="tab-count-muted">{closedTrades.length}</span>
        </button>
      </div>

      {/* Active Trades Tab */}
      {mainTab === 'active' && (
        <div className="active-trades-section">
          {openTrades.length === 0 ? (
            <div className="empty-state-large">
              <div className="empty-icon-large">📊</div>
              <h3>No Active Trades</h3>
              <p>Go to "Place Trade" to open a new position</p>
            </div>
          ) : (
            <div className="active-trades-grid">
              {openTrades.map((trade) => {
                const pnl = closingTrade?.id === trade.id ? calculatePnL(trade, closePrice) : null;
                
                return (
                  <div key={trade.id} className={`active-trade-card ${trade.type}`}>
                    <div className="trade-card-header">
                      <div className="trade-symbol-info">
                        <span className={`trade-type-indicator ${trade.type}`}>
                          {trade.type === 'long' ? '↑' : '↓'}
                        </span>
                        <span className="trade-symbol">{trade.symbol}</span>
                        <span className="trade-leverage">{trade.leverage}x</span>
                      </div>
                      <span className="trade-risk">{trade.riskMultiple}R</span>
                    </div>

                    <div className="trade-card-body">
                      <div className="trade-price-row">
                        <div className="price-item">
                          <span className="price-label">Entry</span>
                          <span className="price-value">${trade.openPrice.toLocaleString()}</span>
                        </div>
                        <div className="price-item">
                          <span className="price-label">Stop Loss</span>
                          <span className="price-value danger">${trade.stopLoss.toLocaleString()}</span>
                        </div>
                        {trade.takeProfit && (
                          <div className="price-item">
                            <span className="price-label">Take Profit</span>
                            <span className="price-value success">${trade.takeProfit.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="trade-info-row">
                        <div className="info-item">
                          <span className="info-label">Size</span>
                          <span className="info-value">${trade.positionSize.toLocaleString()}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Risk</span>
                          <span className="info-value warning">${trade.riskAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="trade-card-footer">
                      {closingTrade?.id === trade.id ? (
                        <div className="close-form">
                          <input
                            type="number"
                            value={closePrice}
                            onChange={(e) => setClosePrice(e.target.value)}
                            placeholder="Exit Price"
                            autoFocus
                          />
                          <textarea
                            value={closeComment}
                            onChange={(e) => setCloseComment(e.target.value)}
                            placeholder="Comment (optional)"
                            rows="2"
                          />
                          {pnl && (
                            <div className={`pnl-preview ${pnl.pnlDollar >= 0 ? 'positive' : 'negative'}`}>
                              {pnl.pnlDollar >= 0 ? '+' : ''}{pnl.pnlPercent.toFixed(2)}% 
                              (${pnl.pnlDollar >= 0 ? '+' : ''}{pnl.pnlDollar.toFixed(2)})
                            </div>
                          )}
                          <div className="close-actions">
                            <button className="btn-confirm" onClick={handleConfirmClose}>
                              ✓ Confirm
                            </button>
                            <button className="btn-cancel" onClick={handleCancelClose}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn-close-trade" onClick={() => handleCloseClick(trade)}>
                          Close Trade
                        </button>
                      )}
                    </div>
                    
                    <div className="trade-date-small">
                      Opened {format(parseISO(trade.openDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {mainTab === 'stats' && (
        <div className="stats-section">
          {/* View Mode Tabs */}
          <div className="view-tabs">
            <button 
              className={`tab ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Monthly View
            </button>
            <button 
              className={`tab ${viewMode === 'range' ? 'active' : ''}`}
              onClick={() => setViewMode('range')}
            >
              Date Range
            </button>
            <button 
              className={`tab ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              All Time
            </button>
          </div>

          {/* Month Navigator */}
          {viewMode === 'month' && (
            <div className="month-navigator">
              <button className="nav-btn" onClick={handlePrevMonth}>←</button>
              <h3 className="current-month">
                {format(selectedMonth, 'MMMM yyyy')}
              </h3>
              <button className="nav-btn" onClick={handleNextMonth}>→</button>
            </div>
          )}

          {/* Date Range Picker */}
          {viewMode === 'range' && (
            <div className="date-range-picker">
              <div className="date-input-group">
                <label>From</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="date-input-group">
                <label>To</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Statistics Dashboard */}
          <div className="stats-dashboard">
            <div className="stats-row main-stats">
              <div className={`stat-card large ${stats.totalPnL >= 0 ? 'positive' : 'negative'}`}>
                <span className="stat-label">Total P&L</span>
                <span className="stat-value">{formatCurrency(stats.totalPnL)}</span>
                <span className="stat-sub">{formatR(stats.totalR)}</span>
              </div>
              
              <div className={`stat-card large ${stats.winRate >= 50 ? 'positive' : 'negative'}`}>
                <span className="stat-label">Win Rate</span>
                <span className="stat-value">{stats.winRate.toFixed(1)}%</span>
                <span className="stat-sub">{stats.winningTrades}W / {stats.losingTrades}L</span>
              </div>
              
              <div className="stat-card large">
                <span className="stat-label">Total Trades</span>
                <span className="stat-value neutral">{stats.totalTrades}</span>
              </div>
            </div>

            <div className="stats-row secondary-stats">
              <div className="stat-card">
                <span className="stat-label">Avg Win</span>
                <span className="stat-value positive">{formatCurrency(stats.avgWinDollar)}</span>
                <span className="stat-sub positive">{formatR(stats.avgWinR)}</span>
              </div>
              
              <div className="stat-card">
                <span className="stat-label">Avg Loss</span>
                <span className="stat-value negative">{formatCurrency(stats.avgLossDollar)}</span>
                <span className="stat-sub negative">{formatR(stats.avgLossR)}</span>
              </div>
              
              <div className="stat-card">
                <span className="stat-label">Largest Win</span>
                <span className="stat-value positive">{formatCurrency(stats.largestWin)}</span>
              </div>
              
              <div className="stat-card">
                <span className="stat-label">Largest Loss</span>
                <span className="stat-value negative">{formatCurrency(stats.largestLoss)}</span>
              </div>
              
              <div className="stat-card">
                <span className="stat-label">Profit Factor</span>
                <span className={`stat-value ${stats.profitFactor >= 1 ? 'positive' : 'negative'}`}>
                  {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Performance Chart */}
          {viewMode === 'month' && (
            <div className="monthly-chart">
              <h4>Year Overview - {format(selectedMonth, 'yyyy')}</h4>
              <div className="month-bars">
                {monthlySummaries.map((summary, idx) => {
                  const maxPnL = Math.max(...monthlySummaries.map(s => Math.abs(s.pnl)), 1);
                  const barHeight = Math.min(Math.abs(summary.pnl) / maxPnL * 100, 100);
                  const isCurrentMonth = format(summary.month, 'yyyy-MM') === format(selectedMonth, 'yyyy-MM');
                  
                  return (
                    <div 
                      key={idx} 
                      className={`month-bar-container ${isCurrentMonth ? 'selected' : ''}`}
                      onClick={() => setSelectedMonth(summary.month)}
                    >
                      <div className="bar-wrapper">
                        <div 
                          className={`bar ${summary.pnl >= 0 ? 'positive' : 'negative'}`}
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <span className="month-label">{format(summary.month, 'MMM')}</span>
                      {summary.trades > 0 && (
                        <span className={`month-pnl ${summary.pnl >= 0 ? 'positive' : 'negative'}`}>
                          {formatCurrency(summary.pnl)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trade History Tab */}
      {mainTab === 'trades' && (
        <div className="trades-section">
          {/* View Mode Tabs */}
          <div className="view-tabs">
            <button 
              className={`tab ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              Monthly
            </button>
            <button 
              className={`tab ${viewMode === 'range' ? 'active' : ''}`}
              onClick={() => setViewMode('range')}
            >
              Date Range
            </button>
            <button 
              className={`tab ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              All Time
            </button>
          </div>

          {/* Month Navigator */}
          {viewMode === 'month' && (
            <div className="month-navigator">
              <button className="nav-btn" onClick={handlePrevMonth}>←</button>
              <h3 className="current-month">
                {format(selectedMonth, 'MMMM yyyy')}
              </h3>
              <button className="nav-btn" onClick={handleNextMonth}>→</button>
            </div>
          )}

          {/* Date Range Picker */}
          {viewMode === 'range' && (
            <div className="date-range-picker">
              <div className="date-input-group">
                <label>From</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="date-input-group">
                <label>To</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="trades-table-container">
            <div className="trades-header">
              <h4>
                {viewMode === 'month' && `Trades in ${format(selectedMonth, 'MMMM yyyy')}`}
                {viewMode === 'range' && `Trades from ${dateRange.start} to ${dateRange.end}`}
                {viewMode === 'all' && 'All Trades'}
                <span className="trade-count">({sortedTrades.length})</span>
              </h4>
              
              <div className="sort-controls">
                <span>Sort by:</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date">Date</option>
                  <option value="pnl">P&L ($)</option>
                  <option value="rResult">P&L (R)</option>
                  <option value="symbol">Symbol</option>
                </select>
                <button 
                  className="sort-order-btn"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>

            {sortedTrades.length === 0 ? (
              <div className="empty-trades">
                <span className="empty-icon">📝</span>
                <p>No closed trades for this period</p>
              </div>
            ) : (
              <div className="trades-table">
                <div className="table-header">
                  <span>Date</span>
                  <span>Symbol</span>
                  <span>Type</span>
                  <span>Entry</span>
                  <span>Exit</span>
                  <span>P&L</span>
                  <span>R</span>
                  <span></span>
                </div>
                
                {sortedTrades.map((trade) => (
                  <div 
                    key={trade.id} 
                    className={`table-row ${(trade.pnlDollar || 0) >= 0 ? 'win' : 'loss'} clickable`}
                    onClick={() => setSelectedTrade(trade)}
                  >
                    <span className="cell-date">
                      {format(parseISO(trade.closeDate || trade.openDate), 'MMM d, yyyy')}
                    </span>
                    <span className="cell-symbol">
                      <span className={`type-dot ${trade.type}`}></span>
                      {trade.symbol}
                      {trade.comment && <span className="has-comment-indicator" title="Has comment">💬</span>}
                    </span>
                    <span className={`cell-type ${trade.type}`}>
                      {trade.type.toUpperCase()}
                    </span>
                    <span className="cell-price">
                      ${parseFloat(trade.openPrice).toLocaleString()}
                    </span>
                    <span className="cell-price">
                      ${parseFloat(trade.closePrice).toLocaleString()}
                    </span>
                    <span className={`cell-pnl ${(trade.pnlDollar || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(trade.pnlDollar || 0)}
                      <span className="pnl-percent">
                        ({(trade.pnlPercent || 0) >= 0 ? '+' : ''}{(trade.pnlPercent || 0).toFixed(2)}%)
                      </span>
                    </span>
                    <span className={`cell-r ${(trade.rResult || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {formatR(trade.rResult || 0)}
                    </span>
                    <span className="cell-actions">
                      {onDeleteTrade && (
                        <button 
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this trade?')) {
                              onDeleteTrade(trade.id);
                            }
                          }}
                          title="Delete trade"
                        >
                          🗑️
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <div className="trade-modal-overlay" onClick={() => setSelectedTrade(null)}>
          <div className="trade-modal" onClick={(e) => e.stopPropagation()}>
            <div className="trade-modal-header">
              <div className="modal-trade-info">
                <span className={`modal-type-badge ${selectedTrade.type}`}>
                  {selectedTrade.type === 'long' ? '↑ LONG' : '↓ SHORT'}
                </span>
                <h3>{selectedTrade.symbol}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedTrade(null)}>
                ✕
              </button>
            </div>

            <div className={`modal-pnl-banner ${(selectedTrade.pnlDollar || 0) >= 0 ? 'positive' : 'negative'}`}>
              <div className="pnl-main">
                {formatCurrency(selectedTrade.pnlDollar || 0)}
              </div>
              <div className="pnl-details">
                <span>{formatR(selectedTrade.rResult || 0)}</span>
                <span>•</span>
                <span>{(selectedTrade.pnlPercent || 0) >= 0 ? '+' : ''}{(selectedTrade.pnlPercent || 0).toFixed(2)}%</span>
              </div>
            </div>

            <div className="modal-details-grid">
              <div className="modal-detail-item">
                <span className="detail-label">Entry Price</span>
                <span className="detail-value">${parseFloat(selectedTrade.openPrice).toLocaleString()}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Exit Price</span>
                <span className="detail-value">${parseFloat(selectedTrade.closePrice).toLocaleString()}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Stop Loss</span>
                <span className="detail-value negative">${parseFloat(selectedTrade.stopLoss).toLocaleString()}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Take Profit</span>
                <span className="detail-value positive">
                  {selectedTrade.takeProfit ? `$${parseFloat(selectedTrade.takeProfit).toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Leverage</span>
                <span className="detail-value">{selectedTrade.leverage}x</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Position Size</span>
                <span className="detail-value">${parseFloat(selectedTrade.positionSize).toLocaleString()}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Risk Amount</span>
                <span className="detail-value risk">${parseFloat(selectedTrade.riskAmount).toFixed(2)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Risk Multiple</span>
                <span className="detail-value">{selectedTrade.riskMultiple}R</span>
              </div>
            </div>

            <div className="modal-dates">
              <div className="date-item">
                <span className="date-label">Opened</span>
                <span className="date-value">
                  {format(parseISO(selectedTrade.openDate), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
              <div className="date-item">
                <span className="date-label">Closed</span>
                <span className="date-value">
                  {format(parseISO(selectedTrade.closeDate), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
            </div>

            {selectedTrade.comment && (
              <div className="modal-comment">
                <span className="comment-label">💬 Comment</span>
                <p className="comment-text">{selectedTrade.comment}</p>
              </div>
            )}

            <div className="modal-actions">
              {onDeleteTrade && (
                <button 
                  className="modal-delete-btn"
                  onClick={() => {
                    if (confirm('Delete this trade?')) {
                      onDeleteTrade(selectedTrade.id);
                      setSelectedTrade(null);
                    }
                  }}
                >
                  🗑️ Delete Trade
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingJournal;
