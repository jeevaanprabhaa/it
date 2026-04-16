const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const https = require('https');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3001;
const CC_STREAM_API_KEY = process.env.CRYPTOCOMPARE_API_KEY || '';

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const allowedOriginPatterns = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.*\.replit\.dev$/,
  /^https:\/\/.*\.replit\.app$/,
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOriginPatterns.some(pattern => pattern.test(origin))) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

// ─── CryptoCompare (real market data, works from Replit) ─────────────────────
const CC_BASE = 'https://min-api.cryptocompare.com';

function ccGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`${CC_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    }).on('error', reject);
  });
}

// Also keep Binance as a fallback for order book / trades
const BINANCE_REST = 'https://api.binance.com';
function binanceGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`${BINANCE_REST}${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    }).on('error', reject);
  });
}

// CC symbol map: BTCUSDT → BTC / USD
function ccPair(symbol) {
  const base = symbol.replace('USDT', '').replace('BUSD', '');
  return { fsym: base, tsym: 'USD' };
}

// CC interval map → histominute/histohour/histoday
function ccInterval(interval) {
  const map = {
    '1m': { endpoint: 'histominute', aggregate: 1, limit: 500 },
    '3m': { endpoint: 'histominute', aggregate: 3, limit: 500 },
    '5m': { endpoint: 'histominute', aggregate: 5, limit: 500 },
    '15m': { endpoint: 'histominute', aggregate: 15, limit: 480 },
    '30m': { endpoint: 'histominute', aggregate: 30, limit: 480 },
    '1h': { endpoint: 'histohour', aggregate: 1, limit: 500 },
    '4h': { endpoint: 'histohour', aggregate: 4, limit: 500 },
    '1d': { endpoint: 'histoday', aggregate: 1, limit: 365 },
    '1w': { endpoint: 'histoday', aggregate: 7, limit: 365 },
  };
  return map[interval] || map['1m'];
}

// Demo price cache for order processing
const demoPriceCache = {
  BTCUSDT: 74500, ETHUSDT: 2580, BNBUSDT: 580, SOLUSDT: 148, XRPUSDT: 2.1,
  DOGEUSDT: 0.16, ADAUSDT: 0.45, MATICUSDT: 0.55, AVAXUSDT: 35, DOTUSDT: 6.8,
  LINKUSDT: 14.5, LTCUSDT: 85, ATOMUSDT: 8.5, UNIUSDT: 7.2, ETCUSDT: 26,
  XLMUSDT: 0.11, ALGOUSDT: 0.18, NEARUSDT: 2.8, FTMUSDT: 0.55, SANDUSDT: 0.40,
};

async function getCurrentPrice(symbol) {
  try {
    const { fsym, tsym } = ccPair(symbol);
    const r = await ccGet(`/data/price?fsym=${fsym}&tsyms=${tsym}`);
    if (r.status === 200 && r.data[tsym]) {
      const p = r.data[tsym];
      demoPriceCache[symbol] = p;
      return p;
    }
  } catch {}
  const base = demoPriceCache[symbol] || 100;
  const moved = base * (1 + (Math.random() - 0.498) * 0.003);
  demoPriceCache[symbol] = moved;
  return moved;
}

// ─── Klines / OHLCV ──────────────────────────────────────────────────────────
app.get('/api/klines', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1m', limit = 500 } = req.query;
  const { fsym, tsym } = ccPair(symbol);
  const { endpoint, aggregate, limit: defLimit } = ccInterval(interval);
  const n = Math.min(parseInt(limit) || defLimit, defLimit);

  try {
    const r = await ccGet(`/data/v2/${endpoint}?fsym=${fsym}&tsym=${tsym}&aggregate=${aggregate}&limit=${n}`);
    if (r.status === 200 && r.data?.Response === 'Success') {
      const candles = r.data.Data.Data.map(c => ([
        c.time * 1000,         // open time ms
        String(c.open),
        String(c.high),
        String(c.low),
        String(c.close),
        String(c.volumefrom),  // base volume
        (c.time + aggregate * 60) * 1000, // close time
        String(c.volumeto),    // quote volume
        0, '0', '0', 0,
      ]));
      return res.json(candles);
    }
  } catch {}

  // Demo fallback
  res.json(generateDemoKlines(symbol, interval, parseInt(limit) || 300));
});

