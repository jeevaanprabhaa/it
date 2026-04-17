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
  const [bottomTab, setBottomTab] = useState<'securities' | 'orders' | 'trades' | 'journal'>('securities');
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

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(`${proto}://${window.location.host}/ws`);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
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
  const desktopBottomTabs = ['securities', 'orders', 'trades', 'journal'] as const;
  const chartIntervals = ['1m', '5m', '1h', '4h', '1d'];
  const tabLabel = (t: typeof desktopBottomTabs[number]) => {
    if (t === 'journal') return '📓 Journal';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const formatMarketValue = (value?: string, maximumFractionDigits = 4) =>
    value ? parseFloat(value).toLocaleString(undefined, { maximumFractionDigits }) : '—';
  const marketStats = [
    { label: 'Market Price', value: formatMarketValue(ticker?.lastPrice, 6), color: '#E8EAF2', large: true },
    { label: '24h Change', value: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, color: change >= 0 ? '#00C896' : '#E5534B' },
    { label: '24h High', value: formatMarketValue(ticker?.highPrice), color: '#E8EAF2' },
    { label: '24h Low', value: formatMarketValue(ticker?.lowPrice), color: '#E8EAF2' },
    { label: '24h Volume', value: formatMarketValue(ticker?.volume, 0), color: '#E8EAF2' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} activeSection="trade" onNavigateTrade={() => setPage('terminal')} onNavigateDashboard={() => setPage('leaderboard')} />

      <div style={{ display: 'flex', alignItems: 'stretch', background: '#161B27', borderBottom: '1px solid #232A3E', flexShrink: 0, minHeight: 58, overflowX: 'auto' }}>
        {marketStats.map(stat => (
          <div key={stat.label} style={{ minWidth: stat.large ? 190 : 138, padding: '10px 18px', borderRight: '1px solid #232A3E', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: '#6B7599', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{stat.label}</span>
            <span style={{ color: stat.color, fontSize: stat.large ? 20 : 13, fontWeight: stat.large ? 800 : 700, lineHeight: 1 }}>{stat.value}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderLeft: '1px solid #232A3E', flexShrink: 0 }}>
          {isDemo && <span style={{ padding: '2px 8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 12, fontSize: 10, color: 'var(--accent)' }}>DEMO</span>}
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={{ background: '#1C2236', color: '#E8EAF2', border: '1px solid #232A3E', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setPage('heatmap')} style={{ background: '#1C2236', border: '1px solid #232A3E', borderRadius: 8, color: '#6B7599', padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>Market Heatmap</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: 300, flexShrink: 0 }}>
          <OrderPanel symbol={symbol} lastPrice={ticker?.lastPrice} orders={orders} onPlaceOrder={handlePlaceOrder} onCancelOrder={handleCancelOrder} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0E1117' }}>
            <div style={{ height: 40, background: '#161B27', borderBottom: '1px solid #232A3E', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexShrink: 0 }}>
              {chartIntervals.map(iv => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  style={{
                    height: 24,
                    padding: '0 10px',
                    border: '1px solid #232A3E',
                    borderRadius: 999,
                    cursor: 'pointer',
                    background: interval === iv ? '#232A3E' : '#1C2236',
                    color: interval === iv ? '#E8EAF2' : '#6B7599',
                    fontSize: 11,
                    fontWeight: interval === iv ? 700 : 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {iv}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0, background: '#0E1117' }}>
              <Chart klines={klines} symbol={symbol} />
            </div>
          </div>
          <div style={{ height: 265, borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {desktopBottomTabs.map(tab => (
                <button key={tab} onClick={() => setBottomTab(tab)} style={{ padding: '6px 14px', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, background: bottomTab === tab ? 'var(--bg-hover)' : 'var(--bg-card)', color: bottomTab === tab ? 'var(--text-primary)' : 'var(--text-muted)', borderBottom: bottomTab === tab ? '2px solid var(--accent)' : '2px solid var(--border)', whiteSpace: 'nowrap', position: 'relative' }}>
                  {tabLabel(tab)}
                  {tab === 'orders' && pendingCount > 0 && (
                    <span style={{ marginLeft: 5, padding: '1px 5px', background: 'var(--accent)', borderRadius: 8, fontSize: 10, color: 'var(--bg-base)', fontWeight: 700 }}>{pendingCount}</span>
                  )}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', padding: '0 10px' }}>
                <button onClick={() => setPage('coach')} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent)', padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🤖 AI Coach</button>
                <button onClick={() => setPage('leaderboard')} style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--accent)', padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🏆 Board</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {bottomTab === 'securities' && <SecuritiesTable selectedSymbol={symbol} onSelectSymbol={setSymbol} />}
              {bottomTab === 'trades' && <TradesPanel trades={trades} />}
              {bottomTab === 'orders' && <DesktopOrdersTable orders={orders} onCancel={handleCancelOrder} />}
              {bottomTab === 'journal' && <JournalTab key={journalKey} />}
            </div>
          </div>
        </div>
        <div style={{ width: 240, borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
          <OrderBook orderBook={orderBook} lastPrice={ticker?.lastPrice} />
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
