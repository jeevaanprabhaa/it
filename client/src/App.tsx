import React, { useState, useCallback, useRef, useEffect } from 'react';
import Chart from './components/Chart';
import OrderBook from './components/OrderBook';
import SecuritiesTable from './components/SecuritiesTable';
import TradesPanel from './components/TradesPanel';
import OrderPanel from './components/OrderPanel';
import JournalModal from './components/JournalModal';
import JournalTab from './components/JournalTab';
import HeatmapPage from './components/HeatmapPage';
import WalletBar from './components/WalletBar';
import DepositModal from './components/DepositModal';
import AICoachPage from './components/AICoachPage';
import LeaderboardPage from './components/LeaderboardPage';
import OrderBookVisualizer from './components/OrderBookVisualizer';
import { useMarketData } from './hooks/useMarketData';
import { useIsMobile } from './hooks/useIsMobile';
import { useSession, apiHeaders } from './hooks/useSession';
import { SYMBOLS, INTERVALS, Order, Emotion, MarketCondition } from './types';

type Page = 'terminal' | 'heatmap' | 'coach' | 'leaderboard';
type MobileTab = 'charts' | 'scanner' | 'portfolio' | 'journal';

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: 'charts',    icon: '📈', label: 'Charts' },
  { id: 'scanner',   icon: '🔍', label: 'Scanner' },
  { id: 'portfolio', icon: '💼', label: 'Portfolio' },
  { id: 'journal',   icon: '📓', label: 'Journal' },
];

const PK = import.meta.env.VITE_STRIPE_PK || '';

