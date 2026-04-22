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
    height: 38,
    padding: '0 18px',
    border: 0,
    borderRadius: 10,
    background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
    color: active ? '#FFFFFF' : '#6B7494',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 700 : 600,
    letterSpacing: '0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  });

  const iconButtonStyle: React.CSSProperties = {
    width: 38,
    height: 38,
    background: 'transparent',
    border: '1px solid #1A2238',
    borderRadius: 10,
    color: '#8C95B5',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    position: 'relative',
  };

  if (!wallet) return null;

  return (
    <div style={{
      height: 64,
      display: 'flex',
      alignItems: 'center',
      background: 'linear-gradient(180deg, #0A0F1C 0%, #070A12 100%)',
      borderBottom: '1px solid #131A2B',
      flexShrink: 0,
      padding: '0 22px',
      gap: 22,
      overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 188 }}>
        <svg width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="ZEX mark" style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="zexg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1FE39A" />
              <stop offset="100%" stopColor="#16C784" />
            </linearGradient>
          </defs>
          <path d="M7 8 L24 8 L9 24 L25 24" fill="none" stroke="url(#zexg)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 18, letterSpacing: '0.06em' }}>ZEX</span>
          <span style={{ color: '#6B7494', fontSize: 9, marginTop: 4, letterSpacing: '0.08em' }}>by Zellular</span>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button onClick={onNavigateTrade} style={navButtonStyle(activeSection === 'trade')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 17 L9 11 L13 15 L21 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 6 L21 6 L21 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Trade
        </button>
        <button onClick={onNavigateDashboard} style={navButtonStyle(activeSection === 'dashboard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
          </svg>
          Dashboard
        </button>
      </nav>

      <div style={{ flex: 1 }} />

      {/* Username compact */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, flexShrink: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
              maxLength={20}
              style={{ background: '#131A2B', border: '1px solid #16C784', borderRadius: 8, color: '#EAEEF7', padding: '6px 10px', fontSize: 12, width: 132 }}
              autoFocus
            />
            <button onClick={saveUsername} style={{ background: '#16C784', border: 0, borderRadius: 8, color: '#070A12', padding: '0 11px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✓</button>
            <button onClick={() => setEditing(false)} style={{ background: '#131A2B', border: '1px solid #1A2238', borderRadius: 8, color: '#6B7494', padding: '0 9px', cursor: 'pointer', fontSize: 11 }}>✕</button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to edit username"
            style={{ background: 'transparent', border: 0, color: '#8C95B5', cursor: 'pointer', fontSize: 12, padding: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16C784', display: 'inline-block' }} />
            {wallet.username}
          </button>
        )}
      </div>

      {/* Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button style={iconButtonStyle} aria-label="Support">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 14a7 7 0 0 1 14 0v3a2 2 0 0 1-2 2h-1v-6h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 14h-3v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 14h3v6H7a2 2 0 0 1-2-2v-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button style={iconButtonStyle} aria-label="Settings">
          <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#F0616D' }} />
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={onDeposit}
          style={{
            background: 'linear-gradient(180deg, #1B2542 0%, #131A2B 100%)',
            color: '#FFFFFF',
            border: '1px solid #2A3C68',
            borderRadius: 10,
            padding: '9px 22px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );
};

export default WalletBar;
