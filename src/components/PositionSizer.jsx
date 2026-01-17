import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, Zap, Search } from 'lucide-react';
import { fetchTradingPairs, formatSymbolForBinance } from '../lib/binance';
import { useLivePrice } from '../hooks/useLivePrice';
import PriceChart from './PriceChart';
import './PositionSizer.css';

const PositionSizer = ({ rValue, onNewTrade }) => {
  const [tradeType, setTradeType] = useState('long');
  const [openPrice, setOpenPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [riskMultiple, setRiskMultiple] = useState(1);
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [tradeDate, setTradeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Trading pairs state
  const [tradingPairs, setTradingPairs] = useState([]);
  const [filteredPairs, setFilteredPairs] = useState([]);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const symbolInputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Live price for selected symbol
  const { price: livePrice, loading: priceLoading } = useLivePrice(symbol);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showSymbolDropdown &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        symbolInputRef.current &&
        !symbolInputRef.current.contains(event.target)
      ) {
        // Use setTimeout to allow dropdown item clicks to process first
        setTimeout(() => {
          setShowSymbolDropdown(false);
        }, 100);
      }
    };

    if (showSymbolDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSymbolDropdown]);
  
  const [calculations, setCalculations] = useState({
    positionSize: 0,
    riskAmount: 0,
    potentialProfit: 0,
    riskRewardRatio: 0,
    stopLossPercent: 0,
    takeProfitPercent: 0,
  });

  // Fetch trading pairs on mount
  useEffect(() => {
    const loadPairs = async () => {
      setLoadingPairs(true);
      try {
        const pairs = await fetchTradingPairs();
        setTradingPairs(pairs);
        setFilteredPairs(pairs.slice(0, 20)); // Show top 20 initially
      } catch (error) {
        console.error('Error loading trading pairs:', error);
      } finally {
        setLoadingPairs(false);
      }
    };
    loadPairs();
  }, []);

  // Filter pairs based on search
  useEffect(() => {
    if (!symbolSearch.trim()) {
      setFilteredPairs(tradingPairs.slice(0, 20));
    } else {
      const searchLower = symbolSearch.toLowerCase();
      const filtered = tradingPairs.filter(pair =>
        pair.displaySymbol.toLowerCase().includes(searchLower) ||
        pair.baseAsset.toLowerCase().includes(searchLower)
      ).slice(0, 20);
      setFilteredPairs(filtered);
    }
  }, [symbolSearch, tradingPairs]);

  // Auto-fill current price when symbol changes and live price is available
  useEffect(() => {
    if (livePrice && !openPrice) {
      setOpenPrice(livePrice.toFixed(2));
    }
  }, [livePrice, openPrice]);

  useEffect(() => {
    if (openPrice && stopLoss && rValue) {
      const open = parseFloat(openPrice);
      const sl = parseFloat(stopLoss);
      const tp = parseFloat(takeProfit) || 0;
      const risk = rValue * riskMultiple;
      
      // Calculate stop loss percentage
      let stopLossPercent;
      if (tradeType === 'long') {
        stopLossPercent = ((open - sl) / open) * 100;
      } else {
        stopLossPercent = ((sl - open) / open) * 100;
      }
      
      // With leverage, the effective stop loss percentage is amplified
      const effectiveStopLossPercent = stopLossPercent * leverage;
      
      // Position size = Risk Amount / (Stop Loss % * Leverage adjustment)
      const positionSize = (risk / (stopLossPercent / 100));
      
      // Calculate potential profit
      let takeProfitPercent = 0;
      let potentialProfit = 0;
      if (tp) {
        if (tradeType === 'long') {
          takeProfitPercent = ((tp - open) / open) * 100;
        } else {
          takeProfitPercent = ((open - tp) / open) * 100;
        }
        potentialProfit = (positionSize * (takeProfitPercent / 100));
      }
      
      // Risk reward ratio
      const riskRewardRatio = takeProfitPercent > 0 ? takeProfitPercent / stopLossPercent : 0;
      
      setCalculations({
        positionSize: positionSize,
        riskAmount: risk,
        potentialProfit: potentialProfit,
        riskRewardRatio: riskRewardRatio,
        stopLossPercent: stopLossPercent,
        takeProfitPercent: takeProfitPercent,
      });
    } else {
      setCalculations({
        positionSize: 0,
        riskAmount: rValue * riskMultiple,
        potentialProfit: 0,
        riskRewardRatio: 0,
        stopLossPercent: 0,
        takeProfitPercent: 0,
      });
    }
  }, [openPrice, stopLoss, takeProfit, leverage, rValue, riskMultiple, tradeType]);

  const handleSymbolSelect = (selectedPair) => {
    setSymbol(selectedPair.displaySymbol);
    setSymbolSearch('');
    // Close dropdown immediately
    setShowSymbolDropdown(false);
  };

  const handleOpenTrade = () => {
    if (!symbol || !openPrice || !stopLoss) {
      alert('Please fill in Symbol, Open Price, and Stop Loss');
      return;
    }

    const selectedDate = new Date(tradeDate);
    selectedDate.setHours(new Date().getHours(), new Date().getMinutes());

    const trade = {
      id: Date.now(),
      symbol: symbol.toUpperCase(),
      type: tradeType,
      openPrice: parseFloat(openPrice),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit) || null,
      leverage: leverage,
      positionSize: calculations.positionSize,
      riskAmount: calculations.riskAmount,
      riskMultiple: riskMultiple,
      openDate: selectedDate.toISOString(),
      status: 'open',
    };

    onNewTrade(trade);
    
    // Reset form
    setSymbol('');
    setOpenPrice('');
    setStopLoss('');
    setTakeProfit('');
    setRiskMultiple(1);
  };

  return (
    <div className="position-sizer-h">
      {/* Header */}
      <div className="sizer-header-h">
        <div className="header-left">
          <h2>Place Trade</h2>
          <p className="subtitle">Calculate position size and open a trade</p>
        </div>
        <div className="header-right">
          {symbol && (
            <button
              className="chart-toggle-btn"
              onClick={() => setShowChart(!showChart)}
              title={showChart ? 'Hide chart' : 'Show chart'}
            >
              {showChart ? 'Hide Chart' : 'Show Chart'}
            </button>
          )}
          <div className="risk-badge">
            <span className="risk-label">Risking</span>
            <span className="risk-amount">${(rValue * riskMultiple).toFixed(2)}</span>
            <span className="risk-r">{riskMultiple}R</span>
          </div>
        </div>
      </div>

      {/* Price Chart - Toggleable */}
      {showChart && symbol && (
        <div className="chart-section">
          <PriceChart symbol={symbol} height={150} />
        </div>
      )}

      {/* Trade Type Toggle */}
      <div className="trade-type-h">
        <button 
          className={`type-btn-h long ${tradeType === 'long' ? 'active' : ''}`}
          onClick={() => setTradeType('long')}
        >
          <ArrowUp size={18} strokeWidth={3} />
          <span className="type-text">LONG</span>
        </button>
        <button 
          className={`type-btn-h short ${tradeType === 'short' ? 'active' : ''}`}
          onClick={() => setTradeType('short')}
        >
          <ArrowDown size={18} strokeWidth={3} />
          <span className="type-text">SHORT</span>
        </button>
      </div>

      {/* Main Form - Horizontal Layout */}
      <div className="form-grid-h">
        {/* Row 1 - Basic Info */}
        <div className="form-section">
          <h4 className="section-title">Trade Info</h4>
          <div className="input-row-h">
            <div className="input-group-h symbol-input-group">
              <label>Symbol</label>
              <div className="symbol-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  ref={symbolInputRef}
                  type="text"
                  value={symbolSearch || symbol}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSymbolSearch(value);
                    // If user types a valid format, set symbol
                    if (value && value.length >= 2) {
                      // Convert to display format if needed
                      const displayFormat = value.includes('/') 
                        ? value.toUpperCase() 
                        : value.length > 4 && value.toUpperCase().endsWith('USDT')
                        ? `${value.slice(0, -4).toUpperCase()}/USDT`
                        : `${value.toUpperCase()}/USDT`;
                      setSymbol(displayFormat);
                    } else if (!value) {
                      setSymbol('');
                    }
                    if (!showSymbolDropdown && value) setShowSymbolDropdown(true);
                  }}
                  onFocus={() => {
                    if (symbolSearch || symbol) setShowSymbolDropdown(true);
                  }}
                  placeholder="Search trading pair (e.g., BTC/USDT)..."
                  className="symbol-input"
                />
                {livePrice && symbol && (
                  <div className="live-price-badge">
                    {priceLoading ? (
                      <span className="price-loading">...</span>
                    ) : (
                      <span className="price-value">${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                    )}
                  </div>
                )}
                {showSymbolDropdown && (
                  <div ref={dropdownRef} className="symbol-dropdown">
                    {loadingPairs ? (
                      <div className="dropdown-loading">Loading pairs...</div>
                    ) : filteredPairs.length === 0 ? (
                      <div className="dropdown-empty">No pairs found</div>
                    ) : (
                      filteredPairs.map((pair) => (
                        <div
                          key={pair.symbol}
                          className="dropdown-item"
                          onClick={() => handleSymbolSelect(pair)}
                        >
                          <span className="pair-symbol">{pair.displaySymbol}</span>
                          <span className="pair-base">{pair.baseAsset}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="input-group-h">
              <label>Date</label>
              <input
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="date-input"
              />
            </div>
          </div>
        </div>

        {/* Row 2 - Prices */}
        <div className="form-section">
          <h4 className="section-title">Price Levels</h4>
          <div className="input-row-h">
            <div className="input-group-h">
              <label>Entry Price</label>
              <input
                type="number"
                value={openPrice}
                onChange={(e) => setOpenPrice(e.target.value)}
                placeholder="0.00"
                step="any"
              />
            </div>
            <div className="input-group-h">
              <label>Stop Loss</label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="0.00"
                step="any"
                className="input-danger"
              />
            </div>
            <div className="input-group-h">
              <label>Take Profit</label>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="0.00"
                step="any"
                className="input-success"
              />
            </div>
          </div>
        </div>

        {/* Row 3 - Settings */}
        <div className="form-section">
          <h4 className="section-title">Settings</h4>
          <div className="settings-row-h">
            <div className="setting-group">
              <label>Leverage</label>
              <div className="button-group-h">
                {[1, 2, 3, 5, 10, 20, 50, 100].map((lev) => (
                  <button
                    key={lev}
                    className={`setting-btn ${leverage === lev ? 'active' : ''}`}
                    onClick={() => setLeverage(lev)}
                  >
                    {lev}x
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-group">
              <label>Risk (R)</label>
              <div className="button-group-h">
                {[0.5, 1, 1.5, 2, 3].map((r) => (
                  <button
                    key={r}
                    className={`setting-btn risk ${riskMultiple === r ? 'active' : ''}`}
                    onClick={() => setRiskMultiple(r)}
                  >
                    {r}R
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="results-section-h">
        <div className="result-card main">
          <span className="result-label">Position Size</span>
          <span className="result-value">
            ${calculations.positionSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        
        <div className="result-card">
          <span className="result-label">Stop Loss</span>
          <span className="result-value danger">
            -{calculations.stopLossPercent.toFixed(2)}%
          </span>
          <span className="result-sub">${calculations.riskAmount.toFixed(2)}</span>
        </div>
        
        <div className="result-card">
          <span className="result-label">Take Profit</span>
          <span className="result-value success">
            +{calculations.takeProfitPercent.toFixed(2)}%
          </span>
          <span className="result-sub">${calculations.potentialProfit.toFixed(2)}</span>
        </div>
        
        <div className="result-card">
          <span className="result-label">Risk/Reward</span>
          <span className={`result-value ${calculations.riskRewardRatio >= 2 ? 'success' : calculations.riskRewardRatio >= 1 ? 'warning' : 'danger'}`}>
            1:{calculations.riskRewardRatio.toFixed(2)}
          </span>
        </div>

        <button className="submit-btn" onClick={handleOpenTrade}>
          <Zap size={18} />
          <span>Open Trade</span>
        </button>
      </div>
    </div>
  );
};

export default PositionSizer;
