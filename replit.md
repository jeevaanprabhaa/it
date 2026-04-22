# AlgoTrader — AI-Powered Paper Trading Platform

## Overview
A full-stack Progressive Web App (PWA) trading platform with **real CryptoCompare market data**, Stripe virtual wallet funding, AI behavioral finance coach, social leaderboard, and full mobile responsiveness. Built as a final-year project showcase.

## What Makes This Unique (FYP Differentiators)
1. **Real Market Data** — CryptoCompare API (works globally, no geo-restriction). BTC currently ~$74,500.
2. **AI Trade Coach** — Rule-based behavioral finance engine analyzes emotion patterns, calculates trader score (0-100), generates personalized insights, detects FOMO/overconfidence/revenge trading.
3. **Risk DNA Profile** — Pentagon radar chart visualizing 5 dimensions: Discipline, Emotional Control, Consistency, Risk/Reward, Aggressiveness.
4. **Stripe Virtual Wallet** — Pay real money ($1 → $1,000 virtual credits) to fund paper trading account. Session-based wallet with live P&L tracking.
5. **Social Leaderboard** — Multi-session leaderboard ranked by P&L, showing win rate and trade count.
6. **Behavioral Finance** — Psychology journal with emotion tagging; analytics show which emotional states are most/least profitable.
7. **PWA** — Installable on mobile/desktop, service worker offline support, themed to #00ff88.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000) — PWA with service worker
- **Backend**: Node.js + Express + WebSocket (port 3001)
- **Charts**: lightweight-charts v4 (TradingView)
- **Analytics**: recharts v3 (journal psychology charts)
- **Market Data**: CryptoCompare REST API (primary) + Binance fallback
- **Payments**: Stripe (STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY in Replit Secrets)

## Project Structure
```
client/
  public/
    manifest.json      - PWA manifest (AlgoTrader, theme #00ff88)
    sw.js              - Service worker (cache-first shell, network-first API)
    offline.html       - Offline fallback page
    icon-192.png       - PWA icon 192x192
    icon-512.png       - PWA icon 512x512
  src/
    components/
      Chart.tsx              - Candlestick chart (SMA20, BB, VWAP)
      OrderBook.tsx          - Real-time bid/ask depth
      SecuritiesTable.tsx    - 12 symbol ticker table
      TradesPanel.tsx        - Recent trades feed
      OrderPanel.tsx         - Buy/Sell with Market/Limit/Stop orders
      JournalModal.tsx       - Post-trade emotion journal popup
      JournalTab.tsx         - Journal timeline + psychology analytics
      HeatmapPage.tsx        - 20-asset heatmap (treemap desktop, 2-col mobile)
      WalletBar.tsx          - Session wallet bar (balance, P&L, username, fund button)
      DepositModal.tsx       - Stripe payment flow ($1→$1000 virtual credits)
      AICoachPage.tsx        - AI Trade Coach (score ring, radar DNA, insights, badges)
      LeaderboardPage.tsx    - Social leaderboard ranked by P&L
    hooks/
      useMarketData.ts   - REST + WebSocket market data
      useIsMobile.ts     - Responsive breakpoint hook (768px)
      useSession.ts      - Session ID management (localStorage)
    types/index.ts       - All TypeScript types
  generate-icons.js      - Node.js PNG icon generator (run once)
  vite.config.ts         - Vite config + Stripe PK env injection
server/
  index.js               - CryptoCompare API + Stripe + AI Coach + Orders + WS relay
run.sh                   - Startup script
```

## Key API Endpoints
- `GET  /api/klines?symbol=BTCUSDT&interval=1m` — Real OHLCV from CryptoCompare
- `GET  /api/ticker/24hr?symbol=BTCUSDT` — Real price + 24h stats
- `GET  /api/heatmap` — 20-asset heatmap with real data
- `GET  /api/wallet` — Session virtual wallet (header: x-session-id)
- `POST /api/wallet/deposit` — Create Stripe PaymentIntent ($1→$1000 virtual)
- `POST /api/wallet/deposit-confirm` — Credit wallet after payment
- `POST /api/wallet/update-pnl` — Update P&L after market order fill
- `POST /api/wallet/set-username` — Update leaderboard username
- `GET  /api/leaderboard` — Top 20 traders by P&L
- `GET  /api/coach` — AI behavioral analysis (score, insights, risk DNA, badges)
- `POST /api/journal/entry` — Log a trade journal entry
- `GET  /api/journal/analytics` — Emotion-based analytics

## Running
```bash
bash run.sh
```
Starts: Express backend (port 3001) + Vite dev server (port 5000)
- Replit workflow: `Start application` runs `bash run.sh` and waits on port 5000.
- Shared Node dependencies are installed at the project root so the imported `client/` and `server/` folders can resolve packages without restructuring the original code.

## Notes
- Stripe keys stored in Replit Secrets: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY
- If STRIPE_SECRET_KEY is absent, the backend starts normally and payment endpoints return "Payment not configured".
- CryptoCompare streaming can use CRYPTOCOMPARE_API_KEY from Replit Secrets; REST market data works without a key.
- Note: Stripe integration was set up manually using keys (not via Replit Stripe connector)
- Current UI theme is a dark professional trading terminal palette defined in `client/index.html` using `--bg-base`, `--bg-panel`, `--bg-card`, `--bg-hover`, `--accent`, `--accent-dim`, `--danger`, `--danger-dim`, `--text-primary`, `--text-muted`, `--border`, and `--border-strong`.
- CryptoCompare API is free-tier (no API key needed for basic endpoints)
- Session IDs stored in localStorage — wallet resets if localStorage is cleared
- Advanced orders and journal entries are in-memory (reset on server restart)
- PostgreSQL persistence (Replit built-in DB via `pg`): wallets, orders, journal_entries, deposits — see `server/db.js`. Schema auto-created.
- Real-time fill checker now polls every 5s against pending DB orders and broadcasts `order_filled` + `wallet_update` over WS.
- Deposit flow verifies the PaymentIntent server-side via Stripe before crediting; idempotent via `deposits.payment_intent_id` UNIQUE.
