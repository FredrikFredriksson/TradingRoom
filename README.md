# TradingRoom

TradingRoom is a public demo for reviewing sample trades, journaling decisions, and exploring portfolio statistics in a clean trading dashboard.

## What the demo shows

- A curated sample dataset with active and closed trades
- Portfolio statistics, trade history, monthly breakdowns, and a performance tearsheet
- A Trade Studio for modeling new sample trades against live public market prices

## What the public demo does not do

- No login or account setup
- No real balances, trades, or personal data
- No public "connect your own exchange history" flow

## Local development

```bash
npm install
npm run dev
```

The public demo does not require environment variables.

Optional Supabase helpers still exist for private development. If you want to wire those up locally, use `.env.example` and keep the resulting `.env` file out of git.

## Vercel

Use the standard Vite deployment settings:

- Build command: `npm run build`
- Output directory: `dist`
- No env vars required for the public demo build

## Demo data and privacy

- The hosted app uses curated sample trades only.
- Changes you make while browsing the demo are local to that session.
- Any private exchange or database credentials must stay in local `.env` files and never be committed.

## Exchange examples

- Binance is used as a public market-data example for prices and charts.
- Blofin is included under `server/` as a sanitized backend example for authenticated exchange requests.
- These examples are not exposed as a self-serve account import feature in the public demo.
