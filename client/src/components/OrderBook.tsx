import React from 'react';
import { OrderBook as OrderBookType } from '../types';

interface Props {
  orderBook: OrderBookType;
  lastPrice?: string;
}

const OrderBook: React.FC<Props> = ({ orderBook, lastPrice }) => {
  const maxQty = Math.max(
    ...orderBook.bids.map(b => b.quantity),
    ...orderBook.asks.map(a => a.quantity),
    1
  );

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e35', fontSize: 12 }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #2a2a4e', fontWeight: 600, color: '#9090b0' }}>
        Order Book
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '2px 8px', color: '#666' }}>
        <span>Price</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Total</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
          {orderBook.asks.slice(0, 15).map((ask, i) => (
            <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '1px 8px' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(ask.quantity / maxQty) * 100}%`, background: 'rgba(239,83,80,0.15)' }} />
              <span style={{ color: '#ef5350', position: 'relative' }}>{fmt(ask.price)}</span>
              <span style={{ textAlign: 'right', position: 'relative' }}>{fmt(ask.quantity)}</span>
              <span style={{ textAlign: 'right', position: 'relative', color: '#666' }}>{fmt(ask.price * ask.quantity)}</span>
            </div>
          ))}
        </div>
        {lastPrice && (
          <div style={{ padding: '4px 8px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#26a69a', borderTop: '1px solid #2a2a4e', borderBottom: '1px solid #2a2a4e' }}>
            {parseFloat(lastPrice).toLocaleString()}
          </div>
        )}
        {orderBook.bids.slice(0, 15).map((bid, i) => (
          <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '1px 8px' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(bid.quantity / maxQty) * 100}%`, background: 'rgba(38,166,154,0.15)' }} />
            <span style={{ color: '#26a69a', position: 'relative' }}>{fmt(bid.price)}</span>
            <span style={{ textAlign: 'right', position: 'relative' }}>{fmt(bid.quantity)}</span>
            <span style={{ textAlign: 'right', position: 'relative', color: '#666' }}>{fmt(bid.price * bid.quantity)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBook;