function generateDemoKlines(symbol, interval, count = 300) {
  const base = demoPriceCache[symbol] || 100;
  const intervalMs = {
    '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
    '30m': 1800000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000,
  }[interval] || 60000;
  const now = Date.now();
  const candles = [];
  let price = base;
  for (let i = count; i >= 0; i--) {
    const t = now - i * intervalMs;
    const change = price * (Math.random() - 0.498) * 0.008;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const vol = base * (50 + Math.random() * 150);
    candles.push([t, String(open), String(high), String(low), String(close), String(vol), t + intervalMs, String(vol * 0.6), 0, '0', '0', 0]);
    price = close;
  }
  return candles;
}

// ─── Ticker 24hr ─────────────────────────────────────────────────────────────
app.get('/api/ticker/24hr', async (req, res) => {
  const { symbol } = req.query;
  if (symbol) {
    const { fsym, tsym } = ccPair(symbol);
    try {
      const r = await ccGet(`/data/pricemultifull?fsyms=${fsym}&tsyms=${tsym}`);
      if (r.status === 200 && r.data?.RAW?.[fsym]?.[tsym]) {
        const d = r.data.RAW[fsym][tsym];
        return res.json({
          symbol,
          lastPrice: String(d.PRICE),
          priceChangePercent: String(d.CHANGEPCT24HOUR?.toFixed(2) || '0'),
          volume: String(d.VOLUME24HOUR?.toFixed(2) || '0'),
          quoteVolume: String(d.VOLUME24HOURTO?.toFixed(2) || '0'),
          highPrice: String(d.HIGH24HOUR || d.PRICE),
          lowPrice: String(d.LOW24HOUR || d.PRICE),
        });
      }
    } catch {}
    // fallback
    const p = demoPriceCache[symbol] || 100;
    return res.json({ symbol, lastPrice: String(p), priceChangePercent: '0', volume: '0', quoteVolume: '0', highPrice: String(p * 1.02), lowPrice: String(p * 0.98) });
  }

  // All tickers for securities table
  const SYMS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','MATICUSDT','AVAXUSDT','DOTUSDT','LINKUSDT','LTCUSDT'];
  try {
    const fSyms = SYMS.map(s => ccPair(s).fsym).join(',');
    const r = await ccGet(`/data/pricemultifull?fsyms=${fSyms}&tsyms=USD`);
    if (r.status === 200 && r.data?.RAW) {
      const out = SYMS.map(sym => {
        const { fsym } = ccPair(sym);
        const d = r.data.RAW[fsym]?.USD;
        if (!d) return null;
        demoPriceCache[sym] = d.PRICE;
        return {
          symbol: sym,
          lastPrice: String(d.PRICE),
          priceChangePercent: String(d.CHANGEPCT24HOUR?.toFixed(2) || '0'),
          volume: String(d.VOLUME24HOUR?.toFixed(2) || '0'),
          quoteVolume: String(d.VOLUME24HOURTO?.toFixed(2) || '0'),
          highPrice: String(d.HIGH24HOUR || d.PRICE),
          lowPrice: String(d.LOW24HOUR || d.PRICE),
        };
      }).filter(Boolean);
      return res.json(out);
    }
  } catch {}
  return res.json(SYMS.map(sym => ({
    symbol: sym, lastPrice: String(demoPriceCache[sym] || 100),
    priceChangePercent: String(((Math.random() - 0.48) * 6).toFixed(2)),
    volume: '0', quoteVolume: '0',
    highPrice: String((demoPriceCache[sym] || 100) * 1.02),
    lowPrice: String((demoPriceCache[sym] || 100) * 0.98),
  })));
});

