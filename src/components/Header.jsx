import demoMark from '../assets/tradingroom-mark.svg';
import './Header.css';

const Header = ({
  title,
  subtitle,
  closedTrades,
  openTrades,
  winRate,
  rValue,
  balance,
}) => {
  const balanceInR = rValue > 0 ? (balance / rValue).toFixed(1) : 0;

  const summaryCards = [
    {
      label: 'Account Value',
      value: `$${balance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      meta: `${balanceInR}R tracked`,
      tone: 'positive',
    },
    {
      label: 'Risk Unit',
      value: `$${rValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
      meta: 'Fixed demo baseline',
      tone: 'accent',
    },
    {
      label: 'Closed Trades',
      value: String(closedTrades),
      meta: `${winRate.toFixed(0)}% win rate`,
      tone: 'neutral',
    },
    {
      label: 'Open Trades',
      value: String(openTrades),
      meta: 'Live market pricing',
      tone: 'neutral',
    },
  ];

  return (
    <header className="header">
      <div className="header-brand">
        <div className="logo">
          <div className="logo-icon">
            <img src={demoMark} alt="" />
          </div>
          <div className="brand-text">
            <div className="brand-row">
              <h1>TradingRoom</h1>
              <span className="version">{title}</span>
            </div>
            <p>{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="header-controls">
        <div className="demo-pill">Public Demo Dataset</div>
        <div className="summary-grid">
          {summaryCards.map((card) => (
            <div key={card.label} className={`summary-card ${card.tone}`}>
              <span className="summary-label">{card.label}</span>
              <strong className="summary-value">{card.value}</strong>
              <span className="summary-meta">{card.meta}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Header;
