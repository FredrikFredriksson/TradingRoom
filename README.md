# TradingRoom

A crypto trading dashboard built as a personal portfolio project. Combines real-time market data, position sizing, trade journaling, and institutional-grade performance analytics in a single interface.

**Live demo:** [tradingroom.vercel.app](https://tradingroom.vercel.app) *(public demo — no login required)*

---

## Features

### Trade Studio
- **Position calculator** — set your entry, stop loss, and take profit to instantly compute position size, risk/reward ratio, and potential P&L based on a fixed risk unit (R-value)
- **Live prices via Binance WebSocket** — real-time price feed with one-click fill to entry field; no API key required
- **Pair search** — searchable dropdown of all USDT pairs from Binance, prioritised by volume
- **Leverage & risk sliders** — discrete leverage levels (1×–100×) and risk multiplier (0.5R–3R)

### Active Trades
- Open position list with live unrealized P&L updating in real time
- Close trades with a custom exit price and optional comment
- Delete trades with automatic balance reconciliation

### Dashboard / Trading Journal
- **Trade history** — filterable by month, date range, or all time; sortable by date, symbol, or P&L
- **Statistics** — win rate, average winner/loser, profit factor, total R gained
- **Calendar heatmap** — monthly overview of trading activity
- **Performance tearsheet** — institutional-grade metrics calculated from closed trade history:
  - Cumulative and annualised return
  - Annualised volatility, Sharpe ratio, Sortino ratio
  - Max drawdown
  - Monthly returns heatmap (year × month grid with colour coding)
  - Equity curve and drawdown chart over time
  - Return distribution histogram

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite |
| Charts | Recharts, D3 |
| Market data | Binance REST API + WebSocket streams |
| Date handling | date-fns |
| Icons | Lucide React |
| Backend (optional) | Supabase |
| Deployment | Vercel |

---

## Getting Started

```bash
git clone https://github.com/fredr/TradingRoom.git
cd TradingRoom
npm install
npm run dev
```

The demo runs entirely in-browser with pre-seeded trade data. No account or API key is needed.

### Environment variables (optional)

To connect persistent storage via Supabase, create a `.env` file based on `.env.example`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The app works without these — all state falls back to in-memory demo data.

### Vercel deployment

- Build command: `npm run build`
- Output directory: `dist`
- No env vars required for the public demo build

---

## Project Structure

```
src/
├── components/
│   ├── PositionSizer.jsx         # Trade entry form + position calculator
│   ├── ActiveTrades.jsx          # Open positions with live P&L
│   ├── TradingJournal.jsx        # Trade history, stats, calendar view
│   ├── PerformanceTearsheet.jsx  # Quant metrics, charts, heatmap
│   ├── PriceChart.jsx            # Candlestick chart (Binance klines)
│   ├── TradePositionChart.jsx    # Entry/SL/TP visualisation
│   ├── StatCharts.jsx            # Shared line + histogram chart components
│   └── Header.jsx                # Account summary bar
├── hooks/
│   ├── useLivePrice.js           # Binance WebSocket price hook
│   └── useUnrealizedPnL.js       # Aggregated open P&L
├── lib/
│   ├── binance.js                # Binance REST + WebSocket service layer
│   └── supabase.js               # Supabase client (optional)
└── data/
    └── demoData.js               # Pre-seeded trades for the public demo
```

---

## Design Notes

- All position sizing follows the **R-value framework** — risk per trade is a fixed dollar amount (1R), and position size is calculated from that regardless of entry price or leverage
- Performance metrics (Sharpe, Sortino, max drawdown) are computed per-trade rather than on daily NAV, which suits discretionary trading frequency
- The demo is fully client-side — no auth, no server state. Supabase integration exists as an opt-in layer for persistent journaling
- Changes made in the demo are local to the browser session and not persisted
