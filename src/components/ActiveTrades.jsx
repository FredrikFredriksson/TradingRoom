import { useState } from 'react';
import { useLivePrice } from '../hooks/useLivePrice';
import TradePositionChart from './TradePositionChart';
import './ActiveTrades.css';

const ActiveTrades = ({ trades, onCloseTrade }) => {
  const [closingTrade, setClosingTrade] = useState(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeComment, setCloseComment] = useState('');
  const { price: livePrice, loading: livePriceLoading } = useLivePrice(closingTrade?.symbol || '');

  const activeTrades = trades.filter(t => t.status === 'open');

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

  const calculatePnL = (trade) => {
    // This is just for display with current price input
    if (!closingTrade || closingTrade.id !== trade.id || !closePrice) return null;
    
    const cp = parseFloat(closePrice);
    let pnlPercent;
    if (trade.type === 'long') {
      pnlPercent = ((cp - trade.openPrice) / trade.openPrice) * 100;
    } else {
      pnlPercent = ((trade.openPrice - cp) / trade.openPrice) * 100;
    }
    const pnlDollar = trade.positionSize * (pnlPercent / 100);
    return { pnlPercent, pnlDollar };
  };

  if (activeTrades.length === 0) {
    return (
      <div className="active-trades empty glass-card">
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <h3>No Active Trades</h3>
          <p>Open a trade using the Position Sizer to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="active-trades glass-card">
      <h2>Active Trades</h2>
      <div className="trades-list">
        {activeTrades.map((trade) => {
          const pnl = calculatePnL(trade);
          return (
            <div key={trade.id} className={`trade-card ${trade.type}`}>
              <div className="trade-header">
                <div className="trade-symbol">
                  <span className={`trade-type-badge ${trade.type}`}>
                    {trade.type === 'long' ? '↑' : '↓'}
                  </span>
                  {trade.symbol}
                </div>
                <span className="trade-leverage">{trade.leverage}x</span>
              </div>
              
              <div className="trade-chart-container">
                <TradePositionChart
                  symbol={trade.symbol}
                  entryPrice={trade.openPrice}
                  stopLoss={trade.stopLoss}
                  takeProfit={trade.takeProfit}
                  type={trade.type}
                  height={320}
                />
              </div>
              
              <div className="trade-details">
                <div className="detail-row">
                  <span className="detail-label">Ent</span>
                  <span className="detail-value">${trade.openPrice.toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">SL</span>
                  <span className="detail-value negative">${trade.stopLoss.toLocaleString()}</span>
                </div>
                {trade.takeProfit && (
                  <div className="detail-row">
                    <span className="detail-label">TP</span>
                    <span className="detail-value positive">${trade.takeProfit.toLocaleString()}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Size</span>
                  <span className="detail-value">${trade.positionSize.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">R</span>
                  <span className="detail-value risk">${trade.riskAmount.toFixed(2)} ({trade.riskMultiple}R)</span>
                </div>
              </div>

              {closingTrade?.id === trade.id ? (
                <div className="close-trade-form">
                  <div className="close-price-row">
                    <input
                      type="number"
                      value={closePrice}
                      onChange={(e) => setClosePrice(e.target.value)}
                      placeholder="Exit price"
                      autoFocus
                    />
                    {livePrice != null && (
                      <button
                        type="button"
                        className="use-live-price-btn"
                        onClick={() => setClosePrice(livePrice.toFixed(2))}
                        disabled={livePriceLoading}
                        title="Use current market price"
                      >
                        {livePriceLoading ? '...' : `$${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`}
                      </button>
                    )}
                  </div>
                  {pnl && (
                    <div className={`pnl-preview ${pnl.pnlDollar >= 0 ? 'positive' : 'negative'}`}>
                      {pnl.pnlDollar >= 0 ? '+' : ''}{pnl.pnlPercent.toFixed(2)}% 
                      (${pnl.pnlDollar >= 0 ? '+' : ''}{pnl.pnlDollar.toFixed(2)})
                    </div>
                  )}
                  <textarea
                    value={closeComment}
                    onChange={(e) => setCloseComment(e.target.value)}
                    placeholder="Comment (optional)"
                    className="close-comment"
                    rows={2}
                  />
                  <div className="close-actions">
                    <button className="confirm-btn" onClick={handleConfirmClose}>
                      Confirm
                    </button>
                    <button className="cancel-btn" onClick={handleCancelClose}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  className="close-trade-btn"
                  onClick={() => handleCloseClick(trade)}
                >
                  Close
                </button>
              )}

              <div className="trade-date">
                {new Date(trade.openDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveTrades;