// ─── Order Book (Binance if accessible, else demo) ────────────────────────────
app.get('/api/depth', async (req, res) => {
  const { symbol = 'BTCUSDT', limit = 20 } = req.query;
  try {
    const r = await binanceGet(`/api/v3/depth?symbol=${symbol}&limit=${limit}`);
    if (r.status === 200) return res.json(r.data);
  } catch {}
  const p = demoPriceCache[symbol] || 100;
  const bids = Array.from({ length: 20 }, (_, i) => [String((p * (1 - (i + 1) * 0.0002)).toFixed(6)), String((Math.random() * 5 + 0.1).toFixed(4))]);
  const asks = Array.from({ length: 20 }, (_, i) => [String((p * (1 + (i + 1) * 0.0002)).toFixed(6)), String((Math.random() * 5 + 0.1).toFixed(4))]);
  res.json({ bids, asks });
});

// ─── Recent Trades ────────────────────────────────────────────────────────────
app.get('/api/trades', async (req, res) => {
  const { symbol = 'BTCUSDT', limit = 50 } = req.query;
  try {
    const r = await binanceGet(`/api/v3/trades?symbol=${symbol}&limit=${limit}`);
    if (r.status === 200) return res.json(r.data);
  } catch {}
  const p = demoPriceCache[symbol] || 100;
  const trades = Array.from({ length: parseInt(limit) }, (_, i) => ({
    id: Date.now() - i, price: String((p * (1 + (Math.random() - 0.5) * 0.002)).toFixed(6)),
    qty: String((Math.random() * 2 + 0.01).toFixed(4)),
    time: Date.now() - i * 1000,
    isBuyerMaker: Math.random() > 0.5,
  }));
  res.json(trades);
});

// ─── Heatmap ──────────────────────────────────────────────────────────────────
const HEATMAP_SYMBOLS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','DOTUSDT','MATICUSDT','LINKUSDT','UNIUSDT','LTCUSDT','ATOMUSDT','ETCUSDT','XLMUSDT','ALGOUSDT','NEARUSDT','FTMUSDT','SANDUSDT'];
const HEATMAP_DISPLAY = { BTCUSDT:'BTC',ETHUSDT:'ETH',BNBUSDT:'BNB',SOLUSDT:'SOL',XRPUSDT:'XRP',DOGEUSDT:'DOGE',ADAUSDT:'ADA',AVAXUSDT:'AVAX',DOTUSDT:'DOT',MATICUSDT:'MATIC',LINKUSDT:'LINK',UNIUSDT:'UNI',LTCUSDT:'LTC',ATOMUSDT:'ATOM',ETCUSDT:'ETC',XLMUSDT:'XLM',ALGOUSDT:'ALGO',NEARUSDT:'NEAR',FTMUSDT:'FTM',SANDUSDT:'SAND' };
const HEATMAP_BASE_VOLS = { BTCUSDT:28e9,ETHUSDT:14e9,BNBUSDT:3.2e9,SOLUSDT:5.1e9,XRPUSDT:4.8e9,DOGEUSDT:2.1e9,ADAUSDT:1.4e9,AVAXUSDT:1.8e9,DOTUSDT:0.9e9,MATICUSDT:1.1e9,LINKUSDT:0.8e9,UNIUSDT:0.4e9,LTCUSDT:0.7e9,ATOMUSDT:0.5e9,ETCUSDT:0.6e9,XLMUSDT:0.35e9,ALGOUSDT:0.28e9,NEARUSDT:0.45e9,FTMUSDT:0.32e9,SANDUSDT:0.3e9 };

