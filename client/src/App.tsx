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
  const [bottomTab, setBottomTab] = useState<'securities' | 'orders' | 'trades' | 'buysell' | 'journal'>('securities');
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
        // Update wallet P&L
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
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#080c14', color: '#e0e0e0' }}>
        <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <AICoachPage sessionId={sessionId} onBack={() => setPage('terminal')} />
        </div>
        {showDeposit && <DepositModal sessionId={sessionId} publishableKey={stripePk} onClose={() => setShowDeposit(false)} onSuccess={() => { setShowDeposit(false); setWalletRefresh(n => n + 1); }} />}
      </div>
    );
  }
  if (page === 'leaderboard') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#080c14', color: '#e0e0e0' }}>
        <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} />
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
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d0d1a', color: '#e0e0e0', position: 'relative' }}>
        <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', background: '#080c14', borderBottom: '1px solid #1e2433', gap: 8, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, background: 'linear-gradient(135deg,#00ff88,#00cc70)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AlgoTrader</div>
          {isDemo && <span style={{ padding: '1px 6px', background: '#ff980020', border: '1px solid #ff9800', borderRadius: 10, fontSize: 10, color: '#ff9800' }}>DEMO</span>}
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={{ background: '#1e2433', color: '#e0e0e0', border: '1px solid #2a3444', borderRadius: 4, padding: '3px 6px', fontSize: 12, flex: 1 }}>
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setPage('heatmap')} style={{ background: 'transparent', border: '1px solid #2a3444', borderRadius: 6, color: '#888', padding: '3px 8px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>🗺</button>
          {ticker && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: change >= 0 ? '#00ff88' : '#ef5350', lineHeight: 1 }}>
                {parseFloat(ticker.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 10, color: change >= 0 ? '#00ff88' : '#ef5350' }}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {mobileTab === 'charts' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 2, padding: '4px 8px', background: '#080c14', borderBottom: '1px solid #1e2433', overflowX: 'auto' }}>
                {INTERVALS.map(iv => (
                  <button key={iv} onClick={() => setInterval(iv)} style={{ padding: '3px 7px', fontSize: 11, border: 'none', borderRadius: 3, cursor: 'pointer', flexShrink: 0, background: interval === iv ? '#00ff88' : 'transparent', color: interval === iv ? '#000' : '#666' }}>{iv}</button>
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
                <button onClick={() => setPage('coach')} style={{ flex: 1, padding: '10px', background: '#0d1117', border: '1px solid #1e2433', borderRadius: 10, color: '#00ff88', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🤖 AI Coach</button>
                <button onClick={() => setPage('leaderboard')} style={{ flex: 1, padding: '10px', background: '#0d1117', border: '1px solid #1e2433', borderRadius: 10, color: '#ffd700', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🏆 Leaderboard</button>
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
            style={{ position: 'absolute', right: 16, bottom: 72, width: 52, height: 52, borderRadius: '50%', background: showMobileBuySell ? '#ef5350' : 'linear-gradient(135deg,#00ff88,#00cc70)', color: '#000', border: 'none', fontSize: 22, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,255,136,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          >
            {showMobileBuySell ? '✕' : '⇅'}
          </button>
        )}

        {showMobileBuySell && mobileTab === 'charts' && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, background: '#080c14', borderTop: '1px solid #1e2433', zIndex: 90, maxHeight: '70vh', overflowY: 'auto' }}>
            <OrderPanel symbol={symbol} lastPrice={ticker?.lastPrice} orders={orders} onPlaceOrder={handlePlaceOrder} onCancelOrder={handleCancelOrder} />
          </div>
        )}

        <nav style={{ display: 'flex', background: '#080c14', borderTop: '1px solid #1e2433', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {MOBILE_TABS.map(tab => (
            <button key={tab.id} onClick={() => { setMobileTab(tab.id); setShowMobileBuySell(false); }} style={{ flex: 1, padding: '8px 4px 6px', border: 'none', cursor: 'pointer', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderTop: mobileTab === tab.id ? '2px solid #00ff88' : '2px solid transparent' }}>
              <span style={{ fontSize: 18 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, color: mobileTab === tab.id ? '#00ff88' : '#555', fontWeight: mobileTab === tab.id ? 700 : 400 }}>{tab.label}</span>
            </button>
          ))}
        </nav>

        {showDeposit && <DepositModal sessionId={sessionId} publishableKey={stripePk} onClose={() => setShowDeposit(false)} onSuccess={() => { setShowDeposit(false); setWalletRefresh(n => n + 1); }} />}
        {journalOrder && <JournalModal key={`modal-${journalOrder.id}`} order={journalOrder} onSave={handleJournalSave} onSkip={handleJournalSkip} />}
      </div>
    );
  }

  // ── Desktop Layout ───────────────────────────────────────────────────────────
  const desktopBottomTabs = ['securities', 'buysell', 'orders', 'trades', 'journal'] as const;
  const tabLabel = (t: typeof desktopBottomTabs[number]) => {
    if (t === 'buysell') return 'Buy/Sell';
    if (t === 'journal') return '📓 Journal';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#080c14', color: '#e0e0e0' }}>
      <WalletBar key={walletRefresh} sessionId={sessionId} onDeposit={() => setShowDeposit(true)} />

      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 12px', background: '#0d1117', borderBottom: '1px solid #1e2433', gap: 10, flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#00ff88,#00cc70)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginRight: 4 }}>
          AlgoTrader
        </div>

        {/* Nav buttons */}
        {[
          { id: 'heatmap', icon: '🗺', label: 'Heatmap', page: 'heatmap' as Page },
          { id: 'coach',   icon: '🤖', label: 'AI Coach', page: 'coach' as Page },
          { id: 'lb',      icon: '🏆', label: 'Leaderboard', page: 'leaderboard' as Page },
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => setPage(btn.page)}
            style={{ background: 'transparent', border: '1px solid #1e2433', borderRadius: 6, color: '#888', padding: '3px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {btn.icon} {btn.label}
          </button>
        ))}

        {isDemo && <span style={{ padding: '2px 8px', background: '#ff980015', border: '1px solid #ff9800', borderRadius: 12, fontSize: 10, color: '#ff9800' }}>DEMO</span>}

        <select value={symbol} onChange={e => setSymbol(e.target.value)} style={{ background: '#1e2433', color: '#e0e0e0', border: '1px solid #2a3444', borderRadius: 4, padding: '3px 8px', fontSize: 13 }}>
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 2 }}>
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => setInterval(iv)} style={{ padding: '3px 8px', fontSize: 12, border: 'none', borderRadius: 3, cursor: 'pointer', background: interval === iv ? '#00ff88' : 'transparent', color: interval === iv ? '#000' : '#666', fontWeight: interval === iv ? 700 : 400 }}>{iv}</button>
          ))}
        </div>

        {ticker && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: change >= 0 ? '#00ff88' : '#ef5350' }}>
              {parseFloat(ticker.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </span>
            <span style={{ color: change >= 0 ? '#00ff88' : '#ef5350' }}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
            <span style={{ color: '#444' }}>H: {parseFloat(ticker.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span style={{ color: '#444' }}>L: {parseFloat(ticker.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span style={{ color: '#444' }}>Vol: {parseFloat(ticker.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Chart klines={klines} symbol={symbol} />
          </div>
          <div style={{ height: 265, borderTop: '1px solid #1e2433', background: '#0d1117', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #1e2433', flexShrink: 0 }}>
              {desktopBottomTabs.map(tab => (
                <button key={tab} onClick={() => setBottomTab(tab)} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, background: bottomTab === tab ? '#1e2433' : 'transparent', color: bottomTab === tab ? '#e0e0e0' : '#555', borderBottom: bottomTab === tab ? '2px solid #00ff88' : '2px solid transparent', whiteSpace: 'nowrap', position: 'relative' }}>
                  {tabLabel(tab)}
                  {tab === 'orders' && pendingCount > 0 && (
                    <span style={{ marginLeft: 5, padding: '1px 5px', background: '#ff9800', borderRadius: 8, fontSize: 10, color: '#000', fontWeight: 700 }}>{pendingCount}</span>
                  )}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', padding: '0 10px' }}>
                <button onClick={() => setPage('coach')} style={{ background: '#0d1a0d', border: '1px solid #1e3a1e', borderRadius: 6, color: '#00ff88', padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🤖 AI Coach</button>
                <button onClick={() => setPage('leaderboard')} style={{ background: '#1a150a', border: '1px solid #3a2e0a', borderRadius: 6, color: '#ffd700', padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>🏆 Board</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {bottomTab === 'securities' && <SecuritiesTable selectedSymbol={symbol} onSelectSymbol={setSymbol} />}
              {bottomTab === 'trades' && <TradesPanel trades={trades} />}
              {bottomTab === 'orders' && <DesktopOrdersTable orders={orders} onCancel={handleCancelOrder} />}
              {bottomTab === 'buysell' && <OrderPanel symbol={symbol} lastPrice={ticker?.lastPrice} orders={orders} onPlaceOrder={handlePlaceOrder} onCancelOrder={handleCancelOrder} />}
              {bottomTab === 'journal' && <JournalTab key={journalKey} />}
            </div>
          </div>
        </div>
        <div style={{ width: 240, borderLeft: '1px solid #1e2433', flexShrink: 0 }}>
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
      <tr style={{ color: '#555', borderBottom: '1px solid #1e2433' }}>
        {['Symbol', 'Type', 'Side', 'Fill', 'PnL', 'Status'].map(h => <th key={h} style={{ padding: '4px 6px', textAlign: h === 'Fill' || h === 'PnL' || h === 'Status' ? 'right' : 'left' }}>{h}</th>)}
      </tr>
    </thead>
    <tbody>
      {orders.map(o => (
        <tr key={o.id} style={{ borderBottom: '1px solid #0d1117' }}>
          <td style={{ padding: '4px 6px' }}>{o.symbol}</td>
          <td style={{ padding: '4px 6px', color: '#555', textTransform: 'capitalize' }}>{o.orderType}</td>
          <td style={{ padding: '4px 6px', color: o.side === 'BUY' ? '#00ff88' : '#ef5350' }}>{o.side}</td>
          <td style={{ padding: '4px 6px', textAlign: 'right', color: '#777' }}>{o.fillPrice ? o.fillPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
          <td style={{ padding: '4px 6px', textAlign: 'right', color: o.pnl !== undefined ? (o.pnl >= 0 ? '#00ff88' : '#ef5350') : '#555' }}>
            {o.pnl !== undefined ? `${o.pnl >= 0 ? '+' : ''}$${o.pnl.toFixed(2)}` : '—'}
          </td>
          <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 10, color: o.status === 'FILLED' ? '#00ff88' : o.status === 'CANCELLED' ? '#444' : '#ff9800' }}>
            {o.status}
            {(o.status === 'OPEN' || o.status === 'PENDING') && (
              <button onClick={() => onCancel(o.id)} style={{ marginLeft: 4, padding: '0 4px', background: 'transparent', border: '1px solid #333', borderRadius: 2, color: '#666', cursor: 'pointer', fontSize: 9 }}>✕</button>
            )}
          </td>
        </tr>
      ))}
      {orders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#333' }}>No orders yet</td></tr>}
    </tbody>
  </table>
);

const DesktopOrdersTable: React.FC<{ orders: Order[]; onCancel: (id: string) => void }> = ({ orders, onCancel }) => (
  <div style={{ padding: 8, fontSize: 12, overflowY: 'auto', height: '100%' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: '#555', borderBottom: '1px solid #1e2433' }}>
          {['Symbol', 'Type', 'Side', 'Trigger', 'Fill Price', 'Qty', 'PnL', 'Status', ''].map(h => (
            <th key={h} style={{ padding: '3px 8px', textAlign: ['Trigger', 'Fill Price', 'Qty', 'PnL', 'Status'].includes(h) ? 'right' : 'left' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map(o => (
          <tr key={o.id} style={{ borderBottom: '1px solid #0d1117' }}>
            <td style={{ padding: '3px 8px' }}>{o.symbol}</td>
            <td style={{ padding: '3px 8px', color: '#555', textTransform: 'capitalize' }}>{o.orderType || 'market'}</td>
            <td style={{ padding: '3px 8px', color: o.side === 'BUY' ? '#00ff88' : '#ef5350' }}>{o.side}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555' }}>{(o.triggerPrice || o.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#777' }}>{o.fillPrice ? o.fillPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right' }}>{o.quantity}</td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: o.pnl !== undefined ? (o.pnl >= 0 ? '#00ff88' : '#ef5350') : '#555' }}>
              {o.pnl !== undefined ? `${o.pnl >= 0 ? '+' : ''}$${o.pnl.toFixed(2)}` : '—'}
            </td>
            <td style={{ padding: '3px 8px', textAlign: 'right', color: o.status === 'FILLED' ? '#00ff88' : o.status === 'CANCELLED' ? '#444' : '#ff9800' }}>{o.status}</td>
            <td style={{ padding: '3px 8px', textAlign: 'center' }}>
              {(o.status === 'OPEN' || o.status === 'PENDING') && (
                <button onClick={() => onCancel(o.id)} style={{ padding: '1px 6px', background: 'transparent', border: '1px solid #2a3444', borderRadius: 3, color: '#555', cursor: 'pointer', fontSize: 10 }}>✕</button>
              )}
            </td>
          </tr>
        ))}
        {orders.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#333' }}>No orders yet</td></tr>}
      </tbody>
    </table>
  </div>
);

export default App;
