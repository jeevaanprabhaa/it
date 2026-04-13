import React, { useState, useCallback, useRef, useEffect } from 'react';
import Chart from './components/Chart';
import OrderBook from './components/OrderBook';
import SecuritiesTable from './components/SecuritiesTable';
import TradesPanel from './components/TradesPanel';
import OrderPanel from './components/OrderPanel';
import JournalModal from './components/JournalModal';
import JournalTab from './components/JournalTab';
import HeatmapPage from './components/HeatmapPage';
import { useMarketData } from './hooks/useMarketData';
import { useIsMobile } from './hooks/useIsMobile';
import { SYMBOLS, INTERVALS, Order, Emotion, MarketCondition } from './types';

type Page = 'terminal' | 'heatmap';
type MobileTab = 'charts' | 'scanner' | 'portfolio' | 'journal';

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: 'charts',    icon: '📈', label: 'Charts' },
  { id: 'scanner',   icon: '🔍', label: 'Scanner' },
  { id: 'portfolio', icon: '💼', label: 'Portfolio' },
  { id: 'journal',   icon: '📓', label: 'Journal' },
];

const App: React.FC = () => {
  const isMobile = useIsMobile();
  const [page, setPage] = useState<Page>('terminal');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1m');
  const [bottomTab, setBottomTab] = useState<'securities' | 'orders' | 'trades' | 'buysell' | 'journal'>('securities');
  const [mobileTab, setMobileTab] = useState<MobileTab>('charts');
  const [showMobileBuySell, setShowMobileBuySell] = useState(false);
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

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/orders');
        const serverOrders: Order[] = await res.json();
        setOrders(prev => {
          const updated = [...prev];
          serverOrders.forEach(serverOrder => {
            if (serverOrder.status === 'FILLED' || serverOrder.status === 'CANCELLED') {
              const idx = updated.findIndex(o => o.id === serverOrder.id);
              if (idx >= 0 && updated[idx].status === 'PENDING') {
                updated[idx] = { ...updated[idx], ...serverOrder };
                if (serverOrder.status === 'FILLED') {
                  setJournalOrder({ ...updated[idx], ...serverOrder });
                  setJournalKey(k => k + 1);
                }
              }
            }
          });
          return updated;
        });
      } catch {}
    };
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  const handlePlaceOrder = useCallback((order: Order) => {
    setOrders(prev => [order, ...prev]);
    if (order.orderType === 'market') {
      const delay = 1500 + Math.random() * 1000;
      setTimeout(() => {
        const currentPrice = tickerRef.current ? parseFloat(tickerRef.current) : order.price;
        const slippage = currentPrice * (Math.random() * 0.002 - 0.001);
        const fillPrice = parseFloat((currentPrice + slippage).toFixed(6));
        const pnl = parseFloat(((fillPrice - order.price) * order.quantity * (order.side === 'BUY' ? 1 : -1)).toFixed(2));
        const filledOrder: Order = { ...order, status: 'FILLED', fillPrice, pnl };
        setOrders(prev => prev.map(o => o.id === order.id ? filledOrder : o));
        setJournalOrder(filledOrder);
        setJournalKey(k => k + 1);
      }, delay);
    }
    if (isMobile) setShowMobileBuySell(false);
  }, [isMobile]);

  const handleCancelOrder = useCallback(async (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' as const } : o));
    try { await fetch(`/api/orders/${id}`, { method: 'DELETE' }); } catch {}
  }, []);

  const handleJournalSave = useCallback(async (entry: {
    reason: string; emotion: Emotion; market_condition: MarketCondition; notes: string;
  }) => {
    if (!journalOrder) return;
    try {
      await fetch('/api/journal/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_id: journalOrder.id, ...entry, trade: journalOrder }),
      });
    } catch {}
    setJournalOrder(null);
  }, [journalOrder]);

  const handleJournalSkip = useCallback(() => setJournalOrder(null), []);

  const change = ticker ? parseFloat(ticker.priceChangePercent) : 0;
  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  if (page === 'heatmap') {
    return (
      <HeatmapPage
        onSelectSymbol={sym => { setSymbol(sym); }}
        onNavigateHome={() => setPage('terminal')}
      />
    );
  }

  if (isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a2e', color: '#e0e0e0', position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', padding: '6px 10px',
          background: '#16213e', borderBottom: '1px solid #2a2a4e', gap: 8, flexShrink: 0,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#00ff88', letterSpacing: '-0.01em' }}>AlgoTrader</div>
          {isDemo && <span style={{ padding: '1px 6px', background: '#ff980020', border: '1px solid #ff9800', borderRadius: 10, fontSize: 10, color: '#ff9800' }}>DEMO</span>}
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            style={{ background: '#1e1e35', color: '#e0e0e0', border: '1px solid #3a3a5e', borderRadius: 4, padding: '3px 6px', fontSize: 12, flex: 1 }}
          >
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setPage('heatmap')}
            style={{ background: 'transparent', border: '1px solid #3a3a5e', borderRadius: 6, color: '#9090b0', padding: '3px 8px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
          >
            🗺
          </button>
          {ticker && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: change >= 0 ? '#26a69a' : '#ef5350', lineHeight: 1 }}>
                {parseFloat(ticker.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 10, color: change >= 0 ? '#26a69a' : '#ef5350' }}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {mobileTab === 'charts' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 2, padding: '4px 8px', background: '#16213e', borderBottom: '1px solid #2a2a4e' }}>
                {INTERVALS.map(iv => (
                  <button
                    key={iv}
                    onClick={() => setInterval(iv)}
                    style={{
                      padding: '3px 7px', fontSize: 11, border: 'none', borderRadius: 3, cursor: 'pointer',
                      background: interval === iv ? '#3a3a6e' : 'transparent',
                      color: interval === iv ? '#fff' : '#666',
                    }}
                  >
                    {iv}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <Chart klines={klines} symbol={symbol} />
              </div>
            </div>
          )}
          {mobileTab === 'scanner' && (
            <div style={{ height: '100%', overflow: 'auto' }}>
              <SecuritiesTable selectedSymbol={symbol} onSelectSymbol={sym => { setSymbol(sym); setMobileTab('charts'); }} />
            </div>
          )}
          {mobileTab === 'portfolio' && (
            <div style={{ height: '100%', overflow: 'auto', padding: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#666', borderBottom: '1px solid #2a2a4e' }}>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Symbol</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Side</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Fill</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>PnL</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                      <td style={{ padding: '4px 6px' }}>{order.symbol}</td>
                      <td style={{ padding: '4px 6px', color: '#9090b0', textTransform: 'capitalize' }}>{order.orderType || 'market'}</td>
                      <td style={{ padding: '4px 6px', color: order.side === 'BUY' ? '#26a69a' : '#ef5350' }}>{order.side}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: '#888' }}>
                        {order.fillPrice ? order.fillPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', color: order.pnl !== undefined ? (order.pnl >= 0 ? '#26a69a' : '#ef5350') : '#666' }}>
                        {order.pnl !== undefined ? `${order.pnl >= 0 ? '+' : ''}$${order.pnl.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: 10, color: order.status === 'FILLED' ? '#26a69a' : order.status === 'CANCELLED' ? '#555' : '#ff9800' }}>
                        {order.status}
                        {(order.status === 'OPEN' || order.status === 'PENDING') && (
                          <button onClick={() => handleCancelOrder(order.id)} style={{ marginLeft: 4, padding: '0 4px', background: 'transparent', border: '1px solid #444', borderRadius: 2, color: '#777', cursor: 'pointer', fontSize: 9 }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#555' }}>No orders yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {mobileTab === 'journal' && (
            <div style={{ height: '100%', overflow: 'auto' }}>
              <JournalTab key={journalKey} />
            </div>
          )}
        </div>

        {mobileTab === 'charts' && (
          <button
            onClick={() => setShowMobileBuySell(v => !v)}
            style={{
              position: 'absolute', right: 16, bottom: 72,
              width: 52, height: 52, borderRadius: '50%',
              background: '#00ff88', color: '#0d0d0d',
              border: 'none', fontSize: 22, fontWeight: 900,
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,255,136,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, transition: 'transform 0.15s',
            }}
            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)'; }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
          >
            {showMobileBuySell ? '✕' : '⇅'}
          </button>
        )}

        {showMobileBuySell && mobileTab === 'charts' && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 56,
            background: '#16213e', borderTop: '1px solid #2a2a4e',
            zIndex: 90, maxHeight: '70vh', overflowY: 'auto',
          }}>
            <OrderPanel
              symbol={symbol}
              lastPrice={ticker?.lastPrice}
              orders={orders}
              onPlaceOrder={handlePlaceOrder}
              onCancelOrder={handleCancelOrder}
            />
          </div>
        )}

        <nav style={{
          display: 'flex', background: '#16213e',
          borderTop: '1px solid #2a2a4e', flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {MOBILE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setMobileTab(tab.id); setShowMobileBuySell(false); }}
              style={{
                flex: 1, padding: '8px 4px 6px', border: 'none', cursor: 'pointer',
                background: 'transparent', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2,
                borderTop: mobileTab === tab.id ? '2px solid #00ff88' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 18 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, color: mobileTab === tab.id ? '#00ff88' : '#666', fontWeight: mobileTab === tab.id ? 700 : 400 }}>
                {tab.label}
                {tab.id === 'portfolio' && pendingCount > 0 && (
                  <span style={{ marginLeft: 3, background: '#ff9800', color: '#000', borderRadius: 6, padding: '0 3px', fontSize: 8, fontWeight: 700 }}>
                    {pendingCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        {journalOrder && (
          <JournalModal
            key={`modal-${journalOrder.id}`}
            order={journalOrder}
            onSave={handleJournalSave}
            onSkip={handleJournalSkip}
          />
        )}
      </div>
    );
  }

  const desktopBottomTabs = ['securities', 'buysell', 'orders', 'trades', 'journal'] as const;
  const tabLabel = (t: typeof desktopBottomTabs[number]) => {
    if (t === 'buysell') return 'Buy/Sell';
    if (t === 'journal') return '📓 Journal';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a2e', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: '#16213e', borderBottom: '1px solid #2a2a4e', gap: 12, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#00ff88', letterSpacing: '-0.01em', marginRight: 4 }}>AlgoTrader</div>
        <button
          onClick={() => setPage('heatmap')}
          style={{ background: 'transparent', border: '1px solid #3a3a5e', borderRadius: 6, color: '#9090b0', padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          🗺 Heatmap
        </button>
        {isDemo && (
          <span style={{ padding: '2px 8px', background: '#ff980020', border: '1px solid #ff9800', borderRadius: 12, fontSize: 11, color: '#ff9800' }}>DEMO</span>
        )}
        <select
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          style={{ background: '#1e1e35', color: '#e0e0e0', border: '1px solid #3a3a5e', borderRadius: 4, padding: '3px 8px', fontSize: 13 }}
        >
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 2 }}>
          {INTERVALS.map(iv => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              style={{
                padding: '3px 8px', fontSize: 12, border: 'none', borderRadius: 3, cursor: 'pointer',
                background: interval === iv ? '#3a3a6e' : 'transparent',
                color: interval === iv ? '#fff' : '#888',
              }}
            >
              {iv}
            </button>
          ))}
        </div>
        {ticker && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: change >= 0 ? '#26a69a' : '#ef5350' }}>
              {parseFloat(ticker.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </span>
            <span style={{ color: change >= 0 ? '#26a69a' : '#ef5350' }}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
            <span style={{ color: '#888' }}>H: {parseFloat(ticker.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span style={{ color: '#888' }}>L: {parseFloat(ticker.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span style={{ color: '#888' }}>Vol: {parseFloat(ticker.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Chart klines={klines} symbol={symbol} />
          </div>
          <div style={{ height: 260, borderTop: '1px solid #2a2a4e', background: '#1e1e35', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #2a2a4e', flexShrink: 0 }}>
              {desktopBottomTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  style={{
                    padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12,
                    background: bottomTab === tab ? '#2a2a4e' : 'transparent',
                    color: bottomTab === tab ? '#e0e0e0' : '#666',
                    borderBottom: bottomTab === tab ? '2px solid #00ff88' : '2px solid transparent',
                    whiteSpace: 'nowrap', position: 'relative',
                  }}
                >
                  {tabLabel(tab)}
                  {tab === 'orders' && pendingCount > 0 && (
                    <span style={{ marginLeft: 5, padding: '1px 5px', background: '#ff9800', borderRadius: 8, fontSize: 10, color: '#000', fontWeight: 700 }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {bottomTab === 'securities' && <SecuritiesTable selectedSymbol={symbol} onSelectSymbol={setSymbol} />}
              {bottomTab === 'trades' && <TradesPanel trades={trades} />}
              {bottomTab === 'orders' && (
                <div style={{ padding: 8, fontSize: 12, overflowY: 'auto', height: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#666', borderBottom: '1px solid #2a2a4e' }}>
                        <th style={{ padding: '3px 8px', textAlign: 'left' }}>Symbol</th>
                        <th style={{ padding: '3px 8px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '3px 8px', textAlign: 'left' }}>Side</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>Trigger</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>Fill Price</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>PnL</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>Status</th>
                        <th style={{ padding: '3px 8px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                          <td style={{ padding: '3px 8px' }}>{order.symbol}</td>
                          <td style={{ padding: '3px 8px', color: '#9090b0', textTransform: 'capitalize' }}>{order.orderType || 'market'}</td>
                          <td style={{ padding: '3px 8px', color: order.side === 'BUY' ? '#26a69a' : '#ef5350' }}>{order.side}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#888' }}>
                            {order.triggerPrice
                              ? order.triggerPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })
                              : order.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#888' }}>
                            {order.fillPrice ? order.fillPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>{order.quantity}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: order.pnl !== undefined ? (order.pnl >= 0 ? '#26a69a' : '#ef5350') : '#666' }}>
                            {order.pnl !== undefined ? `${order.pnl >= 0 ? '+' : ''}$${order.pnl.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: order.status === 'FILLED' ? '#26a69a' : order.status === 'CANCELLED' ? '#555' : '#ff9800' }}>
                            {order.status}
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                            {(order.status === 'OPEN' || order.status === 'PENDING') && (
                              <button onClick={() => handleCancelOrder(order.id)} style={{ padding: '1px 6px', background: 'transparent', border: '1px solid #444', borderRadius: 3, color: '#777', cursor: 'pointer', fontSize: 10 }}>✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#555' }}>No orders yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {bottomTab === 'buysell' && (
                <OrderPanel symbol={symbol} lastPrice={ticker?.lastPrice} orders={orders} onPlaceOrder={handlePlaceOrder} onCancelOrder={handleCancelOrder} />
              )}
              {bottomTab === 'journal' && <JournalTab key={journalKey} />}
            </div>
          </div>
        </div>
        <div style={{ width: 240, borderLeft: '1px solid #2a2a4e', flexShrink: 0 }}>
          <OrderBook orderBook={orderBook} lastPrice={ticker?.lastPrice} />
        </div>
      </div>

      {journalOrder && (
        <JournalModal
          key={`modal-${journalOrder.id}`}
          order={journalOrder}
          onSave={handleJournalSave}
          onSkip={handleJournalSkip}
        />
      )}
    </div>
  );
};

export default App;
