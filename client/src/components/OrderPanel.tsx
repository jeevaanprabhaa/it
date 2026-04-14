import React, { useState } from 'react';
import { Order, OrderType } from '../types';

interface Props {
  symbol: string;
  lastPrice?: string;
  orders: Order[];
  onPlaceOrder: (order: Order) => void;
  onCancelOrder: (id: string) => void;
}

const ORDER_TYPES: { type: OrderType; label: string; desc: string }[] = [
  { type: 'market', label: 'Market', desc: 'Fills immediately at current price' },
  { type: 'limit', label: 'Limit', desc: 'Fills when price reaches target' },
  { type: 'stop', label: 'Stop-Loss', desc: 'Sells when price falls below stop' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 4,
  color: 'var(--text-primary)', fontSize: 12, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)', display: 'block', marginBottom: 3, fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const OrderPanel: React.FC<Props> = ({ symbol, lastPrice, orders, onPlaceOrder, onCancelOrder }) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [qty, setQty] = useState('');

  const marketPrice = lastPrice ? parseFloat(lastPrice) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(qty);
    if (!q || q <= 0) return;

    const p = parseFloat(price) || marketPrice;
    const tp = parseFloat(triggerPrice) || p;

    const order: Order = {
      id: Date.now().toString(),
      symbol,
      side: orderType === 'stop' ? 'SELL' : side,
      orderType,
      price: p,
      triggerPrice: orderType !== 'market' ? tp : undefined,
      quantity: q,
      status: orderType === 'market' ? 'OPEN' : 'PENDING',
      time: Date.now(),
    };

    if (orderType !== 'market') {
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        });
      } catch {}
    }

    onPlaceOrder(order);
    setPrice('');
    setTriggerPrice('');
    setQty('');
  };

  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'OPEN');
  const effectiveSide = orderType === 'stop' ? 'SELL' : side;

  return (
    <div style={{ padding: '10px 12px', fontSize: 13, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {ORDER_TYPES.map(ot => (
          <button
            key={ot.type}
            onClick={() => setOrderType(ot.type)}
            title={ot.desc}
            style={{
              flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 600,
              border: `1px solid ${orderType === ot.type ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 4, cursor: 'pointer',
              background: orderType === ot.type ? 'rgba(46,204,152,0.1)' : 'transparent',
              color: orderType === ot.type ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {ot.label}
          </button>
        ))}
      </div>

      {orderType !== 'stop' && (
        <div style={{ display: 'flex', marginBottom: 10, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setSide('BUY')}
            style={{ flex: 1, padding: '5px 0', background: side === 'BUY' ? 'var(--accent)' : 'transparent', color: side === 'BUY' ? '#000' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
          >
            BUY
          </button>
          <button
            onClick={() => setSide('SELL')}
            style={{ flex: 1, padding: '5px 0', background: side === 'SELL' ? 'var(--danger)' : 'transparent', color: side === 'SELL' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
          >
            SELL
          </button>
        </div>
      )}

      {orderType === 'stop' && (
        <div style={{ padding: '4px 8px', marginBottom: 8, background: 'rgba(229,83,75,0.08)', border: '1px solid rgba(229,83,75,0.25)', borderRadius: 4, fontSize: 11, color: 'var(--danger)' }}>
          Stop-Loss automatically sells when price falls to the stop level.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {orderType === 'market' && (
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Price (Market)</label>
            <div style={{ ...inputStyle, color: 'var(--text-muted)', cursor: 'default', display: 'flex', alignItems: 'center' }}>
              {marketPrice ? marketPrice.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'} <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-muted)' }}>auto</span>
            </div>
          </div>
        )}

        {orderType === 'limit' && (
          <>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Entry Price (at order time)</label>
              <input
                type="number" step="any" value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder={lastPrice || '0'}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Trigger Price (execute when reached)</label>
              <input
                type="number" step="any" value={triggerPrice}
                onChange={e => setTriggerPrice(e.target.value)}
                placeholder={side === 'BUY' ? 'Below current price' : 'Above current price'}
                style={{ ...inputStyle, borderColor: 'rgba(46,204,152,0.4)' }}
              />
            </div>
          </>
        )}

        {orderType === 'stop' && (
          <>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Current Entry Price</label>
              <input
                type="number" step="any" value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder={lastPrice || '0'}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Stop Price (sell when price falls to)</label>
              <input
                type="number" step="any" value={triggerPrice}
                onChange={e => setTriggerPrice(e.target.value)}
                placeholder="Below current price"
                style={{ ...inputStyle, borderColor: 'rgba(229,83,75,0.4)' }}
              />
            </div>
          </>
        )}

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Quantity</label>
          <input
            type="number" step="any" value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder="0.00"
            style={inputStyle}
          />
        </div>

        {orderType !== 'market' && triggerPrice && qty && (
          <div style={{ marginBottom: 8, padding: '5px 8px', background: 'rgba(46,204,152,0.05)', border: '1px solid rgba(46,204,152,0.15)', borderRadius: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--accent)' }}>
              {orderType === 'limit'
                ? `Will ${side} ${qty} ${symbol.replace('USDT','')} when price ${side === 'BUY' ? '≤' : '≥'} ${parseFloat(triggerPrice).toLocaleString()}`
                : `Will SELL ${qty} ${symbol.replace('USDT','')} when price ≤ ${parseFloat(triggerPrice).toLocaleString()}`
              }
            </span>
            <br />
            <span style={{ color: 'var(--text-muted)' }}>Checked every 30s by the server</span>
          </div>
        )}

        <button
          type="submit"
          style={{
            width: '100%', padding: '8px 0',
            background: orderType === 'stop' ? 'var(--danger)' : (effectiveSide === 'BUY' ? 'var(--accent)' : 'var(--danger)'),
            color: effectiveSide === 'BUY' && orderType !== 'stop' ? '#000' : 'var(--text-primary)',
            border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', fontSize: 13,
          }}
        >
          {orderType === 'market' && `${effectiveSide} ${symbol.replace('USDT', '')} (Market)`}
          {orderType === 'limit' && `Place Limit ${effectiveSide}`}
          {orderType === 'stop' && `Set Stop-Loss`}
        </button>
      </form>

      {pendingOrders.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Open Orders ({pendingOrders.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pendingOrders.map(order => (
              <div key={order.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                alignItems: 'center', padding: '5px 8px',
                background: 'var(--bg-hover)', borderRadius: 4,
                border: `1px solid ${order.status === 'PENDING' ? 'rgba(46,204,152,0.2)' : 'var(--border)'}`,
                fontSize: 11, gap: 4,
              }}>
                <div>
                  <span style={{ color: order.side === 'BUY' ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>{order.side}</span>
                  {' '}
                  <span style={{ color: 'var(--text-muted)' }}>{order.orderType}</span>
                </div>
                <div style={{ color: 'var(--text-primary)' }}>
                  {order.triggerPrice
                    ? `@ ${order.triggerPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                    : `@ ${order.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                  }
                </div>
                <div>
                  <span style={{ color: order.status === 'PENDING' ? '#ff9800' : 'var(--accent)', fontWeight: 600 }}>
                    {order.status}
                  </span>
                </div>
                <button
                  onClick={() => onCancelOrder(order.id)}
                  style={{ padding: '2px 6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderPanel;
