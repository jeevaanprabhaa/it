import React from 'react';
import { OrderBook as OrderBookType } from '../types';

interface Props {
  orderBook: OrderBookType;
}

const OrderBookVisualizer: React.FC<Props> = ({ orderBook }) => {
  const buyVol  = orderBook.bids.reduce((s, b) => s + b.price * b.quantity, 0);
  const sellVol = orderBook.asks.reduce((s, a) => s + a.price * a.quantity, 0);
  const total = buyVol + sellVol || 1;
  const buyPct  = (buyVol  / total) * 100;
  const sellPct = (sellVol / total) * 100;

  const buyOrders  = orderBook.bids.length;
  const sellOrders = orderBook.asks.length;
  const buyers  = Math.max(1, Math.round(buyOrders  * 0.95));
  const sellers = Math.max(1, Math.round(sellOrders * 0.5));

  const fmtMillions = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toFixed(2)}M USD`
              : n >= 1e3 ? `${(n / 1e3).toFixed(2)}K USD` : `${n.toFixed(0)} USD`;

  // Generate bar columns
  const cols = 18;
  const buyHeights  = Array.from({ length: cols }, (_, i) => 30 + Math.sin(i * 0.7) * 12 + Math.random() * 18);
  const sellHeights = Array.from({ length: cols }, (_, i) => 25 + Math.cos(i * 0.6) * 10 + Math.random() * 22);

  return (
    <div style={{
      background: '#070A12',
      borderTop: '1px solid #131A2B',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EAEEF7', fontSize: 12, fontWeight: 700 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M4 20V10 M10 20V4 M16 20V14 M22 20V8" stroke="#16C784" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Order Book Visualizer
      </div>

      {/* BUY block */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: '#EAEEF7', fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{buyPct.toFixed(2)}%</span>
          </div>
          <span style={{ color: '#6B7494', fontSize: 10 }}>Size: {fmtMillions(buyVol)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, fontSize: 10, color: '#6B7494' }}>
          <span style={{ color: '#16C784', fontWeight: 700 }}>● BUY</span>
          <span>{buyOrders} Buy Orders &nbsp; <span style={{ color: '#8C95B5' }}>{buyers} Buyers</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
          {buyHeights.map((h, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${Math.max(8, Math.min(100, h))}%`,
              background: 'linear-gradient(180deg, #16C784 0%, #0E7E54 100%)',
              borderRadius: 1,
              opacity: 0.65 + (i / cols) * 0.35,
            }} />
          ))}
        </div>
      </div>

      {/* SELL block */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, height: 50 }}>
          {sellHeights.map((h, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${Math.max(8, Math.min(100, h))}%`,
              background: 'linear-gradient(0deg, #F0616D 0%, #8B2D3A 100%)',
              borderRadius: 1,
              opacity: 0.65 + (i / cols) * 0.35,
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: '#EAEEF7', fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{sellPct.toFixed(2)}%</span>
          </div>
          <span style={{ color: '#6B7494', fontSize: 10 }}>Size: {fmtMillions(sellVol)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, fontSize: 10, color: '#6B7494' }}>
          <span style={{ color: '#F0616D', fontWeight: 700 }}>● SELL</span>
          <span>{sellOrders} Sell Orders &nbsp; <span style={{ color: '#8C95B5' }}>{sellers} Sellers</span></span>
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#6B7494', fontSize: 11, fontWeight: 700 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#6B7494" strokeWidth="2"/>
          <path d="M12 7v6l4 2" stroke="#6B7494" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Market Info
        <span style={{ marginLeft: 'auto', color: '#6B7494' }}>⋮⋮⋮</span>
      </div>
    </div>
  );
};

export default OrderBookVisualizer;
