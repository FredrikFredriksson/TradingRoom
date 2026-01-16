import { useState } from 'react';
import './Header.css';

const Header = ({ 
  rValue, 
  onRValueChange, 
  balance, 
  onBalanceChange, 
  supabaseConnected,
  blofinConnected,
  onSettingsClick,
  onSyncBlofin,
  onImportHistory,
  blofinSyncing
}) => {
  const [isEditingR, setIsEditingR] = useState(false);
  const [tempRValue, setTempRValue] = useState(rValue);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState(balance);

  const handleRSubmit = () => {
    const value = parseFloat(tempRValue);
    if (value > 0) {
      onRValueChange(value);
    }
    setIsEditingR(false);
  };

  const handleBalanceSubmit = () => {
    const value = parseFloat(tempBalance);
    if (value >= 0) {
      onBalanceChange(value);
    }
    setIsEditingBalance(false);
  };

  const handleRKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRSubmit();
    }
    if (e.key === 'Escape') {
      setTempRValue(rValue);
      setIsEditingR(false);
    }
  };

  const handleBalanceKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBalanceSubmit();
    }
    if (e.key === 'Escape') {
      setTempBalance(balance);
      setIsEditingBalance(false);
    }
  };

  // Calculate R equivalent
  const balanceInR = rValue > 0 ? (balance / rValue).toFixed(1) : 0;

  return (
    <header className="header">
      <div className="header-brand">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L9 11L13 15L21 7" stroke="url(#gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 7H21V11" stroke="url(#gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="gradient" x1="3" y1="7" x2="21" y2="17" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="brand-text">
            <h1>TradingRoom</h1>
            <span className="version">v2.0</span>
          </div>
        </div>
      </div>
      
      <div className="header-controls">
        {/* Connection Indicators */}
        <div className="connection-indicators">
          {supabaseConnected && (
            <div className="sync-status supabase" title="Supabase Connected">
              <span className="sync-dot"></span>
              <span className="sync-text">DB</span>
            </div>
          )}
          
          {blofinConnected ? (
            <div className="sync-status blofin" title="Blofin Connected">
              <span className="sync-dot"></span>
              <span className="sync-text">Blofin</span>
              <button 
                className="sync-btn"
                onClick={onSyncBlofin}
                disabled={blofinSyncing}
                title="Sync balance"
              >
                {blofinSyncing ? '🔄' : '↻'}
              </button>
              <button 
                className="import-btn"
                onClick={onImportHistory}
                disabled={blofinSyncing}
                title="Import trade history"
              >
                📥
              </button>
            </div>
          ) : (
            <button 
              className="connect-blofin-btn"
              onClick={onSettingsClick}
              title="Connect Blofin Exchange"
            >
              🔗 Connect Blofin
            </button>
          )}
        </div>

        {/* Balance Display */}
        <div className="balance-config">
          <span className="config-label">Balance</span>
          {isEditingBalance ? (
            <div className="value-edit">
              <span className="currency">$</span>
              <input
                type="number"
                value={tempBalance}
                onChange={(e) => setTempBalance(e.target.value)}
                onBlur={handleBalanceSubmit}
                onKeyDown={handleBalanceKeyDown}
                autoFocus
              />
            </div>
          ) : (
            <button 
              className="value-btn balance-btn" 
              onClick={() => {
                setTempBalance(balance);
                setIsEditingBalance(true);
              }}
            >
              <span className={`balance-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
                ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="balance-r">({balanceInR}R)</span>
            </button>
          )}
        </div>
        
        {/* Risk Unit Display */}
        <div className="r-config">
          <span className="config-label">Risk Unit</span>
          {isEditingR ? (
            <div className="value-edit">
              <span className="currency">$</span>
              <input
                type="number"
                value={tempRValue}
                onChange={(e) => setTempRValue(e.target.value)}
                onBlur={handleRSubmit}
                onKeyDown={handleRKeyDown}
                autoFocus
              />
            </div>
          ) : (
            <button 
              className="value-btn" 
              onClick={() => {
                setTempRValue(rValue);
                setIsEditingR(true);
              }}
            >
              <span className="r-amount">${rValue.toLocaleString()}</span>
              <span className="r-suffix">= 1R</span>
            </button>
          )}
        </div>

        {/* Settings Button */}
        <button className="settings-btn" onClick={onSettingsClick} title="Settings">
          ⚙️
        </button>
      </div>
    </header>
  );
};

export default Header;
