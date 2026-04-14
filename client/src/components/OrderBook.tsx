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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', fontSize: 12 }}>
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-muted)' }}>
        Order Book
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '2px 8px', color: 'var(--text-muted)' }}>
        <span>Price</span><span style={{ textAlign: 'right' }}>Qty</span><span style={{ textAlign: 'right' }}>Total</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
          {orderBook.asks.slice(0, 15).map((ask, i) => (
            <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '1px 8px' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(ask.quantity / maxQty) * 100}%`, background: 'rgba(229,83,75,0.15)' }} />
              <span style={{ color: 'var(--danger)', position: 'relative' }}>{fmt(ask.price)}</span>
              <span style={{ textAlign: 'right', position: 'relative', color: 'var(--text-primary)' }}>{fmt(ask.quantity)}</span>
              <span style={{ textAlign: 'right', position: 'relative', color: 'var(--text-muted)' }}>{fmt(ask.price * ask.quantity)}</span>
            </div>
          ))}
        </div>
        {lastPrice && (
          <div style={{ padding: '4px 8px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            {parseFloat(lastPrice).toLocaleString()}
          </div>
        )}
        {orderBook.bids.slice(0, 15).map((bid, i) => (
          <div key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '1px 8px' }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(bid.quantity / maxQty) * 100}%`, background: 'rgba(46,204,152,0.15)' }} />
            <span style={{ color: 'var(--accent)', position: 'relative' }}>{fmt(bid.price)}</span>
            <span style={{ textAlign: 'right', position: 'relative', color: 'var(--text-primary)' }}>{fmt(bid.quantity)}</span>
            <span style={{ textAlign: 'right', position: 'relative', color: 'var(--text-muted)' }}>{fmt(bid.price * bid.quantity)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBook;
