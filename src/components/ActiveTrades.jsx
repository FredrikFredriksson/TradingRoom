import { useState } from 'react';
import './ActiveTrades.css';

const ActiveTrades = ({ trades, onCloseTrade }) => {
  const [closingTrade, setClosingTrade] = useState(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeComment, setCloseComment] = useState('');

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
      <div className="active-trades empty">
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <h3>No Active Trades</h3>
          <p>Open a trade using the Position Sizer to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="active-trades">
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
              
              <div className="trade-details">
                <div className="detail-row">
                  <span className="detail-label">Entry</span>
                  <span className="detail-value">${trade.openPrice.toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Stop Loss</span>
                  <span className="detail-value negative">${trade.stopLoss.toLocaleString()}</span>
                </div>
                {trade.takeProfit && (
                  <div className="detail-row">
                    <span className="detail-label">Take Profit</span>
                    <span className="detail-value positive">${trade.takeProfit.toLocaleString()}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Position Size</span>
                  <span className="detail-value">${trade.positionSize.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Risk</span>
                  <span className="detail-value risk">${trade.riskAmount.toFixed(2)} ({trade.riskMultiple}R)</span>
                </div>
              </div>

              {closingTrade?.id === trade.id ? (
                <div className="close-trade-form">
                  <input
                    type="number"
                    value={closePrice}
                    onChange={(e) => setClosePrice(e.target.value)}
                    placeholder="Closing Price"
                    autoFocus
                  />
                  {pnl && (
                    <div className={`pnl-preview ${pnl.pnlDollar >= 0 ? 'positive' : 'negative'}`}>
                      {pnl.pnlDollar >= 0 ? '+' : ''}{pnl.pnlPercent.toFixed(2)}% 
                      (${pnl.pnlDollar >= 0 ? '+' : ''}{pnl.pnlDollar.toFixed(2)})
                    </div>
                  )}
                  <textarea
                    value={closeComment}
                    onChange={(e) => setCloseComment(e.target.value)}
                    placeholder="Add a comment about this trade (optional)..."
                    className="close-comment"
                    rows={3}
                  />
                  <div className="close-actions">
                    <button className="confirm-btn" onClick={handleConfirmClose}>
                      Confirm Close
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
                  Close Trade
                </button>
              )}

              <div className="trade-date">
                Opened: {new Date(trade.openDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActiveTrades;
