import React, { useState, useEffect } from 'react';
import { apiUrl } from '../lib/api';
import { LeaderboardEntry } from '../types';

interface Props {
  sessionId: string;
  onBack: () => void;
}

const LeaderboardPage: React.FC<Props> = ({ sessionId, onBack }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUsername, setMyUsername] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [lb, w] = await Promise.all([
          fetch(apiUrl('/api/leaderboard')).then(r => r.json()),
          fetch(apiUrl('/api/wallet'), { headers: { 'x-session-id': sessionId } }).then(r => r.json()),
        ]);
        setEntries(lb);
        setMyUsername(w.username);
      } catch {}
      setLoading(false);
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [sessionId]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>🏆 Leaderboard</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top paper traders ranked by total P&L</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading rankings…</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
          <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8 }}>Be the First!</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No traders on the board yet. Place some trades to claim the top spot.</div>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry, i) => {
              const isMe = entry.username === myUsername;
              const pnlColor = entry.pnlTotal >= 0 ? 'var(--accent)' : 'var(--danger)';
              return (
                <div
                  key={i}
                  style={{
                    background: isMe ? 'var(--accent-dim)' : 'var(--bg-panel)',
                    border: `1px solid ${isMe ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  <div style={{ fontSize: i < 3 ? 24 : 14, width: 32, textAlign: 'center', color: i >= 3 ? 'var(--text-muted)' : undefined, fontWeight: 700 }}>
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? 'var(--accent)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {entry.username}
                      {isMe && <span style={{ fontSize: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 8, padding: '1px 6px', color: 'var(--accent)' }}>You</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {entry.tradesCount} trades · {entry.winRate}% win rate
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: pnlColor }}>
                      {entry.pnlTotal >= 0 ? '+' : ''}${entry.pnlTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Balance: ${entry.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Leaderboard updates every 30 seconds · Paper trading only
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
