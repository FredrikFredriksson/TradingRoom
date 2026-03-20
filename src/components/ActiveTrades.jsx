import { useState, useMemo } from 'react';
import { useLivePrice } from '../hooks/useLivePrice';
import { Trash2, ArrowUp, ArrowDown, Activity, CheckCircle, XCircle } from 'lucide-react';
import './ActiveTrades.css';

const fmtPrice = (v) => {
  if (v == null) return '-';
  if (v >= 1000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  return `$${v.toFixed(6)}`;
};

const TradeCard = ({
  trade,
  isClosing,
  closePrice,
  closeComment,
  onCloseClick,
  onConfirmClose,
  onCancelClose,
  onClosePriceChange,
  onCloseCommentChange,
  onDelete,
}) => {
  const { price: livePrice, loading: livePriceLoading } = useLivePrice(trade.symbol);

  const unrealized = useMemo(() => {
    if (!livePrice) return null;
    const pnlPercent =
      trade.type === 'long'
        ? ((livePrice - trade.openPrice) / trade.openPrice) * 100
        : ((trade.openPrice - livePrice) / trade.openPrice) * 100;
    const pnlDollar = trade.positionSize * (pnlPercent / 100);
    const rResult = trade.riskAmount > 0 ? pnlDollar / trade.riskAmount : 0;
    return { pnlPercent, pnlDollar, rResult };
  }, [livePrice, trade]);

  const pnlPreview = useMemo(() => {
    if (!closePrice) return null;
    const cp = parseFloat(closePrice);
    if (isNaN(cp) || cp <= 0) return null;
    const pnlPercent =
      trade.type === 'long'
        ? ((cp - trade.openPrice) / trade.openPrice) * 100
        : ((trade.openPrice - cp) / trade.openPrice) * 100;
    const pnlDollar = trade.positionSize * (pnlPercent / 100);
    return { pnlPercent, pnlDollar };
  }, [closePrice, trade]);

  const slPct =
    trade.type === 'long'
      ? ((trade.stopLoss - trade.openPrice) / trade.openPrice) * 100
      : ((trade.openPrice - trade.stopLoss) / trade.openPrice) * 100;

  const tpPct = trade.takeProfit
    ? trade.type === 'long'
      ? ((trade.takeProfit - trade.openPrice) / trade.openPrice) * 100
      : ((trade.openPrice - trade.takeProfit) / trade.openPrice) * 100
    : null;

  const isUp = unrealized ? unrealized.pnlDollar >= 0 : null;

  return (
    <div className={`trade-card-v2 ${trade.type} ${isClosing ? 'is-closing' : ''}`}>
      {/* Header row */}
      <div className="tc-header">
        <div className="tc-identity">
          <span className={`tc-type-badge ${trade.type}`}>
            {trade.type === 'long' ? (
              <ArrowUp size={10} strokeWidth={3} />
            ) : (
              <ArrowDown size={10} strokeWidth={3} />
            )}
            {trade.type.toUpperCase()}
          </span>
          <span className="tc-symbol">{trade.symbol}</span>
          <span className="tc-leverage">{trade.leverage}x</span>
        </div>

        <div className="tc-header-right">
          <span className="tc-date">
            {new Date(trade.openDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {!isClosing && (
            <div className="tc-actions">
              <button className="tc-close-btn" onClick={() => onCloseClick(trade.id)}>
                Close
              </button>
              <button
                className="tc-delete-btn"
                onClick={() => onDelete(trade.id)}
                aria-label="Delete trade"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Price levels + P&L — shown when not closing */}
      {!isClosing && (
        <div className="tc-levels">
          <div className="tc-level">
            <span className="tc-level-label">Entry</span>
            <span className="tc-level-value">{fmtPrice(trade.openPrice)}</span>
          </div>

          <div className="tc-level">
            <span className="tc-level-label">Stop Loss</span>
            <span className="tc-level-value danger">{fmtPrice(trade.stopLoss)}</span>
            <span className="tc-level-pct danger">{slPct.toFixed(2)}%</span>
          </div>

          <div className="tc-level">
            <span className="tc-level-label">Take Profit</span>
            {trade.takeProfit ? (
              <>
                <span className="tc-level-value success">{fmtPrice(trade.takeProfit)}</span>
                {tpPct !== null && (
                  <span className="tc-level-pct success">+{tpPct.toFixed(2)}%</span>
                )}
              </>
            ) : (
              <span className="tc-level-value muted">—</span>
            )}
          </div>

          <div className="tc-level pnl-level">
            <span className="tc-level-label">Unrealized P&amp;L</span>
            {unrealized ? (
              <>
                <span
                  className={`tc-level-value pnl-value ${isUp ? 'success' : 'danger'}`}
                >
                  {isUp ? '+' : ''}${unrealized.pnlDollar.toFixed(2)}
                </span>
                <span className={`tc-level-pct ${isUp ? 'success' : 'danger'}`}>
                  {unrealized.pnlPercent >= 0 ? '+' : ''}
                  {unrealized.pnlPercent.toFixed(2)}%&nbsp;·&nbsp;
                  {unrealized.rResult >= 0 ? '+' : ''}
                  {unrealized.rResult.toFixed(2)}R
                </span>
              </>
            ) : (
              <span className="tc-level-value muted">
                {livePriceLoading ? 'Loading…' : 'No price'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Close form */}
      {isClosing && (
        <div className="tc-close-form">
          <div className="tc-close-input-row">
            <div className="tc-close-input-group">
              <label>Exit Price</label>
              <input
                type="number"
                value={closePrice}
                onChange={(e) => onClosePriceChange(e.target.value)}
                placeholder="Enter exit price"
                autoFocus
                step="any"
              />
            </div>
            {livePrice != null && (
              <button
                className="tc-live-btn"
                type="button"
                onClick={() => onClosePriceChange(livePrice.toFixed(2))}
                disabled={livePriceLoading}
              >
                <span>{livePriceLoading ? '…' : fmtPrice(livePrice)}</span>
                <span className="tc-live-label">LIVE</span>
              </button>
            )}
          </div>

          {pnlPreview && (
            <div className={`tc-pnl-preview ${pnlPreview.pnlDollar >= 0 ? 'positive' : 'negative'}`}>
              <span className="pnl-label">P&amp;L Preview</span>
              <span className="pnl-amount">
                {pnlPreview.pnlDollar >= 0 ? '+' : ''}${pnlPreview.pnlDollar.toFixed(2)}
              </span>
              <span className="pnl-pct">
                {pnlPreview.pnlPercent >= 0 ? '+' : ''}
                {pnlPreview.pnlPercent.toFixed(2)}%
              </span>
            </div>
          )}

          <textarea
            value={closeComment}
            onChange={(e) => onCloseCommentChange(e.target.value)}
            placeholder="Add a comment (optional)"
            className="tc-comment"
            rows={2}
          />

          <div className="tc-close-actions">
            <button className="tc-cancel-close-btn" type="button" onClick={onCancelClose}>
              <XCircle size={14} />
              Cancel
            </button>
            <button className="tc-confirm-close-btn" type="button" onClick={onConfirmClose}>
              <CheckCircle size={14} />
              Confirm Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ActiveTrades = ({ trades, onCloseTrade, onDeleteTrade }) => {
  const [closingTradeId, setClosingTradeId] = useState(null);
  const [closePrice, setClosePrice] = useState('');
  const [closeComment, setCloseComment] = useState('');

  const activeTrades = trades.filter((t) => t.status === 'open');

  const handleCloseClick = (tradeId) => {
    setClosingTradeId(tradeId);
    setClosePrice('');
    setCloseComment('');
  };

  const handleConfirmClose = () => {
    if (!closePrice) {
      alert('Please enter the closing price');
      return;
    }
    onCloseTrade(closingTradeId, parseFloat(closePrice), closeComment);
    setClosingTradeId(null);
    setClosePrice('');
    setCloseComment('');
  };

  const handleCancelClose = () => {
    setClosingTradeId(null);
    setClosePrice('');
    setCloseComment('');
  };

  const handleDelete = (tradeId) => {
    const trade = activeTrades.find((t) => t.id === tradeId);
    if (window.confirm(`Delete ${trade?.symbol || ''} trade? This cannot be undone.`)) {
      onDeleteTrade(tradeId);
    }
  };

  if (activeTrades.length === 0) {
    return (
      <div className="active-trades-v2 empty glass-card">
        <div className="empty-state-v2">
          <Activity size={28} />
          <h3>No Active Positions</h3>
          <p>Open a trade using the form on the left</p>
        </div>
      </div>
    );
  }

  return (
    <div className="active-trades-v2 glass-card">
      <div className="at-header">
        <h2>Active Positions</h2>
        <span className="at-count">{activeTrades.length}</span>
      </div>
      <div className="at-list">
        {activeTrades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            isClosing={closingTradeId === trade.id}
            closePrice={closingTradeId === trade.id ? closePrice : ''}
            closeComment={closingTradeId === trade.id ? closeComment : ''}
            onCloseClick={handleCloseClick}
            onConfirmClose={handleConfirmClose}
            onCancelClose={handleCancelClose}
            onClosePriceChange={setClosePrice}
            onCloseCommentChange={setCloseComment}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default ActiveTrades;
