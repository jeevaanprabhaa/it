import { useState, useEffect, useRef, useCallback } from 'react';
import { Kline, OrderBook, Trade, Ticker } from '../types';

function generateDemoKlines(symbol: string, interval: string, count = 500): Kline[] {
  const prices: Record<string, number> = {
    BTCUSDT: 43500, ETHUSDT: 2280, SOLUSDT: 98, BNBUSDT: 310,
    XRPUSDT: 0.62, ADAUSDT: 0.48, DOGEUSDT: 0.085, MATICUSDT: 0.9
  };
  const basePrice = prices[symbol] || 100;
  const intervalMs: Record<string, number> = {
    '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
    '30m': 1800000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000
  };
  const ms = intervalMs[interval] || 60000;
  const now = Date.now();
  const klines: Kline[] = [];
  let price = basePrice;
  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.495) * price * 0.002;
    price = Math.max(price + change, basePrice * 0.5);
    const open = price;
    const close = price + (Math.random() - 0.5) * price * 0.001;
    const high = Math.max(open, close) + Math.random() * price * 0.001;
    const low = Math.min(open, close) - Math.random() * price * 0.001;
    klines.push({
      time: Math.floor((now - i * ms) / 1000),
      open: parseFloat(open.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      volume: parseFloat((Math.random() * 100 + 10).toFixed(2)),
    });
  }
  return klines;
}

function generateDemoOrderBook(symbol: string): OrderBook {
  const prices: Record<string, number> = {
    BTCUSDT: 43500, ETHUSDT: 2280, SOLUSDT: 98, BNBUSDT: 310,
    XRPUSDT: 0.62, ADAUSDT: 0.48, DOGEUSDT: 0.085, MATICUSDT: 0.9
  };
  const mid = prices[symbol] || 100;
  const bids: OrderBook['bids'] = [];
  const asks: OrderBook['asks'] = [];
  for (let i = 0; i < 20; i++) {
    bids.push({ price: parseFloat((mid - (i + 1) * mid * 0.0001).toFixed(4)), quantity: parseFloat((Math.random() * 5 + 0.1).toFixed(4)) });
    asks.push({ price: parseFloat((mid + (i + 1) * mid * 0.0001).toFixed(4)), quantity: parseFloat((Math.random() * 5 + 0.1).toFixed(4)) });
  }
  return { bids, asks };
}

export function useMarketData(symbol: string, interval: string) {
  const [klines, setKlines] = useState<Kline[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startDemo = useCallback((sym: string, intv: string) => {
    setIsDemo(true);
    setKlines(generateDemoKlines(sym, intv));
    setOrderBook(generateDemoOrderBook(sym));

    const prices: Record<string, number> = {
      BTCUSDT: 43500, ETHUSDT: 2280, SOLUSDT: 98, BNBUSDT: 310,
      XRPUSDT: 0.62, ADAUSDT: 0.48, DOGEUSDT: 0.085, MATICUSDT: 0.9
    };
    const base = prices[sym] || 100;
    setTicker({
      symbol: sym,
      lastPrice: base.toString(),
      priceChangePercent: (Math.random() * 4 - 2).toFixed(2),
      volume: (Math.random() * 10000 + 1000).toFixed(2),
      quoteVolume: (Math.random() * 50000000 + 1000000).toFixed(2),
      highPrice: (base * 1.02).toFixed(4),
      lowPrice: (base * 0.98).toFixed(4),
    });

    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    demoIntervalRef.current = setInterval(() => {
      setOrderBook(generateDemoOrderBook(sym));
      setKlines(prev => {
        if (prev.length === 0) return generateDemoKlines(sym, intv);
        const last = prev[prev.length - 1];
        const change = (Math.random() - 0.495) * last.close * 0.0015;
        const newClose = parseFloat((last.close + change).toFixed(4));
        const updated = {
          ...last,
          close: newClose,
          high: Math.max(last.high, newClose),
          low: Math.min(last.low, newClose),
          volume: last.volume + parseFloat((Math.random() * 0.5).toFixed(4)),
        };
        return [...prev.slice(0, -1), updated];
      });
      setTicker(prev => {
        if (!prev) return prev;
        const lastP = parseFloat(prev.lastPrice);
        const newP = lastP + (Math.random() - 0.495) * lastP * 0.001;
        return { ...prev, lastPrice: newP.toFixed(4) };
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    if (wsRef.current) wsRef.current.close();
    setKlines([]);
    setOrderBook({ bids: [], asks: [] });
    setTrades([]);
    setTicker(null);
    setIsDemo(false);
    setConnected(false);

    const fetchData = async () => {
      try {
        const [klinesRes, depthRes, tickerRes, tradesRes] = await Promise.all([
          fetch(`/api/klines?symbol=${symbol}&interval=${interval}&limit=500`),
          fetch(`/api/depth?symbol=${symbol}&limit=20`),
          fetch(`/api/ticker/24hr?symbol=${symbol}`),
          fetch(`/api/trades?symbol=${symbol}&limit=50`),
        ]);

        if (!klinesRes.ok || klinesRes.status === 451) throw new Error('geo-blocked');

        const klinesData = await klinesRes.json();
        const depthData = await depthRes.json();
        const tickerData = await tickerRes.json();
        const tradesData = await tradesRes.json();

        const parsedKlines: Kline[] = klinesData.map((k: unknown[]) => ({
          time: Math.floor((k[0] as number) / 1000),
          open: parseFloat(k[1] as string),
          high: parseFloat(k[2] as string),
          low: parseFloat(k[3] as string),
          close: parseFloat(k[4] as string),
          volume: parseFloat(k[5] as string),
        }));
        setKlines(parsedKlines);

        const parsedBook: OrderBook = {
          bids: depthData.bids.slice(0, 20).map(([price, qty]: string[]) => ({ price: parseFloat(price), quantity: parseFloat(qty) })),
          asks: depthData.asks.slice(0, 20).map(([price, qty]: string[]) => ({ price: parseFloat(price), quantity: parseFloat(qty) })),
        };
        setOrderBook(parsedBook);
        setTicker(tickerData);
        setTrades(tradesData.slice(0, 50));
        setConnected(true);

        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`);
        wsRef.current = ws;
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'subscribe', symbol: symbol.toLowerCase(), stream: `kline_${interval}` }));
        };
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.e === 'kline') {
              const k = msg.k;
              const newKline: Kline = {
                time: Math.floor(k.t / 1000),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
              };
              setKlines(prev => {
                const last = prev[prev.length - 1];
                if (last && last.time === newKline.time) {
                  return [...prev.slice(0, -1), newKline];
                }
                return [...prev, newKline];
              });
            }
          } catch {}
        };
        ws.onerror = () => {};
      } catch {
        startDemo(symbol, interval);
      }
    };

    fetchData();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [symbol, interval, startDemo]);

  return { klines, orderBook, trades, ticker, isDemo, connected };
}
