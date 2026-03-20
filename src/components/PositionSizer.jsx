import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, Zap, Search } from 'lucide-react';
import { fetchTradingPairs } from '../lib/binance';
import { useLivePrice } from '../hooks/useLivePrice';
import './PositionSizer.css';

const LEVERAGE_LEVELS = [1, 2, 3, 5, 10, 20, 50, 100];
const RISK_LEVELS = [0.5, 1, 1.5, 2, 3];

const PositionSizer = ({ rValue, onNewTrade, onSymbolChange }) => {
  const [tradeType, setTradeType] = useState('long');
  const [openPrice, setOpenPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [riskMultiple, setRiskMultiple] = useState(1);
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [tradeDate, setTradeDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [tradingPairs, setTradingPairs] = useState([]);
  const [filteredPairs, setFilteredPairs] = useState([]);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [loadingPairs, setLoadingPairs] = useState(true);
  const symbolInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const { price: livePrice, loading: priceLoading } = useLivePrice(symbol);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showSymbolDropdown &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        symbolInputRef.current &&
        !symbolInputRef.current.contains(event.target)
      ) {
        setTimeout(() => setShowSymbolDropdown(false), 100);
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

  useEffect(() => {
    const loadPairs = async () => {
      setLoadingPairs(true);
      try {
        const pairs = await fetchTradingPairs();
        setTradingPairs(pairs);
        setFilteredPairs(pairs.slice(0, 20));
      } catch (error) {
        console.error('Error loading trading pairs:', error);
      } finally {
        setLoadingPairs(false);
      }
    };
    loadPairs();
  }, []);

  useEffect(() => {
    if (symbol && onSymbolChange) onSymbolChange(symbol);
  }, [symbol, onSymbolChange]);

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

  useEffect(() => {
    if (openPrice && stopLoss && rValue) {
      const open = parseFloat(openPrice);
      const sl = parseFloat(stopLoss);
      const tp = parseFloat(takeProfit) || 0;
      const risk = rValue * riskMultiple;

      let stopLossPercent;
      if (tradeType === 'long') {
        stopLossPercent = ((open - sl) / open) * 100;
      } else {
        stopLossPercent = ((sl - open) / open) * 100;
      }

      const positionSize = (risk / (stopLossPercent / 100));

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

      const riskRewardRatio = takeProfitPercent > 0 ? takeProfitPercent / stopLossPercent : 0;

      setCalculations({
        positionSize,
        riskAmount: risk,
        potentialProfit,
        riskRewardRatio,
        stopLossPercent,
        takeProfitPercent,
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
      leverage,
      positionSize: calculations.positionSize,
      riskAmount: calculations.riskAmount,
      riskMultiple,
      openDate: selectedDate.toISOString(),
      status: 'open',
      fee: 0,
    };

    onNewTrade(trade);
    setSymbol('');
    setOpenPrice('');
    setStopLoss('');
    setTakeProfit('');
    setRiskMultiple(1);
  };

  const leverageIndex = Math.max(0, LEVERAGE_LEVELS.indexOf(leverage));
  const leverageProgress = (leverageIndex / (LEVERAGE_LEVELS.length - 1)) * 100;

  const riskIndex = Math.max(0, RISK_LEVELS.indexOf(riskMultiple));
  const riskProgress = (riskIndex / (RISK_LEVELS.length - 1)) * 100;

  return (
    <div className="position-sizer-h glass-card">
      {/* Header */}
      <div className="ps-header">
        <h2 className="ps-title">Place Order</h2>
        <div className="risk-badge">
          <span className="risk-label">Risking</span>
          <span className="risk-amount">${(rValue * riskMultiple).toFixed(2)}</span>
          <span className="risk-r">{riskMultiple}R</span>
        </div>
      </div>

      {/* Trade Type Toggle */}
      <div className="ps-type-toggle">
        <button
          className={`ps-type-btn long ${tradeType === 'long' ? 'active' : ''}`}
          onClick={() => setTradeType('long')}
        >
          <ArrowUp size={15} strokeWidth={3} />
          LONG
        </button>
        <button
          className={`ps-type-btn short ${tradeType === 'short' ? 'active' : ''}`}
          onClick={() => setTradeType('short')}
        >
          <ArrowDown size={15} strokeWidth={3} />
          SHORT
        </button>
      </div>

      {/* Form */}
      <div className="ps-form">

        {/* Symbol + Date */}
        <div className="ps-row">
          <div className="ps-field ps-field--symbol symbol-input-group">
            <label>Symbol</label>
            <div className="symbol-input-wrapper">
              <Search size={13} className="search-icon" />
              <input
                ref={symbolInputRef}
                type="text"
                value={symbolSearch || symbol}
                onChange={(e) => {
                  const value = e.target.value;
                  setSymbolSearch(value);
                  if (value && value.length >= 2) {
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
                placeholder="Search pair..."
                className="symbol-input"
              />
              {livePrice && symbol && (
                <button
                  type="button"
                  className="live-price-badge"
                  onClick={() => setOpenPrice(livePrice.toFixed(2))}
                  title="Click to use as entry price"
                >
                  {priceLoading ? (
                    <span className="price-loading">...</span>
                  ) : (
                    <span className="price-value">${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                  )}
                </button>
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
          <div className="ps-field ps-field--date">
            <label>Date</label>
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="date-input"
            />
          </div>
        </div>

        {/* Price Levels */}
        <div className="ps-section-label">Price Levels</div>
        <div className="ps-row ps-row--3">
          <div className="ps-field">
            <label>Entry</label>
            <input
              type="number"
              value={openPrice}
              onChange={(e) => setOpenPrice(e.target.value)}
              placeholder="0.00"
              step="any"
            />
          </div>
          <div className="ps-field">
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
          <div className="ps-field">
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

        {/* Leverage Slider */}
        <div className="ps-slider-section">
          <div className="slider-header">
            <span className="slider-label">Leverage</span>
            <span className="slider-value leverage-val">{leverage}x</span>
          </div>
          <input
            type="range"
            className="ps-slider"
            min="0"
            max={LEVERAGE_LEVELS.length - 1}
            step="1"
            value={leverageIndex}
            onChange={(e) => setLeverage(LEVERAGE_LEVELS[parseInt(e.target.value)])}
            style={{ '--progress': `${leverageProgress}%` }}
          />
          <div className="slider-ticks">
            {LEVERAGE_LEVELS.map((l) => (
              <span key={l} className={leverage === l ? 'active' : ''}>{l}x</span>
            ))}
          </div>
        </div>

        {/* Risk Slider */}
        <div className="ps-slider-section">
          <div className="slider-header">
            <span className="slider-label">Risk Multiplier</span>
            <span className="slider-value risk-val">{riskMultiple}R · ${(rValue * riskMultiple).toFixed(0)}</span>
          </div>
          <input
            type="range"
            className="ps-slider risk-slider"
            min="0"
            max={RISK_LEVELS.length - 1}
            step="1"
            value={riskIndex}
            onChange={(e) => setRiskMultiple(RISK_LEVELS[parseInt(e.target.value)])}
            style={{ '--progress': `${riskProgress}%` }}
          />
          <div className="slider-ticks">
            {RISK_LEVELS.map((r) => (
              <span key={r} className={riskMultiple === r ? 'active' : ''}>{r}R</span>
            ))}
          </div>
        </div>

      </div>

      {/* Results */}
      <div className="ps-results">
        <div className="ps-result-main">
          <span className="result-label">Position Size</span>
          <span className="result-value-main">
            ${calculations.positionSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="ps-result-row">
          <div className="ps-result-item">
            <span className="result-label">Stop Loss</span>
            <span className="result-value danger">-{calculations.stopLossPercent.toFixed(2)}%</span>
            <span className="result-sub">${calculations.riskAmount.toFixed(2)}</span>
          </div>
          <div className="ps-result-item">
            <span className="result-label">Take Profit</span>
            <span className="result-value success">+{calculations.takeProfitPercent.toFixed(2)}%</span>
            <span className="result-sub">${calculations.potentialProfit.toFixed(2)}</span>
          </div>
          <div className="ps-result-item">
            <span className="result-label">Risk / Reward</span>
            <span className={`result-value ${calculations.riskRewardRatio >= 2 ? 'success' : calculations.riskRewardRatio >= 1 ? 'warning' : 'danger'}`}>
              1:{calculations.riskRewardRatio.toFixed(2)}
            </span>
          </div>
        </div>
        <button className="ps-submit-btn" onClick={handleOpenTrade}>
          <Zap size={16} />
          Open Trade
        </button>
      </div>
    </div>
  );
};

export default PositionSizer;
