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

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const clientStreams = new Map();

wss.on('connection', (ws) => {
  let binanceWs = null;

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'subscribe') {
        const { symbol = 'btcusdt', stream = 'kline_1m' } = data;
        const streamName = `${symbol.toLowerCase()}@${stream}`;

        if (binanceWs) {
          binanceWs.terminate();
        }

        try {
          binanceWs = new WebSocket(`wss://stream.binance.com:9443/ws/${streamName}`);

          binanceWs.on('message', (binanceMsg) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(binanceMsg.toString());
            }
          });

          binanceWs.on('error', () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', message: 'Binance stream unavailable' }));
            }
          });

          binanceWs.on('close', () => {
          });
        } catch (e) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'Cannot connect to Binance stream' }));
          }
        }
      }
    } catch (e) {
    }
  });

  ws.on('close', () => {
    if (binanceWs) {
      binanceWs.terminate();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`StockSharp backend running on port ${PORT}`);
});
