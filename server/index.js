const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const BINANCE_REST = 'https://api.binance.com';

function binanceGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`${BINANCE_REST}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

const demoPriceCache = {
  BTCUSDT: 43500, ETHUSDT: 2280, BNBUSDT: 310, SOLUSDT: 98, XRPUSDT: 0.62,
  DOGEUSDT: 0.085, ADAUSDT: 0.48, AVAXUSDT: 35, DOTUSDT: 7.2, MATICUSDT: 0.9,
};

async function getCurrentPrice(symbol) {
  try {
    const result = await binanceGet(`/api/v3/ticker/price?symbol=${symbol}`);
    if (result.status === 200) {
      const p = parseFloat(result.data.price);
      demoPriceCache[symbol] = p;
      return p;
    }
  } catch {}
  const base = demoPriceCache[symbol] || 100;
  const moved = base * (1 + (Math.random() - 0.498) * 0.003);
  demoPriceCache[symbol] = moved;
  return moved;
}

app.get('/api/klines', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1m', limit = 500 } = req.query;
  try {
    const result = await binanceGet(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (result.status === 200) {
      res.json(result.data);
    } else {
      res.status(result.status).json({ error: 'Binance API error', details: result.data });
    }
  } catch (e) {
    res.status(503).json({ error: 'Service unavailable', message: e.message });
  }
});

function computeVWAP(rawKlines) {
  const result = [];
  let cumTPV = 0;
  let cumVol = 0;
  let currentDay = null;
  for (const k of rawKlines) {
    const openTime = k[0];
    const date = new Date(openTime);
    const day = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    if (day !== currentDay) { cumTPV = 0; cumVol = 0; currentDay = day; }
    const high = parseFloat(k[2]);
    const low = parseFloat(k[3]);
    const close = parseFloat(k[4]);
    const volume = parseFloat(k[5]);
    const tp = (high + low + close) / 3;
    cumTPV += tp * volume;
    cumVol += volume;
    result.push(cumVol > 0 ? parseFloat((cumTPV / cumVol).toFixed(8)) : null);
  }
  return result;
}

app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { interval = '1m', limit = 500 } = req.query;
  try {
    const result = await binanceGet(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (result.status !== 200) {
      return res.status(result.status).json({ error: 'Binance API error' });
    }
    const raw = result.data;
    const vwap = computeVWAP(raw);
    const klines = raw.map((k, i) => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      vwap: vwap[i],
    }));
    res.json(klines);
  } catch (e) {
    res.status(503).json({ error: 'Service unavailable', message: e.message });
  }
});

app.get('/api/depth', async (req, res) => {
  const { symbol = 'BTCUSDT', limit = 20 } = req.query;
  try {
    const result = await binanceGet(`/api/v3/depth?symbol=${symbol}&limit=${limit}`);
    if (result.status === 200) {
      res.json(result.data);
    } else {
      res.status(result.status).json({ error: 'Binance API error', details: result.data });
    }
  } catch (e) {
    res.status(503).json({ error: 'Service unavailable', message: e.message });
  }
});

app.get('/api/ticker/24hr', async (req, res) => {
  const { symbol } = req.query;
  const path = symbol ? `/api/v3/ticker/24hr?symbol=${symbol}` : '/api/v3/ticker/24hr';
  try {
    const result = await binanceGet(path);
    if (result.status === 200) {
      res.json(result.data);
    } else {
      res.status(result.status).json({ error: 'Binance API error', details: result.data });
    }
  } catch (e) {
    res.status(503).json({ error: 'Service unavailable', message: e.message });
  }
});

app.get('/api/trades', async (req, res) => {
  const { symbol = 'BTCUSDT', limit = 50 } = req.query;
  try {
    const result = await binanceGet(`/api/v3/trades?symbol=${symbol}&limit=${limit}`);
    if (result.status === 200) {
      res.json(result.data);
    } else {
      res.status(result.status).json({ error: 'Binance API error', details: result.data });
    }
  } catch (e) {
    res.status(503).json({ error: 'Service unavailable', message: e.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const HEATMAP_SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT',
  'AVAXUSDT','DOTUSDT','MATICUSDT','LINKUSDT','UNIUSDT','LTCUSDT','ATOMUSDT',
  'ETCUSDT','XLMUSDT','ALGOUSDT','NEARUSDT','FTMUSDT','SANDUSDT',
];

const HEATMAP_DISPLAY = {
  BTCUSDT:'BTC', ETHUSDT:'ETH', BNBUSDT:'BNB', SOLUSDT:'SOL', XRPUSDT:'XRP',
  DOGEUSDT:'DOGE', ADAUSDT:'ADA', AVAXUSDT:'AVAX', DOTUSDT:'DOT', MATICUSDT:'MATIC',
  LINKUSDT:'LINK', UNIUSDT:'UNI', LTCUSDT:'LTC', ATOMUSDT:'ATOM', ETCUSDT:'ETC',
  XLMUSDT:'XLM', ALGOUSDT:'ALGO', NEARUSDT:'NEAR', FTMUSDT:'FTM', SANDUSDT:'SAND',
};

function generateHeatmapDemo() {
  const basePrices = {
    BTCUSDT: 43500, ETHUSDT: 2280, BNBUSDT: 310, SOLUSDT: 98, XRPUSDT: 0.62,
    DOGEUSDT: 0.085, ADAUSDT: 0.48, AVAXUSDT: 35, DOTUSDT: 7.2, MATICUSDT: 0.9,
    LINKUSDT: 14.5, UNIUSDT: 7.8, LTCUSDT: 72, ATOMUSDT: 9.5, ETCUSDT: 26,
    XLMUSDT: 0.12, ALGOUSDT: 0.18, NEARUSDT: 2.8, FTMUSDT: 0.55, SANDUSDT: 0.45,
  };
  const baseVolumes = {
    BTCUSDT: 28e9, ETHUSDT: 14e9, BNBUSDT: 3.2e9, SOLUSDT: 5.1e9, XRPUSDT: 4.8e9,
    DOGEUSDT: 2.1e9, ADAUSDT: 1.4e9, AVAXUSDT: 1.8e9, DOTUSDT: 0.9e9, MATICUSDT: 1.1e9,
    LINKUSDT: 0.8e9, UNIUSDT: 0.4e9, LTCUSDT: 0.7e9, ATOMUSDT: 0.5e9, ETCUSDT: 0.6e9,
    XLMUSDT: 0.35e9, ALGOUSDT: 0.28e9, NEARUSDT: 0.45e9, FTMUSDT: 0.32e9, SANDUSDT: 0.3e9,
  };
  return HEATMAP_SYMBOLS.map(sym => {
    const base = basePrices[sym] || 1;
    const change = parseFloat(((Math.random() - 0.48) * 12).toFixed(2));
    const price = parseFloat((base * (1 + change / 100)).toFixed(base < 1 ? 5 : 2));
    const volume = parseFloat(((baseVolumes[sym] || 1e8) * (0.85 + Math.random() * 0.3)).toFixed(0));
    return { symbol: sym, name: HEATMAP_DISPLAY[sym] || sym.replace('USDT',''), price, change_pct: change, volume_24h: volume };
  });
}

app.get('/api/heatmap', async (req, res) => {
  try {
    const result = await binanceGet('/api/v3/ticker/24hr');
    if (result.status !== 200) throw new Error('Binance unavailable');
    const all = result.data;
    const data = HEATMAP_SYMBOLS.map(sym => {
      const t = all.find(x => x.symbol === sym);
      if (!t) return null;
      return {
        symbol: sym,
        name: HEATMAP_DISPLAY[sym] || sym.replace('USDT',''),
        price: parseFloat(t.lastPrice),
        change_pct: parseFloat(t.priceChangePercent),
        volume_24h: parseFloat(t.quoteVolume),
      };
    }).filter(Boolean);
    res.json({ data, updated_at: Date.now(), demo: false });
  } catch {
    res.json({ data: generateHeatmapDemo(), updated_at: Date.now(), demo: true });
  }
});

const journalEntries = [];

app.post('/api/journal/entry', (req, res) => {
  const { trade_id, reason, emotion, market_condition, notes, trade } = req.body;
  if (!trade_id || !emotion) {
    return res.status(400).json({ error: 'trade_id and emotion are required' });
  }
  const entry = {
    id: Date.now().toString(),
    trade_id,
    reason: reason || '',
    emotion,
    market_condition: market_condition || 'ranging',
    notes: notes || '',
    trade: trade || null,
    created_at: Date.now(),
  };
  journalEntries.unshift(entry);
  res.status(201).json(entry);
});

app.get('/api/journal', (req, res) => {
  res.json(journalEntries);
});

app.get('/api/journal/analytics', (req, res) => {
  const emotions = ['confident', 'fearful', 'fomo', 'neutral', 'greedy'];
  const win_rate_by_emotion = {};
  const avg_pnl_by_emotion = {};

  emotions.forEach(em => {
    const group = journalEntries.filter(e => e.emotion === em && e.trade && typeof e.trade.pnl === 'number');
    if (!group.length) { win_rate_by_emotion[em] = null; avg_pnl_by_emotion[em] = null; return; }
    const wins = group.filter(e => e.trade.pnl > 0).length;
    win_rate_by_emotion[em] = parseFloat((wins / group.length).toFixed(2));
    avg_pnl_by_emotion[em] = parseFloat((group.reduce((s, e) => s + e.trade.pnl, 0) / group.length).toFixed(2));
  });

  const wordMap = {};
  journalEntries.forEach(e => {
    if (!e.reason || !e.trade || typeof e.trade.pnl !== 'number') return;
    const words = e.reason.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    words.forEach(w => {
      if (!wordMap[w]) wordMap[w] = { count: 0, totalPnl: 0 };
      wordMap[w].count++;
      wordMap[w].totalPnl += e.trade.pnl;
    });
  });
  const most_profitable_reason_keywords = Object.entries(wordMap)
    .filter(([, v]) => v.count >= 1)
    .sort((a, b) => b[1].totalPnl - a[1].totalPnl)
    .slice(0, 5)
    .map(([word, v]) => ({ word, avg_pnl: parseFloat((v.totalPnl / v.count).toFixed(2)), count: v.count }));

  res.json({ win_rate_by_emotion, avg_pnl_by_emotion, most_profitable_reason_keywords });
});

const advancedOrders = [];

app.post('/api/orders', (req, res) => {
  const { id, symbol, side, orderType, price, triggerPrice, quantity, time } = req.body;
  if (!id || !symbol || !side || !orderType || !quantity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const order = {
    id, symbol, side, orderType,
    price: price || 0,
    triggerPrice: triggerPrice || price || 0,
    quantity,
    status: 'PENDING',
    time: time || Date.now(),
    fillPrice: null,
    pnl: null,
    filledAt: null,
  };
  advancedOrders.push(order);
  res.status(201).json(order);
});

app.get('/api/orders', (req, res) => {
  res.json(advancedOrders);
});

app.delete('/api/orders/:id', (req, res) => {
  const order = advancedOrders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.status === 'PENDING') order.status = 'CANCELLED';
  res.json(order);
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const frontendClients = new Set();

function broadcastToFrontend(msg) {
  const data = JSON.stringify(msg);
  frontendClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  frontendClients.add(ws);
  let binanceWs = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'subscribe') {
        const { symbol = 'btcusdt', stream = 'kline_1m' } = data;
        const streamName = `${symbol.toLowerCase()}@${stream}`;
        if (binanceWs) binanceWs.terminate();
        try {
          binanceWs = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);
          binanceWs.on('message', (binanceMsg) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(binanceMsg.toString());
          });
          binanceWs.on('error', () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', message: 'Binance stream unavailable' }));
            }
          });
          binanceWs.on('close', () => {});
        } catch (e) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'Cannot connect to Binance stream' }));
          }
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    frontendClients.delete(ws);
    if (binanceWs) binanceWs.terminate();
  });
});

setInterval(async () => {
  const pending = advancedOrders.filter(o => o.status === 'PENDING');
  if (!pending.length) return;

  const symbols = [...new Set(pending.map(o => o.symbol))];
  const prices = {};
  for (const sym of symbols) {
    prices[sym] = await getCurrentPrice(sym);
  }

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
      const pnl = parseFloat(
        ((fillPrice - order.price) * order.quantity * (order.side === 'BUY' ? 1 : -1)).toFixed(2)
      );
      order.status = 'FILLED';
      order.fillPrice = fillPrice;
      order.pnl = pnl;
      order.filledAt = Date.now();

      broadcastToFrontend({ type: 'order_filled', order });
      console.log(`Order ${order.id} filled at ${fillPrice} (PnL: ${pnl})`);
    }
  }
}, 30000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`StockSharp backend running on port ${PORT}`);
});
