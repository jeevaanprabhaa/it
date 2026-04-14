import React, { useState, useEffect } from 'react';
import { CoachAnalysis, RiskDna } from '../types';

interface Props {
  sessionId: string;
  onBack: () => void;
}

const RadarChart: React.FC<{ dna: RiskDna }> = ({ dna }) => {
  const dims = [
    { key: 'discipline', label: 'Discipline' },
    { key: 'emotionalControl', label: 'Emotion Control' },
    { key: 'consistency', label: 'Consistency' },
    { key: 'riskReward', label: 'Risk/Reward' },
    { key: 'aggressiveness', label: 'Aggressiveness' },
  ] as const;

  const N = dims.length;
  const cx = 120, cy = 120, r = 90;
  const angles = dims.map((_, i) => (i / N) * 2 * Math.PI - Math.PI / 2);

  const getPoint = (angle: number, value: number) => ({
    x: cx + (value / 100) * r * Math.cos(angle),
    y: cy + (value / 100) * r * Math.sin(angle),
  });

  const dataPoints = dims.map((d, i) => getPoint(angles[i], dna[d.key]));
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Risk DNA Profile</div>
      <svg width={240} height={240} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
        {[0.2, 0.4, 0.6, 0.8, 1.0].map(scale => (
          <polygon
            key={scale}
            points={angles.map(a => getPoint(a, scale * 100)).map(p => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="var(--border)" strokeWidth={1}
          />
        ))}
        {angles.map((a, i) => {
          const outer = getPoint(a, 100);
          return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="var(--border)" strokeWidth={1} />;
        })}
        <polygon points={polygon} fill="rgba(46,204,152,0.15)" stroke="var(--accent)" strokeWidth={2} />
        {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />)}
        {dims.map((d, i) => {
          const angle = angles[i];
          const labelR = r + 22;
          const lx = cx + labelR * Math.cos(angle);
          const ly = cy + labelR * Math.sin(angle);
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="var(--text-muted)">
              {d.label}
            </text>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {dims.map(d => (
          <div key={d.key} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: dna[d.key] >= 70 ? 'var(--accent)' : dna[d.key] >= 40 ? '#ff9800' : 'var(--danger)' }}>
              {dna[d.key]}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const R = 54, C = 2 * Math.PI * R;
  const dash = (score / 100) * C;
  const color = score >= 70 ? 'var(--accent)' : score >= 45 ? '#ff9800' : 'var(--danger)';
  const hexColor = score >= 70 ? '#2ECC98' : score >= 45 ? '#ff9800' : '#E5534B';
  const label = score >= 70 ? 'Elite Trader' : score >= 55 ? 'Developing' : score >= 40 ? 'Learning' : 'Needs Work';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Trader Score</div>
      <div style={{ position: 'relative', width: 130, height: 130 }}>
        <svg width={130} height={130} viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={65} cy={65} r={R} fill="none" stroke="var(--border)" strokeWidth={10} />
          <circle cx={65} cy={65} r={R} fill="none" stroke={hexColor} strokeWidth={10}
            strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color }}>{score}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>/100</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color, fontWeight: 700 }}>{label}</div>
    </div>
  );
};

const AICoachPage: React.FC<Props> = ({ sessionId, onBack }) => {
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/coach', { headers: { 'x-session-id': sessionId } });
      setAnalysis(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [sessionId]);

  const insightColors = {
    success: { bg: 'rgba(46,204,152,0.06)', border: 'rgba(46,204,152,0.25)', text: 'var(--accent)' },
    warning: { bg: 'rgba(255,152,0,0.06)', border: 'rgba(255,152,0,0.25)', text: '#ff9800' },
    danger:  { bg: 'rgba(229,83,75,0.06)',  border: 'rgba(229,83,75,0.25)',  text: 'var(--danger)' },
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>🤖 AI Trade Coach</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Behavioral finance analysis of your trading patterns</div>
        </div>
        <button onClick={refresh} style={{ marginLeft: 'auto', background: 'var(--bg-hover)', border: 'none', borderRadius: 6, color: 'var(--text-muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 11 }}>↻ Refresh</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 16, flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 32 }}>🧠</div>
          <div>Analyzing your trading patterns…</div>
        </div>
      ) : !analysis || analysis.stats?.trades === 0 ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Start Trading to Unlock Insights</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Place at least one trade and fill in the journal. Your AI coach will analyze your behavioral patterns.</div>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', justifyContent: 'center' }}>
              <ScoreRing score={analysis.score} />
            </div>
            {analysis.riskDna && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', justifyContent: 'center' }}>
                <RadarChart dna={analysis.riskDna} />
              </div>
            )}
            {analysis.stats && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stats Summary</div>
                {[
                  { label: 'Total Trades', val: analysis.stats.trades, color: 'var(--text-primary)' },
                  { label: 'Win Rate', val: `${(analysis.stats.winRate * 100).toFixed(0)}%`, color: analysis.stats.winRate >= 0.5 ? 'var(--accent)' : '#ff9800' },
                  { label: 'Avg Win', val: `+$${analysis.stats.avgWin.toFixed(2)}`, color: 'var(--accent)' },
                  { label: 'Avg Loss', val: `-$${analysis.stats.avgLoss.toFixed(2)}`, color: 'var(--danger)' },
                  { label: 'Risk/Reward', val: `${analysis.stats.rr.toFixed(2)}:1`, color: analysis.stats.rr >= 1.5 ? 'var(--accent)' : '#ff9800' },
                  { label: 'Total P&L', val: `${analysis.stats.totalPnl >= 0 ? '+' : ''}$${analysis.stats.totalPnl.toFixed(2)}`, color: analysis.stats.totalPnl >= 0 ? 'var(--accent)' : 'var(--danger)' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontWeight: 700, color: row.color }}>{row.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {analysis.badges.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Badges</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {analysis.badges.map(badge => (
                  <div key={badge.id} style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'default',
                  }} title={badge.desc}>
                    <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{badge.label}</span>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{badge.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.insights.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coach Insights</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analysis.insights.map((ins, i) => {
                  const c = insightColors[ins.type];
                  return (
                    <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, lineHeight: 1.6 }}>
                      <span style={{ color: c.text, fontWeight: 600, marginRight: 6 }}>
                        {ins.type === 'success' ? '✅' : ins.type === 'warning' ? '⚠️' : '🚨'}
                      </span>
                      <span style={{ color: 'var(--text-primary)' }}>{ins.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AICoachPage;
