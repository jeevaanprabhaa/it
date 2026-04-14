import React, { useState, useEffect } from 'react';
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
          fetch('/api/leaderboard').then(r => r.json()),
          fetch('/api/wallet', { headers: { 'x-session-id': sessionId } }).then(r => r.json()),
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
    <div style={{ height: '100%', overflow: 'auto', background: '#080c14', color: '#e0e0e0' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2433', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #1e2433', borderRadius: 6, color: '#888', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>🏆 Leaderboard</div>
          <div style={{ fontSize: 12, color: '#555' }}>Top paper traders ranked by total P&L</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>Loading rankings…</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
          <div style={{ fontSize: 16, color: '#fff', fontWeight: 700, marginBottom: 8 }}>Be the First!</div>
          <div style={{ color: '#555', fontSize: 13 }}>No traders on the board yet. Place some trades to claim the top spot.</div>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map((entry, i) => {
              const isMe = entry.username === myUsername;
              const pnlColor = entry.pnlTotal >= 0 ? '#00ff88' : '#ef5350';
              return (
                <div
                  key={i}
                  style={{
                    background: isMe ? '#0a1e14' : '#0d1117',
                    border: `1px solid ${isMe ? '#00ff8840' : '#1e2433'}`,
                    borderRadius: 12, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  <div style={{ fontSize: i < 3 ? 24 : 14, width: 32, textAlign: 'center', color: i >= 3 ? '#444' : undefined, fontWeight: 700 }}>
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? '#00ff88' : '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {entry.username}
                      {isMe && <span style={{ fontSize: 10, background: '#00ff8820', border: '1px solid #00ff8840', borderRadius: 8, padding: '1px 6px', color: '#00ff88' }}>You</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                      {entry.tradesCount} trades · {entry.winRate}% win rate
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: pnlColor }}>
                      {entry.pnlTotal >= 0 ? '+' : ''}${entry.pnlTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11, color: '#444' }}>
                      Balance: ${entry.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, padding: '12px 16px', background: '#0d1117', border: '1px solid #1e2433', borderRadius: 10, fontSize: 12, color: '#444', textAlign: 'center' }}>
            Leaderboard updates every 30 seconds · Paper trading only
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
