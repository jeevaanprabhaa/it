export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface Trade {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

export interface Ticker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

export type OrderType = 'market' | 'limit' | 'stop';

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: OrderType;
  price: number;
  triggerPrice?: number;
  quantity: number;
  status: 'OPEN' | 'PENDING' | 'FILLED' | 'CANCELLED';
  time: number;
  fillPrice?: number;
  pnl?: number;
}

export type Emotion = 'confident' | 'fearful' | 'fomo' | 'neutral' | 'greedy';
export type MarketCondition = 'trending' | 'ranging' | 'volatile';

export interface JournalEntry {
  id: string;
  trade_id: string;
  reason: string;
  emotion: Emotion;
  market_condition: MarketCondition;
  notes: string;
  trade: Order | null;
  created_at: number;
}

export interface Analytics {
  win_rate_by_emotion: Record<string, number | null>;
  avg_pnl_by_emotion: Record<string, number | null>;
  most_profitable_reason_keywords: { word: string; avg_pnl: number; count: number }[];
}

export const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'MATICUSDT'];
export const INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
export const EMOTIONS: Emotion[] = ['confident', 'fearful', 'fomo', 'neutral', 'greedy'];
export const MARKET_CONDITIONS: MarketCondition[] = ['trending', 'ranging', 'volatile'];