app.get('/api/heatmap', async (req, res) => {
  try {
    const fSyms = HEATMAP_SYMBOLS.map(s => ccPair(s).fsym).join(',');
    const r = await ccGet(`/data/pricemultifull?fsyms=${fSyms}&tsyms=USD`);
    if (r.status === 200 && r.data?.RAW) {
      const data = HEATMAP_SYMBOLS.map(sym => {
        const { fsym } = ccPair(sym);
        const d = r.data.RAW[fsym]?.USD;
        if (!d) return null;
        return {
          symbol: sym, name: HEATMAP_DISPLAY[sym] || sym.replace('USDT',''),
          price: d.PRICE, change_pct: parseFloat((d.CHANGEPCT24HOUR || 0).toFixed(2)),
          volume_24h: d.VOLUME24HOURTO || HEATMAP_BASE_VOLS[sym] || 1e8,
        };
      }).filter(Boolean);
      return res.json({ data, updated_at: Date.now(), demo: false });
    }
  } catch {}
  const data = HEATMAP_SYMBOLS.map(sym => ({
    symbol: sym, name: HEATMAP_DISPLAY[sym] || sym.replace('USDT',''),
    price: demoPriceCache[sym] || 1,
    change_pct: parseFloat(((Math.random() - 0.48) * 12).toFixed(2)),
    volume_24h: HEATMAP_BASE_VOLS[sym] * (0.85 + Math.random() * 0.3),
  }));
  res.json({ data, updated_at: Date.now(), demo: true });
});

// ─── VWAP history endpoint ────────────────────────────────────────────────────
function computeVWAP(klines) {
  let cumTPV = 0, cumVol = 0, day = null;
  return klines.map(k => {
    const dt = new Date(k.time * 1000);
    const d = `${dt.getUTCFullYear()}-${dt.getUTCMonth()}-${dt.getUTCDate()}`;
    if (d !== day) { cumTPV = 0; cumVol = 0; day = d; }
    const tp = (k.high + k.low + k.close) / 3;
    cumTPV += tp * k.volume; cumVol += k.volume;
    return cumVol > 0 ? parseFloat((cumTPV / cumVol).toFixed(6)) : null;
  });
}

app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1m', limit = 500 } = req.query;
  const { fsym, tsym } = ccPair(symbol);
  const { endpoint, aggregate } = ccInterval(interval);
  try {
    const r = await ccGet(`/data/v2/${endpoint}?fsym=${fsym}&tsym=${tsym}&aggregate=${aggregate}&limit=${limit}`);
    if (r.status === 200 && r.data?.Response === 'Success') {
      const raw = r.data.Data.Data;
      const klines = raw.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volumefrom }));
      const vwap = computeVWAP(klines);
      return res.json(klines.map((k, i) => ({ ...k, vwap: vwap[i] })));
    }
  } catch {}
  res.status(503).json({ error: 'Service unavailable' });
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ═══════════════════════════════════════════════════════════════════════════════
// VIRTUAL WALLET + STRIPE
// ═══════════════════════════════════════════════════════════════════════════════

// In-memory users (keyed by sessionId)
const virtualWallets = {};

function getWallet(sessionId) {
  if (!virtualWallets[sessionId]) {
    virtualWallets[sessionId] = {
      sessionId,
      balance: 10000,       // start with $10,000 virtual
      deposited: 0,
      pnlTotal: 0,
      tradesCount: 0,
      winsCount: 0,
      username: `Trader_${sessionId.slice(0, 6)}`,
      createdAt: Date.now(),
    };
  }
  return virtualWallets[sessionId];
}

app.get('/api/wallet', (req, res) => {
  const sid = req.headers['x-session-id'] || 'default';
  res.json(getWallet(sid));
});

app.post('/api/wallet/update-pnl', (req, res) => {
  const sid = req.headers['x-session-id'] || 'default';
  const { pnl } = req.body;
  const w = getWallet(sid);
  w.pnlTotal = parseFloat((w.pnlTotal + pnl).toFixed(2));
  w.balance = parseFloat((w.balance + pnl).toFixed(2));
  w.tradesCount++;
  if (pnl > 0) w.winsCount++;
  res.json(w);
});

app.post('/api/wallet/set-username', (req, res) => {
  const sid = req.headers['x-session-id'] || 'default';
  const { username } = req.body;
  if (!username || username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 2-20 characters' });
  }
  const w = getWallet(sid);
  w.username = username.trim();
  res.json(w);
});

