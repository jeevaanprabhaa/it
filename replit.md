# StockSharp Web Terminal

## Overview
A full-stack web trading terminal that replicates the StockSharp desktop trading platform as a web application. Features live market data from Binance (with demo mode fallback), candlestick charts with indicators, real-time order book, and a multi-panel trading interface.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Node.js + Express + WebSocket (port 3001)
- **Charts**: lightweight-charts v4 (TradingView)
- **Market Data**: Binance public REST API + WebSocket streams (demo fallback if geo-blocked)

## Project Structure
```
client/          - React frontend
  src/
    components/  - Chart, OrderBook, SecuritiesTable, TradesPanel, OrderPanel
    hooks/       - useMarketData (REST + WS data), useWebSocket
    types/       - TypeScript type definitions
  vite.config.ts - Vite config with proxy to backend
server/          - Express backend
  index.js       - REST API proxy + WebSocket relay to Binance
run.sh           - Startup script for both services
```

## Features
- **Candlestick Chart** with SMA 20 and Bollinger Bands overlays
- **Order Book / Market Depth** with real-time bid/ask levels
- **Securities Table** showing USDT pairs
- **Multi-Panel Layout**: chart + order book + bottom panels
- **Bottom Tabs**: Securities, Buy/Sell, Orders, Trades
- **Order Management** with simulated order execution (demo mode)
- **Symbol Switcher** - BTC, ETH, SOL, BNB, XRP and more
- **Interval Selector** - 1m, 3m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
- **Demo Mode** - auto-activates with realistic synthetic data if Binance is geo-restricted

## Running the Project
```bash
bash run.sh
```
This starts:
1. Express backend on port 3001 (REST API proxy for Binance data)
2. Vite dev server on port 5000 (React frontend)

## Notes
- Binance's API returns 451 (geo-restricted) from some regions. The app auto-falls back to demo mode with realistic synthetic data.
- WebSocket relay connects to Binance streams; if blocked, the chart still works via REST initial load.
