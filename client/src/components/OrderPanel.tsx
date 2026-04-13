import React, { useState } from 'react';
import { Order } from '../types';

interface Props {
  symbol: string;
  lastPrice?: string;
  orders: Order[];
  onPlaceOrder: (order: Order) => void;
  onCancelOrder: (id: string) => void;
}

const OrderPanel: React.FC<Props> = ({ symbol, lastPrice, orders, onPlaceOrder, onCancelOrder }) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price) || (lastPrice ? parseFloat(lastPrice) : 0);
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    const order: Order = {
      id: Date.now().toString(),
      symbol,
      side,
      price: p,
      quantity: q,
      status: 'OPEN',
      time: Date.now(),
    };
    onPlaceOrder(order);
    setPrice('');
    setQty('');
  };

  return (
    <div style={{ padding: 12, fontSize: 13 }}>
      <div style={{ display: 'flex', marginBottom: 12, borderRadius: 4, overflow: 'hidden', border: '1px solid #3a3a5e' }}>
        <button
          onClick={() => setSide('BUY')}
          style={{ flex: 1, padding: '6px 0', background: side === 'BUY' ? '#26a69a' : 'transparent', color: side === 'BUY' ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          BUY
        </button>
        <button
          onClick={() => setSide('SELL')}
          style={{ flex: 1, padding: '6px 0', background: side === 'SELL' ? '#ef5350' : 'transparent', color: side === 'SELL' ? '#fff' : '#888', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          SELL
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ color: '#888', display: 'block', marginBottom: 2 }}>Price</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder={lastPrice || 'Market'}
            style={{ width: '100%', padding: '6px 8px', background: '#1a1a2e', border: '1px solid #3a3a5e', borderRadius: 4, color: '#e0e0e0', fontSize: 13 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#888', display: 'block', marginBottom: 2 }}>Quantity</label>
          <input
            type="number"
            value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder="0.00"
            style={{ width: '100%', padding: '6px 8px', background: '#1a1a2e', border: '1px solid #3a3a5e', borderRadius: 4, color: '#e0e0e0', fontSize: 13 }}
          />
        </div>
        <button
          type="submit"
          style={{
            width: '100%', padding: '8px 0',
            background: side === 'BUY' ? '#26a69a' : '#ef5350',
            color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}
        >
          {side} {symbol.replace('USDT', '')}
        </button>
      </form>
      {orders.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: '#888', marginBottom: 6, fontSize: 12 }}>Open Orders</div>
          {orders.filter(o => o.status === 'OPEN').map(order => (
            <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #2a2a3e', fontSize: 12 }}>
              <span style={{ color: order.side === 'BUY' ? '#26a69a' : '#ef5350' }}>{order.side}</span>
              <span>{order.price.toLocaleString()}</span>
              <span>{order.quantity}</span>
              <button
                onClick={() => onCancelOrder(order.id)}
                style={{ padding: '2px 6px', background: 'transparent', border: '1px solid #666', borderRadius: 3, color: '#999', cursor: 'pointer', fontSize: 11 }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderPanel;
