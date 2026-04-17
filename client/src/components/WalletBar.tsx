import React, { useState, useEffect } from 'react';
import { Wallet } from '../types';
import { apiHeaders } from '../hooks/useSession';

interface Props {
  sessionId: string;
  onDeposit: () => void;
  activeSection?: 'trade' | 'dashboard';
  onNavigateTrade?: () => void;
  onNavigateDashboard?: () => void;
}

const WalletBar: React.FC<Props> = ({
  sessionId,
  onDeposit,
  activeSection = 'trade',
  onNavigateTrade,
  onNavigateDashboard,
}) => {
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

  const navButtonStyle = (active: boolean): React.CSSProperties => ({
    height: '100%',
    padding: '0 16px',
    border: 0,
    borderBottom: active ? '2px solid #00C896' : '2px solid transparent',
    background: 'transparent',
    color: active ? '#E8EAF2' : '#6B7599',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    letterSpacing: '0.01em',
  });

  const iconButtonStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    background: '#1C2236',
    border: '1px solid #232A3E',
    borderRadius: 8,
    color: '#6B7599',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };

  if (!wallet) return null;

  const winRate = wallet.tradesCount > 0 ? ((wallet.winsCount / wallet.tradesCount) * 100).toFixed(0) : '—';
  const pnlColor = wallet.pnlTotal >= 0 ? '#00C896' : '#E5534B';

  return (
    <div style={{ height: 58, display: 'flex', alignItems: 'center', background: '#0E1117', borderBottom: '1px solid #232A3E', flexShrink: 0, padding: '0 14px', gap: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 184 }}>
        <svg width="30" height="30" viewBox="0 0 30 30" role="img" aria-label="AlgoTrader mark" style={{ flexShrink: 0 }}>
          <path d="M7 8 L22 8 L9 22 L24 22" fill="none" stroke="#00C896" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 8 L20 4 M22 8 L26 7" fill="none" stroke="#00C896" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ color: '#E8EAF2', fontWeight: 700, fontSize: 15, letterSpacing: '0.05em' }}>AlgoTrader</span>
          <span style={{ color: '#6B7599', fontSize: 9, marginTop: 4, letterSpacing: '0.04em' }}>by Zellular</span>
        </div>
      </div>

      <nav style={{ height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <button onClick={onNavigateTrade} style={navButtonStyle(activeSection === 'trade')}>Trade</button>
        <button onClick={onNavigateDashboard} style={navButtonStyle(activeSection === 'dashboard')}>Dashboard</button>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, overflow: 'hidden', fontSize: 12 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUsername()}
                maxLength={20}
                style={{ background: '#1C2236', border: '1px solid #00C896', borderRadius: 6, color: '#E8EAF2', padding: '5px 8px', fontSize: 12, width: 118 }}
                autoFocus
              />
              <button onClick={saveUsername} style={{ background: '#00C896', border: 0, borderRadius: 6, color: '#0E1117', padding: '0 9px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓</button>
              <button onClick={() => setEditing(false)} style={{ background: '#1C2236', border: '1px solid #232A3E', borderRadius: 6, color: '#6B7599', padding: '0 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              title="Click to edit username"
              style={{ background: 'transparent', border: 0, color: '#00C896', fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: 0, whiteSpace: 'nowrap' }}
            >
              {wallet.username}
            </button>
          )}
          <span style={{ color: '#6B7599', whiteSpace: 'nowrap' }}>Balance <strong style={{ color: '#E8EAF2', fontWeight: 700 }}>${wallet.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></span>
          <span style={{ color: '#6B7599', whiteSpace: 'nowrap' }}>P&amp;L <strong style={{ color: pnlColor, fontWeight: 700 }}>{wallet.pnlTotal >= 0 ? '+' : ''}${wallet.pnlTotal.toFixed(2)}</strong></span>
          <span style={{ color: '#6B7599', whiteSpace: 'nowrap' }}>Trades <strong style={{ color: '#E8EAF2', fontWeight: 700 }}>{wallet.tradesCount}</strong></span>
          <span style={{ color: '#6B7599', whiteSpace: 'nowrap' }}>Win <strong style={{ color: '#E8EAF2', fontWeight: 700 }}>{winRate}%</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button style={iconButtonStyle} aria-label="Settings">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </button>
          <button style={iconButtonStyle} aria-label="Notifications">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.7 20a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={onDeposit}
            style={{ background: '#00C896', color: '#0E1117', border: 0, borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletBar;
