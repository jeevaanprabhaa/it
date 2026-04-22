import React from 'react';
import { OrderBook as OrderBookType } from '../types';

interface Props {
  orderBook: OrderBookType;
  lastPrice?: string;
  baseAsset?: string;
  quoteAsset?: string;
}

const OrderBook: React.FC<Props> = ({ orderBook, lastPrice, baseAsset = 'BTC', quoteAsset = 'USDT' }) => {
  const maxQty = Math.max(
    ...orderBook.bids.map(b => b.quantity),
    ...orderBook.asks.map(a => a.quantity),
    1
  );

  const fmtPrice = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const fmtQty   = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 5 });

  const lastNum = lastPrice ? parseFloat(lastPrice) : 0;

  // Use 8 levels each side (denser look like the screenshot)
  const asks = orderBook.asks.slice(0, 8);
  const bids = orderBook.bids.slice(0, 8);

  const Row: React.FC<{ price: number; qty: number; side: 'ask' | 'bid' }> = ({ price, qty, side }) => {
    const color = side === 'ask' ? '#F0616D' : '#16C784';
    const bg    = side === 'ask' ? 'rgba(240,97,109,0.10)' : 'rgba(22,199,132,0.10)';
    const total = price * qty;
    return (
      <div style={{
        position: 'relative', display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '3px 12px',
        fontSize: 11.5,
        fontVariantNumeric: 'tabular-nums',
      }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(qty / maxQty) * 100}%`, background: bg }} />
        <span style={{ color, position: 'relative', fontWeight: 600 }}>{fmtPrice(price)}</span>
        <span style={{ textAlign: 'right', position: 'relative', color: '#EAEEF7' }}>{fmtQty(qty)}</span>
        <span style={{ textAlign: 'right', position: 'relative', color: '#8C95B5' }}>{(total / 1e6 >= 1 ? (total / 1e6).toFixed(3) + 'M' : fmtQty(total))}</span>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#070A12', fontSize: 12 }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Tick layout icons */}
          <button title="Both" style={{ width: 22, height: 22, padding: 0, background: 'transparent', border: 0, cursor: 'pointer', color: '#16C784' }}>
            <svg viewBox="0 0 16 16" width="22" height="22"><rect x="2" y="2" width="5" height="12" fill="#16C784"/><rect x="9" y="2" width="5" height="12" fill="#F0616D"/></svg>
          </button>
          <button title="Bids" style={{ width: 22, height: 22, padding: 0, background: 'transparent', border: 0, cursor: 'pointer' }}>
            <svg viewBox="0 0 16 16" width="22" height="22"><rect x="2" y="2" width="12" height="12" fill="#16C784" opacity="0.5"/></svg>
          </button>
          <button title="Asks" style={{ width: 22, height: 22, padding: 0, background: 'transparent', border: 0, cursor: 'pointer' }}>
            <svg viewBox="0 0 16 16" width="22" height="22"><rect x="2" y="2" width="12" height="12" fill="#F0616D" opacity="0.5"/></svg>
          </button>
        </div>
        <select defaultValue="0.1" style={{ background: '#131A2B', color: '#EAEEF7', border: '1px solid #1A2238', borderRadius: 6, padding: '2px 6px', fontSize: 11 }}>
          <option>0.1</option><option>1</option><option>10</option>
        </select>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '4px 12px', color: '#6B7494', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em' }}>
        <span>Price ({quoteAsset})</span>
        <span style={{ textAlign: 'right' }}>Size ({baseAsset})</span>
        <span style={{ textAlign: 'right' }}>Total ({baseAsset})</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Asks (top, reversed so lowest at bottom) */}
        <div style={{ display: 'flex', flexDirection: 'column-reverse', flexShrink: 0 }}>
          {asks.map((a, i) => <Row key={i} price={a.price} qty={a.quantity} side="ask" />)}
        </div>

        {/* Current price highlight row */}
        {lastNum > 0 && (
          <div style={{
            margin: '6px 0',
            padding: '8px 12px',
            background: '#0F1A14',
            borderTop: '1px solid rgba(22,199,132,0.25)',
            borderBottom: '1px solid rgba(22,199,132,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#16C784', fontSize: 14 }}>↑</span>
              <span style={{ color: '#16C784', fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(lastNum)}</span>
              <span style={{ color: '#6B7494', fontSize: 10.5 }}>{quoteAsset}</span>
            </div>
            <span style={{ color: '#8C95B5', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 14, height: 1, background: '#8C95B5', display: 'inline-block' }} />
              1 {baseAsset}
            </span>
          </div>
        )}

        {/* Bids */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {bids.map((b, i) => <Row key={i} price={b.price} qty={b.quantity} side="bid" />)}
        </div>
      </div>
    </div>
  );
};

export default OrderBook;