// ─── Stripe Payment Intent: deposit virtual credits ───────────────────────────
// $1 real → $1,000 virtual credits
app.post('/api/wallet/deposit', async (req, res) => {
  const sid = req.headers['x-session-id'] || 'default';
  const { amount } = req.body; // real USD in cents, e.g. 100 = $1

  if (!amount || amount < 100 || amount > 100000) {
    return res.status(400).json({ error: 'Amount must be between $1 and $1,000' });
  }
  if (!stripe) {
    return res.status(503).json({ error: 'Payment not configured' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,            // cents
      currency: 'usd',
      metadata: { sessionId: sid, virtualCredits: amount * 1000 },  // $1 → $1000 virtual
      description: `AlgoTrader virtual credits: $${(amount / 100).toFixed(2)} real → $${(amount * 10).toLocaleString()} virtual`,
    });
    res.json({ clientSecret: paymentIntent.client_secret, virtualCredits: amount * 10 });
  } catch (e) {
    console.error('Stripe error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Called after payment confirmed client-side
app.post('/api/wallet/deposit-confirm', (req, res) => {
  const sid = req.headers['x-session-id'] || 'default';
  const { virtualCredits, paymentIntentId } = req.body;
  const w = getWallet(sid);
  w.balance = parseFloat((w.balance + virtualCredits).toFixed(2));
  w.deposited = parseFloat((w.deposited + virtualCredits).toFixed(2));
  console.log(`Deposit confirmed: session=${sid} +$${virtualCredits} virtual (pi=${paymentIntentId})`);
  res.json({ success: true, wallet: w });
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────
app.get('/api/leaderboard', (req, res) => {
  const entries = Object.values(virtualWallets)
    .filter(w => w.tradesCount > 0)
    .map(w => ({
      username: w.username,
      pnlTotal: w.pnlTotal,
      tradesCount: w.tradesCount,
      winRate: w.tradesCount > 0 ? parseFloat(((w.winsCount / w.tradesCount) * 100).toFixed(1)) : 0,
      balance: w.balance,
    }))
    .sort((a, b) => b.pnlTotal - a.pnlTotal)
    .slice(0, 20);
  res.json(entries);
});

// ─── AI Trade Coach ────────────────────────────────────────────────────────────
// Rule-based behavioral analysis (no external AI API needed — impressive for FYP)
function analyzeTrader(journalEntries, orders) {
  const filled = orders.filter(o => o.status === 'FILLED' && typeof o.pnl === 'number');
  if (filled.length === 0) return { score: 50, insights: [], riskDna: null, badges: [] };

  const wins = filled.filter(o => o.pnl > 0).length;
  const losses = filled.filter(o => o.pnl < 0).length;
  const winRate = wins / filled.length;
  const avgWin = wins > 0 ? filled.filter(o => o.pnl > 0).reduce((s, o) => s + o.pnl, 0) / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(filled.filter(o => o.pnl < 0).reduce((s, o) => s + o.pnl, 0) / losses) : 0;
  const rr = avgLoss > 0 ? avgWin / avgLoss : 0;
  const totalPnl = filled.reduce((s, o) => s + o.pnl, 0);

  // Emotion analysis
  const emotionCounts = {};
  const emotionPnl = {};
  journalEntries.forEach(e => {
    if (!e.emotion || !e.trade || typeof e.trade.pnl !== 'number') return;
    emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
    emotionPnl[e.emotion] = (emotionPnl[e.emotion] || 0) + e.trade.pnl;
  });

  const insights = [];
  const badges = [];
  let score = 50;

  // Win rate insight
  if (winRate >= 0.6) { score += 15; badges.push({ id: 'sharp', label: '🎯 Sharp Shooter', desc: 'Win rate above 60%' }); }
  else if (winRate < 0.4) { score -= 10; insights.push({ type: 'warning', text: `Your win rate is ${(winRate*100).toFixed(0)}%. Focus on entry timing — only trade your highest-conviction setups.` }); }

  // Risk/reward
  if (rr >= 2) { score += 15; badges.push({ id: 'rr', label: '⚖️ Risk Master', desc: 'Average R:R above 2:1' }); insights.push({ type: 'success', text: `Excellent R:R ratio of ${rr.toFixed(1)}:1. Your winners are much bigger than your losers.` }); }
  else if (rr < 1 && losses > 0) { score -= 15; insights.push({ type: 'danger', text: `Your R:R is ${rr.toFixed(1)}:1 — you lose more per loss than you gain per win. Try setting a 1.5:1 minimum before entering trades.` }); }

  // FOMO detection
  if (emotionCounts['fomo'] > 2) {
    const fomoPnl = emotionPnl['fomo'] || 0;
    score -= 10;
    insights.push({ type: 'warning', text: `You've made ${emotionCounts['fomo']} FOMO trades. Total FOMO P&L: ${fomoPnl >= 0 ? '+' : ''}$${fomoPnl.toFixed(2)}. FOMO trades are often suboptimal — add a 15-min cooling-off rule.` });
  }

  // Overconfidence
  if (emotionCounts['greedy'] > 2 && (emotionPnl['greedy'] || 0) < 0) {
    score -= 10;
    insights.push({ type: 'warning', text: `Greedy trades are losing you money ($${(emotionPnl['greedy'] || 0).toFixed(2)} total). Greed often leads to over-sizing or late entries.` });
  }

  // Fearful but profitable
  if (emotionCounts['fearful'] > 0 && (emotionPnl['fearful'] || 0) > 0) {
    insights.push({ type: 'success', text: `Interesting: your fearful trades are actually profitable! Fear may be keeping you disciplined — trust your analysis.` });
  }

  // Confident trading
  if (emotionCounts['confident'] > 0) {
    const confPnl = emotionPnl['confident'] || 0;
    if (confPnl > 0) {
      score += 10;
      insights.push({ type: 'success', text: `Confident trades are working well for you (+$${confPnl.toFixed(2)}). Your conviction trades are your best.` });
    }
  }

  // Loss streak detection
  const last5 = filled.slice(-5);
  if (last5.length === 5 && last5.every(o => o.pnl < 0)) {
    score -= 15;
    insights.push({ type: 'danger', text: `⚠️ You're on a 5-trade losing streak. Consider stepping away for a few hours. Revenge trading will only make it worse.` });
    badges.push({ id: 'drawdown', label: '🔥 Battle-Hardened', desc: 'Survived a 5-loss streak' });
  }

  // Consistency
  if (filled.length >= 10) { badges.push({ id: 'active', label: '📊 Active Trader', desc: '10+ trades completed' }); }
  if (filled.length >= 25) { score += 5; badges.push({ id: 'veteran', label: '🏆 Veteran', desc: '25+ trades completed' }); }
  if (totalPnl > 0 && filled.length >= 5) { badges.push({ id: 'profitable', label: '💚 Profitable Trader', desc: 'Net positive P&L' }); }

  // Size: clamp
  score = Math.max(0, Math.min(100, score));

  // Risk DNA profile
  const riskDna = {
    aggressiveness: Math.min(100, Math.round(filled.filter(o => o.quantity > 0.1).length / filled.length * 100 + (1 - winRate) * 30)),
    discipline: Math.min(100, Math.round(winRate * 60 + Math.min(rr, 3) * 13)),
    emotionalControl: Math.min(100, Math.round(100 - (emotionCounts['fomo'] || 0) * 8 - (emotionCounts['greedy'] || 0) * 5)),
    consistency: Math.min(100, Math.round(winRate * 50 + (filled.length >= 10 ? 30 : filled.length * 3))),
    riskReward: Math.min(100, Math.round(Math.min(rr / 3, 1) * 100)),
  };

  return { score, insights, riskDna, badges, stats: { winRate, avgWin, avgLoss, rr, totalPnl, wins, losses, trades: filled.length } };
}

// ─── Journal ──────────────────────────────────────────────────────────────────
const journalEntries = [];

app.post('/api/journal/entry', (req, res) => {
  const { trade_id, reason, emotion, market_condition, notes, trade } = req.body;
  if (!trade_id || !emotion) return res.status(400).json({ error: 'trade_id and emotion required' });
  const entry = { id: Date.now().toString(), trade_id, reason: reason || '', emotion, market_condition: market_condition || 'ranging', notes: notes || '', trade: trade || null, created_at: Date.now() };
  journalEntries.unshift(entry);
  res.status(201).json(entry);
});

app.get('/api/journal', (req, res) => res.json(journalEntries));

app.get('/api/journal/analytics', (req, res) => {
  const emotions = ['confident', 'fearful', 'fomo', 'neutral', 'greedy'];
  const win_rate_by_emotion = {};
  const avg_pnl_by_emotion = {};
  emotions.forEach(em => {
    const group = journalEntries.filter(e => e.emotion === em && e.trade && typeof e.trade.pnl === 'number');
    if (!group.length) { win_rate_by_emotion[em] = null; avg_pnl_by_emotion[em] = null; return; }
    win_rate_by_emotion[em] = parseFloat((group.filter(e => e.trade.pnl > 0).length / group.length).toFixed(2));
    avg_pnl_by_emotion[em] = parseFloat((group.reduce((s, e) => s + e.trade.pnl, 0) / group.length).toFixed(2));
  });
  const wordMap = {};
  journalEntries.forEach(e => {
    if (!e.reason || !e.trade || typeof e.trade.pnl !== 'number') return;
    (e.reason.toLowerCase().match(/\b[a-z]{4,}\b/g) || []).forEach(w => {
      if (!wordMap[w]) wordMap[w] = { count: 0, totalPnl: 0 };
      wordMap[w].count++; wordMap[w].totalPnl += e.trade.pnl;
    });
  });
  const most_profitable_reason_keywords = Object.entries(wordMap)
    .sort((a, b) => b[1].totalPnl - a[1].totalPnl).slice(0, 5)
    .map(([word, v]) => ({ word, avg_pnl: parseFloat((v.totalPnl / v.count).toFixed(2)), count: v.count }));
  res.json({ win_rate_by_emotion, avg_pnl_by_emotion, most_profitable_reason_keywords });
});

// ─── AI Coach endpoint ─────────────────────────────────────────────────────────
app.get('/api/coach', (req, res) => {
  const sid = req.headers['x-session-id'] || 'default';
  const myOrders = advancedOrders.filter(o => o.sessionId === sid || !o.sessionId);
  const analysis = analyzeTrader(journalEntries, myOrders);
  res.json(analysis);
});

// ─── Advanced Orders ──────────────────────────────────────────────────────────
const advancedOrders = [];

app.post('/api/orders', (req, res) => {
  const sid = req.headers['x-session-id'] || 'default';
  const { id, symbol, side, orderType, price, triggerPrice, quantity, time } = req.body;
  if (!id || !symbol || !side || !orderType || !quantity) return res.status(400).json({ error: 'Missing required fields' });
  const order = { id, symbol, side, orderType, price: price || 0, triggerPrice: triggerPrice || price || 0, quantity, status: 'PENDING', time: time || Date.now(), fillPrice: null, pnl: null, filledAt: null, sessionId: sid };
  advancedOrders.push(order);
  res.status(201).json(order);
});

app.get('/api/orders', (req, res) => res.json(advancedOrders));

app.delete('/api/orders/:id', (req, res) => {
  const order = advancedOrders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'PENDING') order.status = 'CANCELLED';
  res.json(order);
});

// ─── WebSocket + Binance Stream Relay ─────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });
const frontendClients = new Set();

function broadcastToFrontend(msg) {
  const data = JSON.stringify(msg);
  frontendClients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(data); });
}

// Crypto Compare WebSocket for real-time prices
let ccWs = null;
const ccSubscriptions = new Set();
const ccPrices = {};

function connectCCStream() {
  try {
    const streamUrl = CC_STREAM_API_KEY
      ? `wss://streamer.cryptocompare.com/v2?api_key=${encodeURIComponent(CC_STREAM_API_KEY)}`
      : 'wss://streamer.cryptocompare.com/v2';
    ccWs = new WebSocket(streamUrl);
    ccWs.on('open', () => {
      if (ccSubscriptions.size > 0) {
        ccWs.send(JSON.stringify({ action: 'SubAdd', subs: Array.from(ccSubscriptions) }));
      }
    });
    ccWs.on('message', (msg) => {
      try {
        const d = JSON.parse(msg.toString());
        if (d.TYPE === '2' && d.PRICE) {
          const sym = d.FROMSYMBOL + 'USDT';
          ccPrices[sym] = d.PRICE;
          broadcastToFrontend({ type: 'price_update', symbol: sym, price: d.PRICE, change: d.CHANGE24HOUR, changePct: d.CHANGEPCT24HOUR });
        }
      } catch {}
    });
    ccWs.on('close', () => setTimeout(connectCCStream, 5000));
    ccWs.on('error', () => {});
  } catch {}
}
connectCCStream();

wss.on('connection', (ws) => {
  frontendClients.add(ws);
  let binanceWs = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'subscribe') {
        const { symbol = 'btcusdt', stream = 'kline_1m' } = data;

        // Try Binance WS first
        const streamName = `${symbol.toLowerCase()}@${stream}`;
        if (binanceWs) binanceWs.terminate();
        try {
          binanceWs = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
          binanceWs.on('message', (m) => { if (ws.readyState === WebSocket.OPEN) ws.send(m.toString()); });
          binanceWs.on('error', () => {
            // Binance failed — subscribe CC
            const fsym = symbol.toUpperCase().replace('USDT', '');
            const sub = `2~Coinbase~${fsym}~USD`;
            ccSubscriptions.add(sub);
            if (ccWs?.readyState === WebSocket.OPEN) {
              ccWs.send(JSON.stringify({ action: 'SubAdd', subs: [sub] }));
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'info', message: 'Using CryptoCompare stream' }));
            }
          });
          binanceWs.on('close', () => {});
        } catch {}
      }
    } catch {}
  });

  ws.on('close', () => {
    frontendClients.delete(ws);
    if (binanceWs) binanceWs.terminate();
  });
});