const App: React.FC = () => {
  const isMobile = useIsMobile();
  const sessionId = useSession();
  const [page, setPage] = useState<Page>('terminal');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1m');
  const [bottomTab, setBottomTab] = useState<'securities' | 'orders' | 'trades' | 'journal' | 'history'>('orders');
  const [rightTab, setRightTab] = useState<'orderbook' | 'trades'>('orderbook');
  const [mobileTab, setMobileTab] = useState<MobileTab>('charts');
  const [showMobileBuySell, setShowMobileBuySell] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [journalOrder, setJournalOrder] = useState<Order | null>(null);
  const [journalKey, setJournalKey] = useState(0);

  const { klines, orderBook, trades, ticker, isDemo } = useMarketData(symbol, interval);
  const tickerRef = useRef<string | undefined>(undefined);
  tickerRef.current = ticker?.lastPrice;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Hydrate orders from server on mount so history persists across reloads
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/orders', { headers: apiHeaders(sessionId) });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) setOrders(data);
        }
      } catch {}
    })();
  }, [sessionId]);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'wallet_update') {
            setWalletRefresh(n => n + 1);
          }
          if (msg.type === 'order_filled' && msg.order) {
            const filled: Order = { ...msg.order, status: 'FILLED' };
            setOrders(prev => {
              const exists = prev.find(o => o.id === filled.id);
              return exists ? prev.map(o => o.id === filled.id ? filled : o) : [filled, ...prev];
            });
            setJournalOrder(filled);
            setJournalKey(k => k + 1);
            setWalletRefresh(n => n + 1);
            if ('Notification' in window && Notification.permission === 'granted') {
              const pnlStr = filled.pnl !== undefined ? ` | PnL: ${filled.pnl >= 0 ? '+' : ''}$${filled.pnl.toFixed(2)}` : '';
              new Notification(`Order Filled — ${filled.symbol}`, {
                body: `${filled.orderType?.toUpperCase()} ${filled.side} ${filled.quantity} @ ${filled.fillPrice?.toLocaleString()}${pnlStr}`,
                icon: '/icon-192.png',
              });
            }
          }
        } catch {}
      };
      ws.onclose = () => { retryTimeout = setTimeout(connect, 5000); };
    };
    connect();
    return () => { clearTimeout(retryTimeout); ws?.close(); };
  }, []);

  const handlePlaceOrder = useCallback(async (order: Order) => {
    setOrders(prev => [order, ...prev]);
    if (order.orderType === 'market') {
      const delay = 1200 + Math.random() * 800;
      setTimeout(async () => {
        const currentPrice = tickerRef.current ? parseFloat(tickerRef.current) : order.price;
        const slippage = currentPrice * (Math.random() * 0.002 - 0.001);
        const fillPrice = parseFloat((currentPrice + slippage).toFixed(6));
        const pnl = parseFloat(((fillPrice - order.price) * order.quantity * (order.side === 'BUY' ? 1 : -1)).toFixed(2));
        const filledOrder: Order = { ...order, status: 'FILLED', fillPrice, pnl };
        setOrders(prev => prev.map(o => o.id === order.id ? filledOrder : o));
        setJournalOrder(filledOrder);
        setJournalKey(k => k + 1);
        try {
          await fetch('/api/orders', {
            method: 'POST',
            headers: apiHeaders(sessionId),
            body: JSON.stringify({ ...filledOrder, status: 'FILLED' }),
          });
          await fetch('/api/wallet/update-pnl', {
            method: 'POST',
            headers: apiHeaders(sessionId),
            body: JSON.stringify({ pnl }),
          });
          setWalletRefresh(n => n + 1);
        } catch {}
      }, delay);
    }
    if (isMobile) setShowMobileBuySell(false);
  }, [isMobile, sessionId]);

  const handleCancelOrder = useCallback(async (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' as const } : o));
    try { await fetch(`/api/orders/${id}`, { method: 'DELETE' }); } catch {}
  }, []);

  const handleJournalSave = useCallback(async (entry: { reason: string; emotion: Emotion; market_condition: MarketCondition; notes: string }) => {
    if (!journalOrder) return;
    try {
      await fetch('/api/journal/entry', {
        method: 'POST',
        headers: apiHeaders(sessionId),
        body: JSON.stringify({ trade_id: journalOrder.id, ...entry, trade: journalOrder }),
      });
    } catch {}
    setJournalOrder(null);
  }, [journalOrder, sessionId]);

  const handleJournalSkip = useCallback(() => setJournalOrder(null), []);

  const change = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const stripePk = (window as any).__STRIPE_PK__ || PK;

  // ── Page routing ────────────────────────────────────────────────────────────
  if (page === 'heatmap') {
    return (
      <>
        {showDeposit && <DepositModal sessionId={sessionId} publishableKey={stripePk} onClose={() => setShowDeposit(false)} onSuccess={() => { setShowDeposit(false); setWalletRefresh(n => n + 1); }} />}
        <HeatmapPage onSelectSymbol={sym => { setSymbol(sym); setPage('terminal'); }} onNavigateHome={() => setPage('terminal')} />
      </>
    );
  }
  if (page === 'coach') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} activeSection="dashboard" onNavigateTrade={() => setPage('terminal')} onNavigateDashboard={() => setPage('leaderboard')} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <AICoachPage sessionId={sessionId} onBack={() => setPage('terminal')} />
        </div>
        {showDeposit && <DepositModal sessionId={sessionId} publishableKey={stripePk} onClose={() => setShowDeposit(false)} onSuccess={() => { setShowDeposit(false); setWalletRefresh(n => n + 1); }} />}
      </div>
    );
  }
  if (page === 'leaderboard') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} activeSection="dashboard" onNavigateTrade={() => setPage('terminal')} onNavigateDashboard={() => setPage('leaderboard')} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <LeaderboardPage sessionId={sessionId} onBack={() => setPage('terminal')} />
        </div>
        {showDeposit && <DepositModal sessionId={sessionId} publishableKey={stripePk} onClose={() => setShowDeposit(false)} onSuccess={() => { setShowDeposit(false); setWalletRefresh(n => n + 1); }} />}
      </div>
    );
  }

  // ── Mobile Layout ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', color: 'var(--text-primary)', position: 'relative' }}>
        <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} activeSection="trade" onNavigateTrade={() => setPage('terminal')} onNavigateDashboard={() => setPage('leaderboard')} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', gap: 8, flexShrink: 0 }}>
          {isDemo && <span style={{ padding: '1px 6px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 10, fontSize: 10, color: 'var(--accent)' }}>DEMO</span>}
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', fontSize: 12, flex: 1 }}>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setPage('heatmap')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', padding: '3px 8px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>🗺</button>
          {ticker && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: change >= 0 ? 'var(--accent)' : 'var(--danger)', lineHeight: 1 }}>
                {parseFloat(ticker.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 10, color: change >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {mobileTab === 'charts' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 2, padding: '4px 8px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                {INTERVALS.map(iv => (
                  <button key={iv} onClick={() => setInterval(iv)} style={{ padding: '3px 7px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', flexShrink: 0, background: interval === iv ? 'var(--accent)' : 'var(--bg-card)', color: interval === iv ? 'var(--bg-base)' : 'var(--text-muted)' }}>{iv}</button>
                ))}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}><Chart klines={klines} symbol={symbol} /></div>
            </div>
          )}
          {mobileTab === 'scanner' && (
            <div style={{ height: '100%', overflow: 'auto' }}>
              <SecuritiesTable selectedSymbol={symbol} onSelectSymbol={sym => { setSymbol(sym); setMobileTab('charts'); }} />
            </div>
          )}
          {mobileTab === 'portfolio' && (
            <div style={{ height: '100%', overflow: 'auto', padding: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button onClick={() => setPage('coach')} style={{ flex: 1, padding: '10px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🤖 AI Coach</button>
                <button onClick={() => setPage('leaderboard')} style={{ flex: 1, padding: '10px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🏆 Leaderboard</button>
              </div>
              <MobileOrdersTable orders={orders} onCancel={handleCancelOrder} />
            </div>
          )}
          {mobileTab === 'journal' && (
            <div style={{ height: '100%', overflow: 'auto' }}><JournalTab key={journalKey} /></div>
          )}
        </div>

        {mobileTab === 'charts' && (
          <button
            onClick={() => setShowMobileBuySell(v => !v)}
            style={{ position: 'absolute', right: 16, bottom: 72, width: 52, height: 52, borderRadius: '50%', background: showMobileBuySell ? 'var(--danger)' : 'linear-gradient(135deg, var(--accent), var(--accent))', color: 'var(--bg-base)', border: '1px solid var(--border)', fontSize: 22, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 20px var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          >
            {showMobileBuySell ? '✕' : '⇅'}
          </button>
        )}

        {showMobileBuySell && mobileTab === 'charts' && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, background: 'var(--bg-base)', borderTop: '1px solid var(--border)', zIndex: 90, maxHeight: '70vh', overflowY: 'auto' }}>
            <OrderPanel symbol={symbol} lastPrice={ticker?.lastPrice} orders={orders} onPlaceOrder={handlePlaceOrder} onCancelOrder={handleCancelOrder} />
          </div>
        )}

        <nav style={{ display: 'flex', background: 'var(--bg-base)', borderTop: '1px solid var(--border)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {MOBILE_TABS.map(tab => (
            <button key={tab.id} onClick={() => { setMobileTab(tab.id); setShowMobileBuySell(false); }} style={{ flex: 1, padding: '8px 4px 6px', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderTop: mobileTab === tab.id ? '2px solid var(--accent)' : '2px solid var(--border)' }}>
              <span style={{ fontSize: 18 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, color: mobileTab === tab.id ? 'var(--accent)' : 'var(--text-muted)', fontWeight: mobileTab === tab.id ? 700 : 400 }}>{tab.label}</span>
            </button>
          ))}
        </nav>

        {showDeposit && <DepositModal sessionId={sessionId} publishableKey={stripePk} onClose={() => setShowDeposit(false)} onSuccess={() => { setShowDeposit(false); setWalletRefresh(n => n + 1); }} />}
        {journalOrder && <JournalModal key={`modal-${journalOrder.id}`} order={journalOrder} onSave={handleJournalSave} onSkip={handleJournalSkip} />}
      </div>
    );
  }

  // ── Desktop Layout ───────────────────────────────────────────────────────────
  const desktopBottomTabs = ['orders', 'history', 'securities', 'journal'] as const;
  const chartIntervals = ['5y', '1y', '6m', '3m', '1m', '5d', '1d'];
  const tabLabel = (t: typeof desktopBottomTabs[number]) => {
    if (t === 'journal') return 'Journal';
    if (t === 'history') return 'History';
    if (t === 'securities') return 'Markets';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const formatMarketValue = (value?: string, maximumFractionDigits = 2) =>
    value ? parseFloat(value).toLocaleString(undefined, { maximumFractionDigits }) : '—';
  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : symbol.slice(-3);
  const tokenColor = (s: string) => {
    if (s === 'BTC' || s === 'WBTC') return '#F7931A';
    if (s === 'ETH') return '#627EEA';
    if (s === 'USDT' || s === 'USDC') return '#26A17B';
    if (s === 'SOL') return '#9945FF';
    if (s === 'BNB') return '#F3BA2F';
    return '#16C784';
  };
  const networkOf = (s: string) => {
    if (s === 'BTC') return 'Bitcoin';
    if (s === 'ETH') return 'Ethereum';
    if (s === 'USDT' || s === 'USDC') return 'Holesky';
    if (s === 'SOL') return 'Solana';
    if (s === 'BNB') return 'BSC';
    return 'Network';
  };

  const PairChip: React.FC<{ asset: string }> = ({ asset }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{
        width: 32, height: 32, borderRadius: '50%',
        background: tokenColor(asset),
        color: '#fff', fontSize: 13, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{asset.slice(0, 1)}</span>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>{asset}</span>
        <span style={{ fontSize: 10, color: '#6B7494' }}>on {networkOf(asset)}</span>
      </div>
    </div>
  );

  const marketStats = [
    { label: '24h Change', value: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, color: change >= 0 ? '#16C784' : '#F0616D' },
    { label: '24h High',   value: formatMarketValue(ticker?.highPrice), color: '#EAEEF7' },
    { label: '24h Low',    value: formatMarketValue(ticker?.lowPrice),  color: '#EAEEF7' },
    { label: '24h Volume', value: ticker ? '$' + (parseFloat(ticker.quoteVolume || ticker.volume) >= 1e6 ? (parseFloat(ticker.quoteVolume || ticker.volume) / 1e6).toFixed(2) + 'M' : (parseFloat(ticker.quoteVolume || ticker.volume) / 1e3).toFixed(2) + 'K') : '—', color: '#EAEEF7' },
  ];

  // Drawing tools sidebar icons
  const drawTools = ['+', '✦', '⌖', '⊟', '✎', '◇', 'T', '⛌', '✂', '🔍', '⚲'];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#070A12', color: '#EAEEF7' }}>
      <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} activeSection="trade" onNavigateTrade={() => setPage('terminal')} onNavigateDashboard={() => setPage('leaderboard')} />

      {/* Pair selector strip */}
      <div style={{ display: 'flex', alignItems: 'center', background: '#0A0F1C', borderBottom: '1px solid #131A2B', flexShrink: 0, minHeight: 64, padding: '0 16px', gap: 18, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <PairChip asset={baseAsset} />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#6B7494', flexShrink: 0 }}><path d="M7 7h10l-3 -3 M17 17H7l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <PairChip asset={quoteAsset} />
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            style={{
              background: '#131A2B', color: '#EAEEF7', border: '1px solid #1A2238',
              borderRadius: 8, padding: '6px 8px', fontSize: 11, marginLeft: 4, cursor: 'pointer',
            }}
          >
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ width: 1, height: 32, background: '#131A2B', flexShrink: 0 }} />

        {/* Market price + sparkline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#6B7494' }}><path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: 10, color: '#6B7494', fontWeight: 600, letterSpacing: '0.04em' }}>Market Price</span>
            <span style={{ fontSize: 17, color: '#EAEEF7', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatMarketValue(ticker?.lastPrice)}</span>
          </div>
          <svg width="78" height="34" viewBox="0 0 78 34" preserveAspectRatio="none">
            <path d="M0,22 L10,18 L20,24 L28,14 L38,16 L48,8 L58,12 L66,6 L78,10" fill="none" stroke={change >= 0 ? '#16C784' : '#F0616D'} strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>

        {marketStats.map(stat => (
          <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, gap: 4, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: '#6B7494', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>{stat.label}</span>
            <span style={{ color: stat.color, fontSize: 13, fontWeight: 700 }}>{stat.value}</span>
          </div>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isDemo && <span style={{ padding: '2px 8px', background: 'rgba(22,199,132,0.14)', border: '1px solid #16C784', borderRadius: 12, fontSize: 10, color: '#16C784', fontWeight: 700 }}>DEMO</span>}
          <button onClick={() => setRightTab('orderbook')} style={{ background: rightTab === 'orderbook' ? 'transparent' : 'transparent', border: 0, borderBottom: rightTab === 'orderbook' ? '2px solid #FFFFFF' : '2px solid transparent', color: rightTab === 'orderbook' ? '#FFFFFF' : '#6B7494', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Order Book</button>
          <button onClick={() => setRightTab('trades')} style={{ background: 'transparent', border: 0, borderBottom: rightTab === 'trades' ? '2px solid #FFFFFF' : '2px solid transparent', color: rightTab === 'trades' ? '#FFFFFF' : '#6B7494', padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Trades</button>
        </div>
      </div>

      {/* Main 3-column area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left: Order panel + portfolio */}
        <div style={{ width: 304, flexShrink: 0, borderRight: '1px solid #131A2B' }}>
          <OrderPanel
            symbol={symbol}
            lastPrice={ticker?.lastPrice}
            orders={orders}
            onPlaceOrder={handlePlaceOrder}
            onCancelOrder={handleCancelOrder}
            sessionId={sessionId}
            walletRefresh={walletRefresh}
            onDeposit={() => setShowDeposit(true)}
          />
        </div>

        {/* Center: Chart + bottom orders */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', background: '#070A12' }}>
            {/* Drawing tools sidebar */}
            <div style={{ width: 36, borderRight: '1px solid #131A2B', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 0', flexShrink: 0, background: '#0A0F1C' }}>
              {drawTools.map((t, i) => (
                <button key={i} style={{
                  width: 28, height: 28, background: 'transparent',
                  border: 0, borderRadius: 6, color: '#6B7494', cursor: 'pointer',
                  fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{t}</button>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Chart toolbar */}
              <div style={{ height: 40, background: '#0A0F1C', borderBottom: '1px solid #131A2B', display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px', flexShrink: 0, fontSize: 11, color: '#6B7494' }}>
                <span style={{ color: '#EAEEF7', fontWeight: 700, fontSize: 12 }}>{baseAsset}/{quoteAsset}</span>
                <span>1</span>
                <span style={{ color: '#16C784' }}>● ZEX</span>
                <span style={{ marginLeft: 12, fontSize: 11 }}>
                  <span style={{ color: '#6B7494' }}>O </span><span style={{ color: '#EAEEF7' }}>{formatMarketValue(ticker?.lastPrice)}</span>
                  <span style={{ color: '#6B7494', marginLeft: 8 }}>H </span><span style={{ color: '#EAEEF7' }}>{formatMarketValue(ticker?.highPrice)}</span>
                  <span style={{ color: '#6B7494', marginLeft: 8 }}>L </span><span style={{ color: '#EAEEF7' }}>{formatMarketValue(ticker?.lowPrice)}</span>
                  <span style={{ color: '#6B7494', marginLeft: 8 }}>C </span><span style={{ color: '#EAEEF7' }}>{formatMarketValue(ticker?.lastPrice)}</span>
                  <span style={{ color: change >= 0 ? '#16C784' : '#F0616D', marginLeft: 8 }}>({change >= 0 ? '+' : ''}{change.toFixed(2)}%)</span>
                </span>
                <span style={{ marginLeft: 'auto', color: '#6B7494' }}>⚙ ◳ ⛶</span>
              </div>

              <div style={{ flex: 1, minHeight: 0, background: '#070A12', position: 'relative' }}>
                <Chart klines={klines} symbol={symbol} />
                {/* Time-frame chips overlaid bottom */}
                <div style={{ position: 'absolute', left: 12, bottom: 8, display: 'flex', gap: 6, alignItems: 'center', zIndex: 10 }}>
                  {chartIntervals.map(iv => {
                    // Map ZEX-style interval to our intervals
                    const map: Record<string, string> = { '5y': '1d', '1y': '1d', '6m': '1d', '3m': '4h', '1m': '1h', '5d': '15m', '1d': '5m' };
                    const apiIv = map[iv] || '5m';
                    const active = interval === apiIv;
                    return (
                      <button
                        key={iv}
                        onClick={() => setInterval(apiIv)}
                        style={{
                          height: 22, padding: '0 10px',
                          border: 0, borderRadius: 999, cursor: 'pointer',
                          background: active ? '#1A2238' : 'transparent',
                          color: active ? '#FFFFFF' : '#6B7494',
                          fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        }}
                      >{iv}</button>
                    );
                  })}
                </div>
                <div style={{ position: 'absolute', right: 12, bottom: 8, display: 'flex', gap: 8, color: '#6B7494', fontSize: 10, zIndex: 10 }}>
                  <span>%</span><span>LOG</span><span>AUTO</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Orders / History */}
          <div style={{ height: 250, borderTop: '1px solid #131A2B', background: '#0A0F1C', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #131A2B', flexShrink: 0, padding: '0 4px' }}>
              {desktopBottomTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab as any)}
                  style={{
                    padding: '11px 20px',
                    border: 0,
                    background: 'transparent',
                    color: bottomTab === (tab as any) ? '#FFFFFF' : '#6B7494',
                    borderBottom: bottomTab === (tab as any) ? '2px solid #FFFFFF' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tabLabel(tab)}
                  {tab === 'orders' && pendingCount > 0 && (
                    <span style={{ marginLeft: 6, padding: '1px 6px', background: '#16C784', borderRadius: 8, fontSize: 10, color: '#070A12', fontWeight: 700 }}>{pendingCount}</span>
                  )}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', padding: '0 10px' }}>
                <button onClick={() => setPage('coach')} style={{ background: 'transparent', border: '1px solid #1A2238', borderRadius: 8, color: '#16C784', padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>AI Coach</button>
                <button onClick={() => setPage('leaderboard')} style={{ background: 'transparent', border: '1px solid #1A2238', borderRadius: 8, color: '#16C784', padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Leaderboard</button>
                <button onClick={() => setPage('heatmap')} style={{ background: 'transparent', border: '1px solid #1A2238', borderRadius: 8, color: '#8C95B5', padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Heatmap</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {bottomTab === 'orders' && <DesktopOrdersTable orders={orders.filter(o => o.status === 'OPEN' || o.status === 'PENDING')} onCancel={handleCancelOrder} />}
              {(bottomTab as string) === 'history' && <DesktopOrdersTable orders={orders.filter(o => o.status === 'FILLED' || o.status === 'CANCELLED')} onCancel={handleCancelOrder} />}
              {bottomTab === 'securities' && <SecuritiesTable selectedSymbol={symbol} onSelectSymbol={setSymbol} />}
              {bottomTab === 'trades' && <TradesPanel trades={trades} />}
              {bottomTab === 'journal' && <JournalTab key={journalKey} />}
            </div>
          </div>
        </div>

        {/* Right: Order Book + Visualizer */}
        <div style={{ width: 280, borderLeft: '1px solid #131A2B', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: '1 1 60%', minHeight: 0, overflow: 'hidden', borderBottom: '1px solid #131A2B' }}>
            {rightTab === 'orderbook'
              ? <OrderBook orderBook={orderBook} lastPrice={ticker?.lastPrice} baseAsset={baseAsset} quoteAsset={quoteAsset} />
              : <TradesPanel trades={trades} />
            }
          </div>
          <div style={{ flex: '0 0 40%', minHeight: 0, overflow: 'hidden' }}>
            <OrderBookVisualizer orderBook={orderBook} />
          </div>
        </div>
      </div>

      {showDeposit && <DepositModal sessionId={sessionId} publishableKey={stripePk} onClose={() => setShowDeposit(false)} onSuccess={() => { setShowDeposit(false); setWalletRefresh(n => n + 1); }} />}
      {journalOrder && <JournalModal key={`modal-${journalOrder.id}`} order={journalOrder} onSave={handleJournalSave} onSkip={handleJournalSkip} />}
    </div>
  );
};

// ── Shared sub-components ────────────────────────────────────────────────────
const MobileOrdersTable: React.FC<{ orders: Order[]; onCancel: (id: string) => void }> = ({ orders, onCancel }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
    <thead>
      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
        {['Symbol', 'Type', 'Side', 'Fill', 'PnL', 'Status'].map(h => <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Fill' || h === 'PnL' || h === 'Status' ? 'right' : 'left' }}>{h}</th>)}
      </tr>
    </thead>
    <tbody>
      {orders.map(o => (
        <tr key={o.id} style={{ borderBottom: '1px solid var(--bg-panel)' }}>
          <td style={{ padding: '4px 6px' }}>{o.symbol}</td>
          <td style={{ padding: '4px 6px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{o.orderType}</td>
          <td style={{ padding: '4px 6px', color: o.side === 'BUY' ? 'var(--accent)' : 'var(--danger)' }}>{o.side}</td>
          <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>{o.fillPrice ? o.fillPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
          <td style={{ padding: '4px 6px', textAlign: 'right', color: o.pnl !== undefined ? (o.pnl >= 0 ? 'var(--accent)' : 'var(--danger)') : 'var(--text-muted)' }}>
            {o.pnl !== undefined ? `${o.pnl >= 0 ? '+' : ''}$${o.pnl.toFixed(2)}` : '—'}
          </td>
          <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 10, color: o.status === 'FILLED' ? 'var(--accent)' : o.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--accent)' }}>
            {o.status}
            {(o.status === 'OPEN' || o.status === 'PENDING') && (
              <button onClick={() => onCancel(o.id)} style={{ marginLeft: 4, padding: '0 4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 9 }}>✕</button>
            )}
          </td>
        </tr>
      ))}
      {orders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No orders yet</td></tr>}
    </tbody>
  </table>
);

const DesktopOrdersTable: React.FC<{ orders: Order[]; onCancel: (id: string) => void }> = ({ orders, onCancel }) => (
  <div style={{ padding: 8, fontSize: 12, overflowY: 'auto', height: '100%' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          {['Symbol', 'Type', 'Side', 'Trigger', 'Fill Price', 'Qty', 'PnL', 'Status', ''].map(h => (
            <th key={h} style={{ padding: '3px 8px', textAlign: ['Trigger', 'Fill Price', 'Qty', 'PnL', 'Status'].includes(h) ? 'right' : 'left' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id} style={{ borderBottom: '1px solid var(--bg-panel)' }}>
            <td style={{ padding: '3px 8px' }}>{o.symbol}</td>
            <td style={{ padding: '3px 8px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{o.orderType || 'market'}</td>
            <td style={{ padding: '3px 8px', color: o.side === 'BUY' ? 'var(--accent)' : 'var(--danger)' }}>{o.side}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>{(o.triggerPrice || o.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{o.fillPrice ? o.fillPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>{o.quantity}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: o.pnl !== undefined ? (o.pnl >= 0 ? 'var(--accent)' : 'var(--danger)') : 'var(--text-muted)' }}>
              {o.pnl !== undefined ? `${o.pnl >= 0 ? '+' : ''}$${o.pnl.toFixed(2)}` : '—'}
            </td>
            <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 11, color: o.status === 'FILLED' ? 'var(--accent)' : o.status === 'CANCELLED' ? 'var(--text-muted)' : 'var(--accent)', fontWeight: 600 }}>
              {o.status}
            </td>
            <td style={{ padding: '3px 8px' }}>
              {(o.status === 'OPEN' || o.status === 'PENDING') && (
                <button onClick={() => onCancel(o.id)} style={{ padding: '1px 6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>✕</button>
              )}
            </td>
          </tr>
        ))}
        {orders.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No orders yet</td></tr>}
      </tbody>
    </table>
  </div>
);

export default App;
