import React, { useState, useCallback } from 'react';
import Chart from './components/Chart';
import OrderBook from './components/OrderBook';
import SecuritiesTable from './components/SecuritiesTable';
import TradesPanel from './components/TradesPanel';
import OrderPanel from './components/OrderPanel';
import { useMarketData } from './hooks/useMarketData';
import { SYMBOLS, INTERVALS, Order } from './types';

const App: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1m');
  const [bottomTab, setBottomTab] = useState<'securities' | 'orders' | 'trades' | 'buysell'>('securities');
  const [orders, setOrders] = useState<Order[]>([]);

  const { klines, orderBook, trades, ticker, isDemo } = useMarketData(symbol, interval);

  const handlePlaceOrder = useCallback((order: Order) => {
    setOrders(prev => [order, ...prev]);
    setTimeout(() => {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'FILLED' as const } : o));
    }, 1500 + Math.random() * 1000);
  }, []);

  const handleCancelOrder = useCallback((id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' as const } : o));
  }, []);

  const change = ticker ? parseFloat(ticker.priceChangePercent) : 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a2e', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: '#16213e', borderBottom: '1px solid #2a2a4e', gap: 12, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#4fc3f7', marginRight: 8 }}>S# Terminal</div>
        {isDemo && (
          <span style={{ padding: '2px 8px', background: '#ff980020', border: '1px solid #ff9800', borderRadius: 12, fontSize: 11, color: '#ff9800' }}>
            DEMO
          </span>
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
            <span style={{ color: change >= 0 ? '#26a69a' : '#ef5350' }}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </span>
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
          <div style={{ height: 220, borderTop: '1px solid #2a2a4e', background: '#1e1e35', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #2a2a4e', flexShrink: 0 }}>
              {(['securities', 'buysell', 'orders', 'trades'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  style={{
                    padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 12,
                    background: bottomTab === tab ? '#2a2a4e' : 'transparent',
                    color: bottomTab === tab ? '#e0e0e0' : '#666',
                    borderBottom: bottomTab === tab ? '2px solid #4fc3f7' : '2px solid transparent',
                  }}
                >
                  {tab === 'buysell' ? 'Buy/Sell' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {bottomTab === 'securities' && (
                <SecuritiesTable selectedSymbol={symbol} onSelectSymbol={setSymbol} />
              )}
              {bottomTab === 'trades' && (
                <TradesPanel trades={trades} />
              )}
              {bottomTab === 'orders' && (
                <div style={{ padding: 8, fontSize: 12, overflowY: 'auto', height: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#666', borderBottom: '1px solid #2a2a4e' }}>
                        <th style={{ padding: '3px 8px', textAlign: 'left' }}>Symbol</th>
                        <th style={{ padding: '3px 8px', textAlign: 'left' }}>Side</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '3px 8px', textAlign: 'right' }}>Status</th>
                        <th style={{ padding: '3px 8px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                          <td style={{ padding: '3px 8px' }}>{order.symbol}</td>
                          <td style={{ padding: '3px 8px', color: order.side === 'BUY' ? '#26a69a' : '#ef5350' }}>{order.side}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>{order.price.toLocaleString()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right' }}>{order.quantity}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: order.status === 'FILLED' ? '#26a69a' : order.status === 'CANCELLED' ? '#888' : '#ff9800' }}>
                            {order.status}
                          </td>
                          <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                            {order.status === 'OPEN' && (
                              <button onClick={() => handleCancelOrder(order.id)} style={{ padding: '1px 6px', background: 'transparent', border: '1px solid #666', borderRadius: 3, color: '#999', cursor: 'pointer', fontSize: 11 }}>
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#555' }}>No orders</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {bottomTab === 'buysell' && (
                <OrderPanel
                  symbol={symbol}
                  lastPrice={ticker?.lastPrice}
                  orders={orders}
                  onPlaceOrder={handlePlaceOrder}
                  onCancelOrder={handleCancelOrder}
                />
              )}
            </div>
          </div>
        </div>
        <div style={{ width: 240, borderLeft: '1px solid #2a2a4e', flexShrink: 0 }}>
          <OrderBook orderBook={orderBook} lastPrice={ticker?.lastPrice} />
        </div>
      </div>
    </div>
  );
};

export default App;
