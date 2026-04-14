import React, { useState, useEffect } from 'react';
import { Wallet } from '../types';
import { apiHeaders } from '../hooks/useSession';

interface Props {
  sessionId: string;
  onDeposit: () => void;
}

const WalletBar: React.FC<Props> = ({ sessionId, onDeposit }) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const fetch_ = async () => {
    try {
      const r = await fetch('/api/wallet', { headers: { 'x-session-id': sessionId } });
      const w = await r.json();
      setWallet(w);
      setName(w.username);
    } catch {}
  };

  useEffect(() => { fetch_(); const id = setInterval(fetch_, 30000); return () => clearInterval(id); }, [sessionId]);

  const saveUsername = async () => {
    if (!name.trim()) return;
    try {
      const r = await fetch('/api/wallet/set-username', {
        method: 'POST',
        headers: apiHeaders(sessionId),
        body: JSON.stringify({ username: name.trim() }),
      });
      const w = await r.json();
      setWallet(w);
      setEditing(false);
    } catch {}
  };

  if (!wallet) return null;

  const winRate = wallet.tradesCount > 0 ? ((wallet.winsCount / wallet.tradesCount) * 100).toFixed(0) : '—';
  const pnlColor = wallet.pnlTotal >= 0 ? 'var(--accent)' : 'var(--danger)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '4px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, flexShrink: 0, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>👤</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
              maxLength={20}
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px', fontSize: 11, width: 110 }}
              autoFocus
            />
            <button onClick={saveUsername} style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#000', padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>✓</button>
            <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
          </div>
        ) : (
          <span
            onClick={() => setEditing(true)}
            style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', borderBottom: '1px dashed rgba(46,204,152,0.4)' }}
            title="Click to edit username"
          >
            {wallet.username}
          </span>
        )}
      </div>

      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Balance:</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>P&L:</span>
        <span style={{ color: pnlColor, fontWeight: 600 }}>
          {wallet.pnlTotal >= 0 ? '+' : ''}${wallet.pnlTotal.toFixed(2)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Trades:</span>
        <span style={{ color: 'var(--text-primary)' }}>{wallet.tradesCount}</span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Win%:</span>
        <span style={{ color: 'var(--text-primary)' }}>{winRate}%</span>
      </div>

      <div style={{ marginLeft: 'auto' }}>
        <button
          onClick={onDeposit}
          style={{
            background: 'linear-gradient(135deg, var(--accent), #22a878)',
            color: '#000', border: 'none', borderRadius: 6,
            padding: '4px 14px', cursor: 'pointer', fontSize: 11,
            fontWeight: 700, letterSpacing: '0.02em',
            boxShadow: '0 2px 8px rgba(46,204,152,0.3)',
          }}
        >
          + Fund Account
        </button>
      </div>
    </div>
  );
};

export default WalletBar;
