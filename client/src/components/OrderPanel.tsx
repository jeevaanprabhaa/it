import React, { useState, useEffect } from 'react';
import { Order, OrderType, Wallet } from '../types';
import { apiHeaders } from '../hooks/useSession';

interface Props {
  symbol: string;
  lastPrice?: string;
  orders: Order[];
  onPlaceOrder: (order: Order) => void;
  onCancelOrder: (id: string) => void;
  sessionId?: string;
  walletRefresh?: number;
  onDeposit?: () => void;
}

const ORDER_TYPES: { type: OrderType; label: string }[] = [
  { type: 'market', label: 'Market' },
  { type: 'limit',  label: 'Limit'  },
  { type: 'stop',   label: 'Stop'   },
];

const TokenChip: React.FC<{ symbol: string; color: string; sub?: string }> = ({ symbol, color, sub }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
    <span style={{
      width: 22, height: 22, borderRadius: '50%',
      background: color, color: '#fff', fontSize: 10, fontWeight: 800,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      letterSpacing: 0,
    }}>{symbol.slice(0, 1)}</span>
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#EAEEF7' }}>{symbol}</span>
      {sub && <span style={{ fontSize: 9.5, color: '#6B7494', marginTop: 2 }}>{sub}</span>}
    </div>
  </div>
);

const tokenColor = (s: string) => {
  if (s === 'BTC' || s === 'WBTC') return '#F7931A';
  if (s === 'ETH') return '#627EEA';
  if (s === 'USDT' || s === 'USDC' || s === 'DAI') return '#26A17B';
  if (s === 'SOL') return '#9945FF';
  if (s === 'BNB') return '#F3BA2F';
  return '#16C784';
};

