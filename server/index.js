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
