import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, Zap } from 'lucide-react';
import './PositionSizer.css';

const PositionSizer = ({ rValue, onNewTrade }) => {
  const [tradeType, setTradeType] = useState('long');
  const [openPrice, setOpenPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [riskMultiple, setRiskMultiple] = useState(1);
  const [symbol, setSymbol] = useState('');
  const [tradeDate, setTradeDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [calculations, setCalculations] = useState({
    positionSize: 0,
    riskAmount: 0,
    potentialProfit: 0,
    riskRewardRatio: 0,
    stopLossPercent: 0,
    takeProfitPercent: 0,
  });

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
        <div className="risk-badge">
          <span className="risk-label">Risking</span>
          <span className="risk-amount">${(rValue * riskMultiple).toFixed(2)}</span>
          <span className="risk-r">{riskMultiple}R</span>
        </div>
      </div>

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
            <div className="input-group-h">
              <label>Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="BTC, ETH..."
              />
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