const OrderPanel: React.FC<Props> = ({ symbol, lastPrice, orders, onPlaceOrder, onCancelOrder, sessionId, walletRefresh, onDeposit }) => {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [qty, setQty] = useState('');
  const [pay, setPay] = useState('');
  const [percent, setPercent] = useState(75);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : symbol.slice(-3);
  const marketPrice = lastPrice ? parseFloat(lastPrice) : 0;
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'OPEN');
  const effectiveSide = orderType === 'stop' ? 'SELL' : side;
  const isBuy = effectiveSide === 'BUY' && orderType !== 'stop';

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/wallet', { headers: { 'x-session-id': sessionId } });
        const w = await r.json();
        if (!cancelled) setWallet(w);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [sessionId, walletRefresh]);

  const balanceUSDT = wallet?.balance ?? 0;
  const pnlPct = wallet ? (wallet.balance > 0 ? ((wallet.pnlTotal / wallet.balance) * 100) : 0) : 0;

  const limitPrice = orderType === 'limit' && price ? parseFloat(price) : marketPrice;

  // Sync slider <-> pay/qty
  const setPercentAndAmounts = (pct: number) => {
    setPercent(pct);
    if (!balanceUSDT || !limitPrice) return;
    const usePay = (balanceUSDT * pct) / 100;
    setPay(usePay.toFixed(2));
    setQty((usePay / limitPrice).toFixed(6));
  };

  const onChangeQty = (v: string) => {
    setQty(v);
    const q = parseFloat(v) || 0;
    const p = q * (limitPrice || 0);
    setPay(p ? p.toFixed(2) : '');
    if (balanceUSDT) setPercent(Math.min(100, Math.round((p / balanceUSDT) * 100)));
  };

  const onChangePay = (v: string) => {
    setPay(v);
    const p = parseFloat(v) || 0;
    const q = limitPrice ? p / limitPrice : 0;
    setQty(q ? q.toFixed(6) : '');
    if (balanceUSDT) setPercent(Math.min(100, Math.round((p / balanceUSDT) * 100)));
  };

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
    setPay('');
    setPercent(0);
  };

  // ── Inputs ──
  const Card: React.FC<{ label?: string; children: React.ReactNode; sub?: React.ReactNode }> = ({ label, children, sub }) => (
    <div style={{
      background: '#0F1525',
      border: '1px solid #1A2238',
      borderRadius: 12,
      padding: '10px 12px',
      marginBottom: 10,
    }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ color: '#6B7494', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
          {sub && <span style={{ color: '#6B7494', fontSize: 10 }}>{sub}</span>}
        </div>
      )}
      {children}
    </div>
  );

  const NumInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; right?: React.ReactNode; big?: boolean; subValue?: string }> = ({ value, onChange, placeholder, right, big, subValue }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <input
          type="number"
          step="any"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0.00'}
          style={{
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: '#EAEEF7',
            fontSize: big ? 22 : 18,
            fontWeight: big ? 700 : 600,
            fontVariantNumeric: 'tabular-nums',
            width: '100%',
            padding: 0,
          }}
        />
        {subValue && <span style={{ fontSize: 10.5, color: '#6B7494', marginTop: 2 }}>$ {subValue}</span>}
      </div>
      {right}
    </div>
  );

  const buttonColor = isBuy ? '#16C784' : '#F0616D';

  return (
    <div style={{ padding: 14, fontSize: 13, overflowY: 'auto', height: '100%', background: '#070A12', color: '#EAEEF7' }}>
      {/* BUY / SELL underline tabs */}
      <div style={{
        background: '#0F1525',
        border: '1px solid #1A2238',
        borderRadius: 12,
        padding: 4,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 4,
        marginBottom: 12,
      }}>
        <button
          onClick={() => setSide('BUY')}
          disabled={orderType === 'stop'}
          style={{
            padding: '11px 0',
            background: side === 'BUY' && orderType !== 'stop' ? '#FFFFFF' : 'transparent',
            color: side === 'BUY' && orderType !== 'stop' ? '#070A12' : '#6B7494',
            border: 0,
            borderRadius: 9,
            cursor: orderType === 'stop' ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.04em',
          }}
        >BUY</button>
        <button
          onClick={() => setSide('SELL')}
          disabled={orderType === 'stop'}
          style={{
            padding: '11px 0',
            background: side === 'SELL' || orderType === 'stop' ? '#1A2238' : 'transparent',
            color: side === 'SELL' || orderType === 'stop' ? '#EAEEF7' : '#6B7494',
            border: 0,
            borderRadius: 9,
            cursor: orderType === 'stop' ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.04em',
          }}
        >SELL</button>
      </div>

      {/* Order type chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {ORDER_TYPES.map(ot => (
          <button
            key={ot.type}
            onClick={() => setOrderType(ot.type)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: 11.5,
              fontWeight: 700,
              border: `1px solid ${orderType === ot.type ? '#243049' : '#1A2238'}`,
              borderRadius: 8,
              cursor: 'pointer',
              background: orderType === ot.type ? '#1A2238' : 'transparent',
              color: orderType === ot.type ? '#EAEEF7' : '#6B7494',
            }}
          >{ot.label}</button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* LIMIT card */}
        <Card label={orderType === 'stop' ? 'Stop' : 'Limit'}>
          {orderType === 'market' ? (
            <NumInput
              value={marketPrice ? marketPrice.toFixed(2) : ''}
              onChange={() => {}}
              right={<TokenChip symbol={quoteAsset} color={tokenColor(quoteAsset)} />}
              big
              subValue={`Market Price ${marketPrice ? marketPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}`}
            />
          ) : (
            <NumInput
              value={price}
              onChange={setPrice}
              placeholder={marketPrice ? marketPrice.toFixed(2) : '0.00'}
              right={<TokenChip symbol={quoteAsset} color={tokenColor(quoteAsset)} />}
              big
              subValue={`Market Price ${marketPrice ? marketPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}`}
            />
          )}
          {orderType === 'stop' && (
            <div style={{ marginTop: 8 }}>
              <NumInput value={triggerPrice} onChange={setTriggerPrice} placeholder="Trigger price" right={<TokenChip symbol={quoteAsset} color={tokenColor(quoteAsset)} />} />
            </div>
          )}
        </Card>

        {/* BUY amount card */}
        <Card label={isBuy ? 'BUY' : 'SELL'}>
          <NumInput
            value={qty}
            onChange={onChangeQty}
            placeholder="0.00"
            right={<TokenChip symbol={baseAsset} color={tokenColor(baseAsset)} sub={`on ${baseAsset === 'BTC' ? 'Bitcoin' : 'Network'}`} />}
            subValue={pay || '0.00'}
          />
        </Card>

        {/* PAY card */}
        <Card label="PAY">
          <NumInput
            value={pay}
            onChange={onChangePay}
            placeholder="0.00"
            right={<TokenChip symbol={quoteAsset} color={tokenColor(quoteAsset)} sub="on Holesky" />}
            subValue={pay || '0.00'}
          />
          {/* Slider */}
          <div style={{ marginTop: 14 }}>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={percent}
              onChange={e => setPercentAndAmounts(parseInt(e.target.value, 10))}
              style={{
                width: '100%',
                height: 4,
                appearance: 'none',
                outline: 'none',
                background: `linear-gradient(to right, #16C784 0%, #16C784 ${percent}%, #1A2238 ${percent}%, #1A2238 100%)`,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#6B7494', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
              {[0, 25, 50, 75, 100].map(mark => (
                <button
                  key={mark}
                  type="button"
                  onClick={() => setPercentAndAmounts(mark)}
                  style={{ background: 'transparent', border: 0, color: percent === mark ? '#16C784' : '#6B7494', fontSize: 10, cursor: 'pointer', padding: 0, fontWeight: 600 }}
                >{mark}%</button>
              ))}
            </div>
          </div>
        </Card>

        {/* Balance row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 12px', background: '#0F1525', border: '1px solid #1A2238',
          borderRadius: 12, marginBottom: 14, fontSize: 12,
        }}>
          <span style={{ color: '#6B7494', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#1A2238', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>$</span>
            Balance
          </span>
          <span style={{ color: '#EAEEF7', fontWeight: 700, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
            {balanceUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <span style={{ color: '#16C784', fontSize: 10 }}>↻</span>
          </span>
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            padding: 14,
            background: buttonColor,
            color: isBuy ? '#03110A' : '#fff',
            border: 0,
            borderRadius: 12,
            fontWeight: 800,
            cursor: 'pointer',
            fontSize: 14,
            letterSpacing: '0.02em',
            boxShadow: isBuy ? '0 8px 24px rgba(22,199,132,0.25)' : '0 8px 24px rgba(240,97,109,0.25)',
          }}
        >
          {isBuy ? `Buy ${baseAsset}` : `Sell ${baseAsset}`}
        </button>
      </form>

      {/* Portfolio card */}
      <div style={{
        marginTop: 14,
        background: 'linear-gradient(180deg, #0F1525 0%, #0B1120 100%)',
        border: '1px solid #1A2238',
        borderRadius: 14,
        padding: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#1A2238', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#16C784' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 7h18v12H3z M7 7V5h10v2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 10, color: '#6B7494', letterSpacing: '0.06em', fontWeight: 700 }}>PORTFOLIO</span>
              <span style={{ fontSize: 9, color: '#6B7494' }}>● ●</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#EAEEF7', fontVariantNumeric: 'tabular-nums' }}>
            {balanceUSDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: 11, color: '#6B7494' }}>USD</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <button onClick={onDeposit} style={{ padding: '8px 0', background: '#131A2B', border: '1px solid #243049', borderRadius: 10, color: '#EAEEF7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Withdraw</button>
          <button onClick={onDeposit} style={{ padding: '8px 0', background: '#131A2B', border: '1px solid #243049', borderRadius: 10, color: '#EAEEF7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Deposit</button>
        </div>

        {/* Mini sparkline */}
        <svg viewBox="0 0 200 50" width="100%" height="50" preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="pnlg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16C784" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#16C784" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,38 L20,32 L40,34 L60,28 L80,30 L100,22 L120,18 L140,24 L160,14 L180,16 L200,8 L200,50 L0,50 Z" fill="url(#pnlg)" />
          <path d="M0,38 L20,32 L40,34 L60,28 L80,30 L100,22 L120,18 L140,24 L160,14 L180,16 L200,8" fill="none" stroke="#16C784" strokeWidth="1.5" />
          <circle cx="100" cy="22" r="2.6" fill="#16C784" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#6B7494', marginTop: 6 }}>
          <span>6 Aug</span><span>16 Aug</span><span>26 Aug</span><span>6 Sep</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#6B7494', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6B7494' }}>PNL:</span>
          <span style={{ color: pnlPct >= 0 ? '#16C784' : '#F0616D', fontWeight: 700 }}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Assets header */}
      <div style={{
        marginTop: 14,
        padding: '12px 14px',
        background: '#0F1525',
        border: '1px solid #1A2238',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: '#6B7494', fontWeight: 700, letterSpacing: '0.06em' }}>ASSETS</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#6B7494" strokeWidth="2"/><path d="M20 20l-4-4" stroke="#6B7494" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>

      {pendingOrders.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ color: '#6B7494', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
            Open Orders ({pendingOrders.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {pendingOrders.map(order => (
              <div key={order.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                alignItems: 'center',
                padding: '8px 10px',
                background: '#0F1525',
                borderRadius: 10,
                border: `1px solid ${order.status === 'PENDING' ? '#16C784' : '#1A2238'}`,
                fontSize: 11,
                gap: 6,
              }}>
                <div>
                  <span style={{ color: order.side === 'BUY' ? '#16C784' : '#F0616D', fontWeight: 700 }}>{order.side}</span>{' '}
                  <span style={{ color: '#6B7494' }}>{order.orderType}</span>
                </div>
                <div style={{ color: '#EAEEF7', fontVariantNumeric: 'tabular-nums' }}>
                  @ {(order.triggerPrice ?? order.price).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                <button
                  onClick={() => onCancelOrder(order.id)}
                  style={{ padding: '3px 7px', background: '#070A12', border: '1px solid #1A2238', borderRadius: 5, color: '#6B7494', cursor: 'pointer', fontSize: 10 }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderPanel;
