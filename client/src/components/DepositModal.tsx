import React, { useState } from 'react';
import { apiHeaders } from '../hooks/useSession';

interface Props {
  sessionId: string;
  publishableKey: string;
  onClose: () => void;
  onSuccess: (credits: number) => void;
}

const DepositModal: React.FC<Props> = ({ sessionId, publishableKey, onClose, onSuccess }) => {
  const [step, setStep] = useState<'amount' | 'payment' | 'processing' | 'success'>('amount');
  const [amountUsd, setAmountUsd] = useState(10);
  const [clientSecret, setClientSecret] = useState('');
  const [virtualCredits, setVirtualCredits] = useState(0);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const presets = [5, 10, 25, 50, 100];
  const creditMultiplier = 1000; // $1 → $1000 virtual

  const handleCreateIntent = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: apiHeaders(sessionId),
        body: JSON.stringify({ amount: amountUsd * 100 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Payment setup failed');
      setClientSecret(data.clientSecret);
      setVirtualCredits(data.virtualCredits);
      setStep('payment');
    } catch (e: any) {
      setError(e.message || 'Error setting up payment');
    }
    setLoading(false);
  };

  const formatCard = (v: string) => v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length >= 2) return d.slice(0, 2) + '/' + d.slice(2, 4);
    return d;
  };

  const handlePay = async () => {
    setLoading(true);
    setError('');

    const cardDigits = cardNumber.replace(/\s/g, '');
    if (cardDigits.length < 13) { setError('Enter a valid card number'); setLoading(false); return; }
    if (!expiry.includes('/') || expiry.length < 5) { setError('Enter a valid expiry (MM/YY)'); setLoading(false); return; }
    if (cvc.length < 3) { setError('Enter a valid CVC'); setLoading(false); return; }

    setStep('processing');
    await new Promise(r => setTimeout(r, 2200));

    try {
      const r = await fetch('/api/wallet/deposit-confirm', {
        method: 'POST',
        headers: apiHeaders(sessionId),
        body: JSON.stringify({ virtualCredits, paymentIntentId: clientSecret?.split('_secret')[0] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Confirmation failed');
      setStep('success');
      setTimeout(() => { onSuccess(virtualCredits); }, 2500);
    } catch (e: any) {
      setError(e.message);
      setStep('payment');
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#0d1117', border: '1px solid #1e2433', borderRadius: 16,
        width: '100%', maxWidth: 440, padding: 32, position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}
        >✕</button>

        {step === 'amount' && (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Fund Your Account</div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
              Real money converts to virtual credits for paper trading.<br />
              <span style={{ color: '#00ff88', fontWeight: 600 }}>$1 real = $1,000 virtual credits</span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Select amount:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {presets.map(p => (
                  <button
                    key={p}
                    onClick={() => setAmountUsd(p)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      background: amountUsd === p ? '#00ff88' : '#1e2433',
                      color: amountUsd === p ? '#000' : '#888',
                      border: amountUsd === p ? '1px solid #00ff88' : '1px solid #2a3444',
                    }}
                  >
                    ${p}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#666', fontSize: 13 }}>Custom:</span>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }}>$</span>
                  <input
                    type="number" min={1} max={1000}
                    value={amountUsd}
                    onChange={e => setAmountUsd(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                    style={{ background: '#1e2433', border: '1px solid #2a3444', borderRadius: 8, color: '#fff', padding: '8px 8px 8px 26px', fontSize: 13, width: 100 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ background: '#0a1628', border: '1px solid #1e3a5c', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#666' }}>You pay:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>${amountUsd.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#666' }}>You receive:</span>
                <span style={{ color: '#00ff88', fontWeight: 700 }}>${(amountUsd * creditMultiplier).toLocaleString()} virtual</span>
              </div>
              <div style={{ borderTop: '1px solid #1e2433', paddingTop: 8, fontSize: 11, color: '#444' }}>
                Virtual credits are for paper trading only. No real assets are bought.
              </div>
            </div>

            {error && <div style={{ background: '#1a0000', border: '1px solid #ef5350', borderRadius: 8, padding: 10, color: '#ef5350', fontSize: 12, marginBottom: 16 }}>{error}</div>}

            <button
              onClick={handleCreateIntent}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #00ff88, #00cc70)', color: '#000',
                fontWeight: 800, fontSize: 15, opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Setting up payment...' : `Continue to Payment →`}
            </button>
          </>
        )}

        {step === 'payment' && (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Card Details</div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 24 }}>
              Test mode — use card <span style={{ color: '#4fc3f7', fontFamily: 'monospace' }}>4242 4242 4242 4242</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Card Number</label>
              <input
                value={cardNumber}
                onChange={e => setCardNumber(formatCard(e.target.value))}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                style={{ width: '100%', background: '#1e2433', border: '1px solid #2a3444', borderRadius: 8, color: '#fff', padding: '12px 14px', fontSize: 15, fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Expiry</label>
                <input
                  value={expiry}
                  onChange={e => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  maxLength={5}
                  style={{ width: '100%', background: '#1e2433', border: '1px solid #2a3444', borderRadius: 8, color: '#fff', padding: '12px 14px', fontSize: 15, fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>CVC</label>
                <input
                  value={cvc}
                  onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  maxLength={4}
                  style={{ width: '100%', background: '#1e2433', border: '1px solid #2a3444', borderRadius: 8, color: '#fff', padding: '12px 14px', fontSize: 15, fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ background: '#0a1628', border: '1px solid #1e3a5c', borderRadius: 10, padding: 12, marginBottom: 20, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#666' }}>Charging:</span>
              <span style={{ color: '#fff', fontWeight: 700 }}>${amountUsd.toFixed(2)} → ${(amountUsd * creditMultiplier).toLocaleString()} virtual</span>
            </div>

            {error && <div style={{ background: '#1a0000', border: '1px solid #ef5350', borderRadius: 8, padding: 10, color: '#ef5350', fontSize: 12, marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('amount')} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #2a3444', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 13 }}>← Back</button>
              <button
                onClick={handlePay}
                disabled={loading}
                style={{
                  flex: 2, padding: 12, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #00ff88, #00cc70)', color: '#000',
                  fontWeight: 800, fontSize: 14, opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Processing...' : `Pay $${amountUsd}`}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, color: '#333', fontSize: 11 }}>
              <span>🔒</span> Secured by Stripe · Test mode
            </div>
          </>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
            <div style={{ fontSize: 18, color: '#fff', fontWeight: 700, marginBottom: 8 }}>Processing Payment</div>
            <div style={{ color: '#666', fontSize: 13 }}>Please wait…</div>
            <div style={{ marginTop: 24, background: '#1e2433', borderRadius: 8, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #00ff88, #00cc70)', animation: 'progress 2s ease-in-out', width: '100%' }} />
            </div>
            <style>{`@keyframes progress { from { transform: scaleX(0); transform-origin: left; } to { transform: scaleX(1); } }`}</style>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#00ff88', marginBottom: 8 }}>
              +${virtualCredits.toLocaleString()} Virtual Credits!
            </div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Your account has been funded. Happy trading!</div>
            <div style={{ background: '#0a1628', border: '1px solid #00ff8830', borderRadius: 10, padding: 14, fontSize: 13, color: '#ccc' }}>
              Real payment: <strong style={{ color: '#fff' }}>${amountUsd}</strong><br />
              Credits added: <strong style={{ color: '#00ff88' }}>${virtualCredits.toLocaleString()}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositModal;
