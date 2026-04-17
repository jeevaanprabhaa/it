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
  { type: 'stop', label: 'Stop', desc: 'Sells when price falls below stop' },
];

const labelStyle: React.CSSProperties = {
  color: '#6B7599',
  display: 'block',
  marginBottom: 7,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
};

const OrderPanel: React.FC<Props> = ({ symbol, lastPrice, orders, onPlaceOrder, onCancelOrder }) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [qty, setQty] = useState('');
  const [percent, setPercent] = useState(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : symbol.slice(-3);
  const marketPrice = lastPrice ? parseFloat(lastPrice) : 0;
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'OPEN');
  const effectiveSide = orderType === 'stop' ? 'SELL' : side;
  const submitColor = effectiveSide === 'BUY' && orderType !== 'stop' ? '#00C896' : '#E5534B';

  const inputShellStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    minHeight: 42,
    background: '#0E1117',
    border: `1px solid ${focusedField === field ? '#00C896' : '#2E3650'}`,
    borderRadius: 8,
    color: '#E8EAF2',
    fontSize: 13,
    padding: '0 8px 0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontVariantNumeric: 'tabular-nums',
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    background: 'transparent',
    border: 0,
    outline: 'none',
    color: '#E8EAF2',
    fontSize: 13,
    fontVariantNumeric: 'tabular-nums',
  };

  const badgeStyle: React.CSSProperties = {
    background: '#1C2236',
    color: '#E8EAF2',
    fontSize: 12,
    borderRadius: 6,
    padding: '3px 8px',
    flexShrink: 0,
    fontWeight: 700,
  };

  const inputField = (field: string, value: string, onChange: (value: string) => void, placeholder: string, badge: string) => (
    <div style={inputShellStyle(field)}>
      <input
        type="number"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocusedField(field)}
        onBlur={() => setFocusedField(null)}
        placeholder={placeholder}
        style={inputStyle}
      />
      <span style={badgeStyle}>{badge}</span>
    </div>
  );

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
    setPercent(0);
  };

  return (
    <div style={{ padding: 18, fontSize: 13, overflowY: 'auto', height: '100%', background: '#161B27', borderRight: '1px solid #232A3E', color: '#E8EAF2' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          onClick={() => setSide('BUY')}
          disabled={orderType === 'stop'}
          style={{
            flex: 1,
            padding: '10px 0',
            background: side === 'BUY' && orderType !== 'stop' ? '#00C896' : '#1C2236',
            color: side === 'BUY' && orderType !== 'stop' ? '#0E1117' : '#6B7599',
            border: side === 'BUY' && orderType !== 'stop' ? '1px solid #00C896' : '1px solid #232A3E',
            borderRadius: 8,
            cursor: orderType === 'stop' ? 'not-allowed' : 'pointer',
            fontWeight: side === 'BUY' && orderType !== 'stop' ? 700 : 600,
            fontSize: 13,
          }}
        >
          BUY
        </button>
        <button
          onClick={() => setSide('SELL')}
          disabled={orderType === 'stop'}
          style={{
            flex: 1,
            padding: '10px 0',
            background: side === 'SELL' || orderType === 'stop' ? '#E5534B' : '#1C2236',
            color: side === 'SELL' || orderType === 'stop' ? '#fff' : '#6B7599',
            border: side === 'SELL' || orderType === 'stop' ? '1px solid #E5534B' : '1px solid #232A3E',
            borderRadius: 8,
            cursor: orderType === 'stop' ? 'not-allowed' : 'pointer',
            fontWeight: side === 'SELL' || orderType === 'stop' ? 700 : 600,
            fontSize: 13,
          }}
        >
          SELL
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Limit</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
          {ORDER_TYPES.map(ot => (
            <button
              key={ot.type}
              onClick={() => setOrderType(ot.type)}
              title={ot.desc}
              style={{
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 700,
                border: `1px solid ${orderType === ot.type ? '#00C896' : '#232A3E'}`,
                borderRadius: 8,
                cursor: 'pointer',
                background: orderType === ot.type ? 'rgba(0,200,150,0.12)' : '#1C2236',
                color: orderType === ot.type ? '#00C896' : '#6B7599',
              }}
            >
              {ot.label}
            </button>
          ))}
        </div>
      </div>

      {orderType === 'stop' && (
        <div style={{ padding: '9px 11px', marginBottom: 15, background: 'rgba(229,83,75,0.12)', border: '1px solid #E5534B', borderRadius: 8, fontSize: 12, color: '#E5534B', lineHeight: 1.4 }}>
          Stop-Loss automatically sells when price falls to the stop level.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {orderType === 'market' && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Limit</label>
            <div style={inputShellStyle('market-price')}>
              <span style={{ flex: 1, color: '#E8EAF2' }}>{marketPrice ? marketPrice.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}</span>
              <span style={badgeStyle}>{quoteAsset}</span>
            </div>
          </div>
        )}

        {orderType === 'limit' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Limit</label>
              {inputField('entry-price', price, setPrice, lastPrice || '0', quoteAsset)}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{side}</label>
              {inputField('trigger-price', triggerPrice, setTriggerPrice, side === 'BUY' ? 'Below current price' : 'Above current price', quoteAsset)}
            </div>
          </>
        )}

        {orderType === 'stop' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Limit</label>
              {inputField('current-entry', price, setPrice, lastPrice || '0', quoteAsset)}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Sell</label>
              {inputField('stop-price', triggerPrice, setTriggerPrice, 'Below current price', quoteAsset)}
            </div>
          </>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{effectiveSide === 'BUY' ? 'Buy' : 'Sell'}</label>
          {inputField('quantity', qty, setQty, '0.00', baseAsset)}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Pay</label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={percent}
            onChange={e => setPercent(parseInt(e.target.value, 10))}
            style={{
              width: '100%',
              height: 3,
              accentColor: '#00C896',
              cursor: 'pointer',
              background: `linear-gradient(to right, #00C896 0%, #00C896 ${percent}%, #232A3E ${percent}%, #232A3E 100%)`,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#6B7599', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
            {[0, 25, 50, 75, 100].map(mark => <span key={mark}>{mark}%</span>)}
          </div>
        </div>

        {orderType !== 'market' && triggerPrice && qty && (
          <div style={{ marginBottom: 16, padding: '10px 12px', background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.22)', borderRadius: 8, fontSize: 12, color: '#6B7599', lineHeight: 1.45 }}>
            <span style={{ color: '#00C896' }}>
              {orderType === 'limit'
                ? `Will ${side} ${qty} ${baseAsset} when price ${side === 'BUY' ? '≤' : '≥'} ${parseFloat(triggerPrice).toLocaleString()}`
                : `Will SELL ${qty} ${baseAsset} when price ≤ ${parseFloat(triggerPrice).toLocaleString()}`
              }
            </span>
            <br />
            <span>Checked every 30s by the server</span>
          </div>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: 13,
            background: submitColor,
            color: effectiveSide === 'BUY' && orderType !== 'stop' ? '#0E1117' : '#fff',
            border: 0,
            borderRadius: 10,
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {orderType === 'stop' ? 'Set Stop-Loss' : `${effectiveSide === 'BUY' ? 'Buy' : 'Sell'} ${baseAsset}`}
        </button>
      </form>

      {pendingOrders.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>
            Open Orders ({pendingOrders.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {pendingOrders.map(order => (
              <div key={order.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                alignItems: 'center',
                padding: '8px 10px',
                background: '#1C2236',
                borderRadius: 8,
                border: `1px solid ${order.status === 'PENDING' ? '#00C896' : '#232A3E'}`,
                fontSize: 11,
                gap: 6,
              }}>
                <div>
                  <span style={{ color: order.side === 'BUY' ? '#00C896' : '#E5534B', fontWeight: 700 }}>{order.side}</span>{' '}
                  <span style={{ color: '#6B7599' }}>{order.orderType}</span>
                </div>
                <div style={{ color: '#E8EAF2', fontVariantNumeric: 'tabular-nums' }}>
                  {order.triggerPrice
                    ? `@ ${order.triggerPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                    : `@ ${order.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                  }
                </div>
                <button
                  onClick={() => onCancelOrder(order.id)}
                  style={{ padding: '3px 7px', background: '#0E1117', border: '1px solid #232A3E', borderRadius: 5, color: '#6B7599', cursor: 'pointer', fontSize: 10 }}
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