// ─── Order fill checker ────────────────────────────────────────────────────────
setInterval(async () => {
  const pending = advancedOrders.filter(o => o.status === 'PENDING');
  if (!pending.length) return;
  const symbols = [...new Set(pending.map(o => o.symbol))];
  const prices = {};
  for (const sym of symbols) prices[sym] = await getCurrentPrice(sym);

  for (const order of pending) {
    const currentPrice = prices[order.symbol];
    if (!currentPrice) continue;
    let triggered = false;
    if (order.orderType === 'limit') {
      if (order.side === 'BUY' && currentPrice <= order.triggerPrice) triggered = true;
      if (order.side === 'SELL' && currentPrice >= order.triggerPrice) triggered = true;
    } else if (order.orderType === 'stop') {
      if (currentPrice <= order.triggerPrice) triggered = true;
    }
    if (triggered) {
      const slippage = currentPrice * (Math.random() * 0.001 - 0.0005);
      const fillPrice = parseFloat((currentPrice + slippage).toFixed(8));
      const pnl = parseFloat(((fillPrice - order.price) * order.quantity * (order.side === 'BUY' ? 1 : -1)).toFixed(2));
      order.status = 'FILLED'; order.fillPrice = fillPrice; order.pnl = pnl; order.filledAt = Date.now();

      // Update wallet
      if (order.sessionId && virtualWallets[order.sessionId]) {
        const w = virtualWallets[order.sessionId];
        w.pnlTotal = parseFloat((w.pnlTotal + pnl).toFixed(2));
        w.balance = parseFloat((w.balance + pnl).toFixed(2));
        w.tradesCount++;
        if (pnl > 0) w.winsCount++;
      }

      broadcastToFrontend({ type: 'order_filled', order });
      console.log(`Order ${order.id} filled @ ${fillPrice} (PnL: ${pnl})`);
    }
  }
}, 30000);

server.listen(PORT, '0.0.0.0', () => console.log(`AlgoTrader backend on port ${PORT}`));
