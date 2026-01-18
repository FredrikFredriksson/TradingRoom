import { useState, useMemo, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  isWithinInterval,
  subMonths,
  addMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  getDay,
} from 'date-fns';
import { 
  Target, 
  TrendingUp, 
  FileText, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight,
  X, 
  Trash2, 
  MessageSquare,
  BarChart3,
  Check
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import PerformanceTearsheet from './PerformanceTearsheet';
import './TradingJournal.css';

const TradingJournal = ({ trades, rValue, onDeleteTrade, onCloseTrade, initialBalance = 1000 }) => {
  // Main tab: 'active', 'stats', 'trades'
  const [mainTab, setMainTab] = useState('stats');
  
  // View mode for trades/stats: 'month', 'range', 'all'
  const [viewMode, setViewMode] = useState('month');
  // Default to January 2025 for test data
  const [selectedMonth, setSelectedMonth] = useState(new Date(2025, 0, 1));
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
  
  // Calendar view state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Split trades
  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  
  // Update selectedMonth when trades load to match the year of trades
  useEffect(() => {
    if (closedTrades.length > 0) {
      const tradesWithDates = closedTrades
        .filter(t => t.closeDate)
        .map(t => {
          try {
            return parseISO(t.closeDate);
          } catch {
            return null;
          }
        })
        .filter(d => d && !isNaN(d.getTime()));
      
      if (tradesWithDates.length > 0) {
        const years = tradesWithDates.map(d => d.getFullYear());
        const mostCommonYear = years.sort((a, b) => 
          years.filter(y => y === a).length - years.filter(y => y === b).length
        ).pop();
        
        // Only update if current month is not in the year range
        const currentYear = selectedMonth.getFullYear();
        if (currentYear !== mostCommonYear && mostCommonYear) {
          setSelectedMonth(new Date(mostCommonYear, 0, 1));
        }
      }
    }
  }, [closedTrades.length]); // Only run when trades count changes

  // Filter trades based on view mode
  const filteredTrades = useMemo(() => {
    if (viewMode === 'all') {
      // Return all closed trades with valid close dates
      return closedTrades.filter(trade => {
        if (!trade.closeDate) return false;
        try {
          const tradeDate = parseISO(trade.closeDate);
          return !isNaN(tradeDate.getTime());
        } catch {
          return false;
        }
      });
    }

    let start, end;
    if (viewMode === 'month') {
      start = startOfMonth(selectedMonth);
      end = endOfMonth(selectedMonth);
    } else {
      start = parseISO(dateRange.start);
      end = parseISO(dateRange.end);
    }

    return closedTrades.filter(trade => {
      // For closed trades, always use closeDate (when P&L was realized)
      if (!trade.closeDate) return false; // Skip trades without close date
      try {
        const tradeDate = parseISO(trade.closeDate);
        if (isNaN(tradeDate.getTime())) return false; // Invalid date
        return isWithinInterval(tradeDate, { start, end });
      } catch (e) {
        return false;
      }
    });
  }, [closedTrades, viewMode, selectedMonth, dateRange]);

  // Sort trades
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'date':
          // For closed trades, use closeDate
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

  // Calculate daily PnL for calendar view
  const dailyPnL = useMemo(() => {
    if (!showCalendar) return {};
    
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    
    const dailyData = {};
    
    // Initialize all days in month
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    days.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      dailyData[dayKey] = {
        date: day,
        pnl: 0,
        trades: [],
        rTotal: 0,
      };
    });
    
    // Add trades that closed on each day
    closedTrades.forEach(trade => {
      // For closed trades, always use closeDate
      if (!trade.closeDate) return; // Skip trades without close date
      const closeDate = parseISO(trade.closeDate);
      if (isWithinInterval(closeDate, { start: monthStart, end: monthEnd })) {
        const dayKey = format(closeDate, 'yyyy-MM-dd');
        if (dailyData[dayKey]) {
          dailyData[dayKey].pnl += trade.pnlDollar || 0;
          dailyData[dayKey].rTotal += trade.rResult || 0;
          dailyData[dayKey].trades.push(trade);
        }
      }
    });
    
    return dailyData;
  }, [closedTrades, calendarMonth, showCalendar]);

  // Get monthly summaries for the year
  const monthlySummaries = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const summaries = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = endOfMonth(monthStart);
      
      const monthTrades = closedTrades.filter(trade => {
        // For closed trades, always use closeDate (when P&L was realized)
        if (!trade.closeDate) return false; // Skip trades without close date
        try {
          const tradeDate = parseISO(trade.closeDate);
          if (isNaN(tradeDate.getTime())) return false; // Invalid date
          return isWithinInterval(tradeDate, { start: monthStart, end: monthEnd });
        } catch (e) {
          return false;
        }
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

  // Calculate balance and P&L % history for charts
  const chartData = useMemo(() => {
    // Sort trades by close date (closed trades should always have closeDate)
    const sortedTrades = [...closedTrades]
      .filter(t => t.closeDate) // Only include trades with close dates
      .sort((a, b) => {
        const dateA = new Date(a.closeDate);
        const dateB = new Date(b.closeDate);
        return dateA - dateB;
      });

    if (sortedTrades.length === 0) return [];

    // Calculate initial balance by subtracting all P&L from current balance
    const totalPnL = sortedTrades.reduce((sum, t) => sum + (t.pnlDollar || 0), 0);
    const calculatedInitialBalance = initialBalance - totalPnL;
    const startBalance = calculatedInitialBalance > 0 ? calculatedInitialBalance : initialBalance;

    let runningBalance = startBalance;
    const data = [];

    // Add initial point
    const firstTradeDate = new Date(sortedTrades[0].closeDate || sortedTrades[0].openDate);
    data.push({
      date: format(firstTradeDate, 'MMM d'),
      dateFull: firstTradeDate,
      balance: startBalance,
      pnlPercent: 0,
      cumulativePnL: 0,
    });

    // Add data point for each trade
    sortedTrades.forEach((trade) => {
      const tradeDate = new Date(trade.closeDate || trade.openDate);
      const pnlDollar = trade.pnlDollar || 0;
      runningBalance += pnlDollar;
      const cumulativePnL = runningBalance - startBalance;
      const pnlPercent = startBalance > 0 ? (cumulativePnL / startBalance) * 100 : 0;

      data.push({
        date: format(tradeDate, 'MMM d'),
        dateFull: tradeDate,
        balance: runningBalance,
        pnlPercent: pnlPercent,
        cumulativePnL: cumulativePnL,
      });
    });

    return data;
  }, [closedTrades, initialBalance]);

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
        <h2>
          <BarChart3 size={24} />
          Trading Dashboard
        </h2>
        <div className="r-info">
          <span className="r-label">1R =</span>
          <span className="r-value">${rValue}</span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="main-tabs">
        <button 
          className={`main-tab ${mainTab === 'stats' ? 'active' : ''}`}
          onClick={() => setMainTab('stats')}
        >
          <TrendingUp size={16} />
          Statistics
        </button>
        <button 
          className={`main-tab ${mainTab === 'active' ? 'active' : ''}`}
          onClick={() => setMainTab('active')}
        >
          <Target size={16} />
          Active Trades
          {openTrades.length > 0 && (
            <span className="tab-count">{openTrades.length}</span>
          )}
        </button>
        <button 
          className={`main-tab ${mainTab === 'trades' ? 'active' : ''}`}
          onClick={() => setMainTab('trades')}
        >
          <FileText size={16} />
          Trade History
          <span className="tab-count-muted">{closedTrades.length}</span>
        </button>
      </div>

      {/* Active Trades Tab */}
      {mainTab === 'active' && (
        <div className="active-trades-section">
          {openTrades.length === 0 ? (
            <div className="empty-state-large">
              <BarChart3 size={48} strokeWidth={1.5} />
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
                          {trade.type === 'long' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
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
                              <Check size={14} /> Confirm
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
              <button className="nav-btn" onClick={handlePrevMonth}>
                <ChevronLeft size={18} />
              </button>
              <h3 className="current-month">
                {format(selectedMonth, 'MMMM yyyy')}
              </h3>
              <button className="nav-btn" onClick={handleNextMonth}>
                <ChevronRight size={18} />
              </button>
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
                      onClick={() => {
                        setSelectedMonth(summary.month);
                        setCalendarMonth(summary.month);
                        setShowCalendar(true);
                      }}
                      title={`Click to view ${format(summary.month, 'MMMM')} calendar`}
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

          {/* Calendar View Modal */}
          {showCalendar && (
            <div className="calendar-modal-overlay" onClick={() => setShowCalendar(false)}>
              <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
                <div className="calendar-header">
                  <button className="calendar-nav-btn" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                    <ChevronLeft size={20} />
                  </button>
                  <h3 className="calendar-month-title">
                    {format(calendarMonth, 'MMMM yyyy')}
                  </h3>
                  <button className="calendar-nav-btn" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                    <ChevronRight size={20} />
                  </button>
                  <button className="calendar-close-btn" onClick={() => setShowCalendar(false)}>
                    <X size={20} />
                  </button>
                </div>
                
                <div className="calendar-grid">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="calendar-day-header">{day}</div>
                  ))}
                  
                  {/* Calendar days */}
                  {(() => {
                    const monthStart = startOfMonth(calendarMonth);
                    const monthEnd = endOfMonth(calendarMonth);
                    const calendarStart = startOfWeek(monthStart);
                    const calendarEnd = endOfWeek(monthEnd);
                    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
                    
                    return days.map((day, idx) => {
                      const dayKey = format(day, 'yyyy-MM-dd');
                      const dayData = dailyPnL[dayKey] || { pnl: 0, trades: [], rTotal: 0 };
                      const isCurrentMonth = isSameMonth(day, calendarMonth);
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <div
                          key={idx}
                          className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${dayData.pnl > 0 ? 'positive' : dayData.pnl < 0 ? 'negative' : ''}`}
                          title={dayData.trades.length > 0 ? `${dayData.trades.length} trade(s) on ${format(day, 'MMM d')}` : ''}
                        >
                          <div className="calendar-day-number">{format(day, 'd')}</div>
                          {dayData.pnl !== 0 && (
                            <div className={`calendar-day-pnl ${dayData.pnl >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(dayData.pnl)}
                            </div>
                          )}
                          {dayData.trades.length > 0 && (
                            <div className="calendar-day-trades">
                              {dayData.trades.length} trade{dayData.trades.length > 1 ? 's' : ''}
                            </div>
                          )}
                          {/* Hover tooltip */}
                          {dayData.trades.length > 0 && (
                            <div className="calendar-day-tooltip">
                              <div className="tooltip-header">
                                <strong>{format(day, 'MMM d, yyyy')}</strong>
                                <div className={`tooltip-pnl ${dayData.pnl >= 0 ? 'positive' : 'negative'}`}>
                                  {formatCurrency(dayData.pnl)} ({formatR(dayData.rTotal)})
                                </div>
                              </div>
                              <div className="tooltip-trades">
                                {dayData.trades.map((trade, tradeIdx) => (
                                  <div key={tradeIdx} className="tooltip-trade">
                                    <span className={`tooltip-trade-type ${trade.type}`}>
                                      {trade.type === 'long' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                    </span>
                                    <span className="tooltip-trade-symbol">{trade.symbol}</span>
                                    <span className={`tooltip-trade-pnl ${(trade.pnlDollar || 0) >= 0 ? 'positive' : 'negative'}`}>
                                      {formatCurrency(trade.pnlDollar || 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Balance and P&L Charts */}
          {chartData.length > 0 && (
            <div className="charts-section">
              {/* Balance Chart */}
              <div className="chart-container">
                <h4 className="chart-title">Account Balance Over Time</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="var(--text-muted)"
                      style={{ fontSize: '0.75rem' }}
                    />
                    <YAxis 
                      stroke="var(--text-muted)"
                      style={{ fontSize: '0.75rem' }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                      }}
                      formatter={(value) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Balance']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="var(--accent-primary)" 
                      strokeWidth={2}
                      fill="url(#balanceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* P&L % Chart */}
              <div className="chart-container">
                <h4 className="chart-title">P&L % Over Time</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="var(--text-muted)"
                      style={{ fontSize: '0.75rem' }}
                    />
                    <YAxis 
                      stroke="var(--text-muted)"
                      style={{ fontSize: '0.75rem' }}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)'
                      }}
                      formatter={(value) => [`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`, 'P&L %']}
                    />
                    <ReferenceLine 
                      y={0} 
                      stroke="var(--text-muted)" 
                      strokeWidth={1}
                      strokeDasharray="5 5"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="pnlPercent" 
                      stroke="var(--accent-primary)" 
                      strokeWidth={2}
                      dot={{ fill: 'var(--accent-primary)', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Performance Tearsheet: KPIs, monthly heatmap, equity, drawdown, return distribution */}
          <PerformanceTearsheet closedTrades={closedTrades} initialBalance={initialBalance} />
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
              <button className="nav-btn" onClick={handlePrevMonth}>
                <ChevronLeft size={18} />
              </button>
              <h3 className="current-month">
                {format(selectedMonth, 'MMMM yyyy')}
              </h3>
              <button className="nav-btn" onClick={handleNextMonth}>
                <ChevronRight size={18} />
              </button>
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
                  {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                </button>
              </div>
            </div>

            {sortedTrades.length === 0 ? (
              <div className="empty-trades">
                <FileText size={32} strokeWidth={1.5} />
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
                      {trade.comment && (
                        <span className="has-comment-indicator" title="Has comment">
                          <MessageSquare size={12} />
                        </span>
                      )}
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
                          <Trash2 size={14} />
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
                  {selectedTrade.type === 'long' ? <><ArrowUp size={14} /> LONG</> : <><ArrowDown size={14} /> SHORT</>}
                </span>
                <h3>{selectedTrade.symbol}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedTrade(null)}>
                <X size={18} />
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
                <span className="comment-label">
                  <MessageSquare size={14} /> Comment
                </span>
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
                  <Trash2 size={14} /> Delete Trade
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
