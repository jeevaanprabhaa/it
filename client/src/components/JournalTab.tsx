import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { JournalEntry, Analytics, Emotion } from '../types';

const EMOTION_COLORS: Record<string, string> = {
  confident: '#26a69a',
  fearful: '#ef5350',
  fomo: '#ff9800',
  neutral: '#78909c',
  greedy: '#ab47bc',
};

const EMOTION_LABELS: Record<string, string> = {
  confident: 'Confident',
  fearful: 'Fearful',
  fomo: 'FOMO',
  neutral: 'Neutral',
  greedy: 'Greedy',
};

const MC_COLORS: Record<string, string> = {
  trending: '#4fc3f7',
  ranging: '#ffb74d',
  volatile: '#ef9a9a',
};

type SubPage = 'timeline' | 'psychology';

const JournalTab: React.FC = () => {
  const [subPage, setSubPage] = useState<SubPage>('timeline');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [entriesRes, analyticsRes] = await Promise.all([
        fetch('/api/journal'),
        fetch('/api/journal/analytics'),
      ]);
      const entriesData = await entriesRes.json();
      const analyticsData = await analyticsRes.json();
      setEntries(entriesData);
      setAnalytics(analyticsData);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (subPage === 'psychology') loadData();
  }, [subPage, loadData]);

  const insightBest = analytics
    ? Object.entries(analytics.win_rate_by_emotion)
        .filter(([, v]) => v !== null)
        .sort((a, b) => (b[1] as number) - (a[1] as number))[0]
    : null;

  const insightWorst = analytics
    ? Object.entries(analytics.win_rate_by_emotion)
        .filter(([, v]) => v !== null)
        .sort((a, b) => (a[1] as number) - (b[1] as number))[0]
    : null;

  const winRateChartData = analytics
    ? Object.entries(analytics.win_rate_by_emotion)
        .filter(([, v]) => v !== null)
        .map(([em, v]) => ({ emotion: EMOTION_LABELS[em] || em, win_rate: Math.round((v as number) * 100), key: em }))
    : [];

  const avgPnlChartData = analytics
    ? Object.entries(analytics.avg_pnl_by_emotion)
        .filter(([, v]) => v !== null)
        .map(([em, v]) => ({ emotion: EMOTION_LABELS[em] || em, avg_pnl: v as number, key: em }))
    : [];

  const tabBtn = (t: SubPage, label: string) => (
    <button
      onClick={() => setSubPage(t)}
      style={{
        padding: '5px 16px', border: 'none', cursor: 'pointer', fontSize: 12, background: 'transparent',
        color: subPage === t ? '#4fc3f7' : '#666',
        borderBottom: subPage === t ? '2px solid #4fc3f7' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );

  if (loading) return <div style={{ padding: 24, color: '#666', fontSize: 13 }}>Loading journal...</div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a4e', flexShrink: 0, paddingLeft: 4 }}>
        {tabBtn('timeline', 'Timeline')}
        {tabBtn('psychology', 'My Psychology')}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {subPage === 'timeline' && (
          <>
            {entries.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#555', marginTop: 40, fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📓</div>
                <div>No journal entries yet.</div>
                <div style={{ fontSize: 12, marginTop: 6, color: '#444' }}>Place a paper trade to start logging.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entries.map(entry => {
                  const pnl = entry.trade?.pnl ?? null;
                  const isWin = pnl !== null && pnl > 0;
                  return (
                    <div key={entry.id} style={{
                      background: '#16213e', border: `1px solid ${pnl !== null ? (isWin ? '#26a69a33' : '#ef535033') : '#2a2a4e'}`,
                      borderLeft: `3px solid ${pnl !== null ? (isWin ? '#26a69a' : '#ef5350') : '#3a3a5e'}`,
                      borderRadius: 6, padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            background: `${EMOTION_COLORS[entry.emotion] || '#888'}22`,
                            color: EMOTION_COLORS[entry.emotion] || '#888',
                            border: `1px solid ${EMOTION_COLORS[entry.emotion] || '#888'}55`,
                          }}>
                            {EMOTION_LABELS[entry.emotion] || entry.emotion}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 11,
                            background: `${MC_COLORS[entry.market_condition] || '#666'}22`,
                            color: MC_COLORS[entry.market_condition] || '#888',
                          }}>
                            {entry.market_condition}
                          </span>
                          {entry.trade && (
                            <span style={{ fontSize: 11, color: entry.trade.side === 'BUY' ? '#26a69a' : '#ef5350' }}>
                              {entry.trade.side} {entry.trade.quantity} {entry.trade.symbol?.replace('USDT', '')}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                          {pnl !== null && (
                            <div style={{ fontSize: 14, fontWeight: 700, color: isWin ? '#26a69a' : '#ef5350' }}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#555' }}>
                            {new Date(entry.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {entry.reason && (
                        <div style={{ fontSize: 13, color: '#c0c0c0', marginBottom: 4, lineHeight: 1.4 }}>
                          "{entry.reason}"
                        </div>
                      )}
                      {entry.notes && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' }}>{entry.notes}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {subPage === 'psychology' && (
          <>
            {insightBest && insightWorst && (
              <div style={{
                background: 'linear-gradient(135deg, #1a2a3a, #1e1e35)',
                border: '1px solid #3a3a6e', borderRadius: 8, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, color: '#9090b0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Psychology Insights
                </div>
                <div style={{ fontSize: 13, color: '#e0e0e0', marginBottom: 6, lineHeight: 1.6 }}>
                  Your best trades happen when feeling:{' '}
                  <span style={{ color: EMOTION_COLORS[insightBest[0]], fontWeight: 700 }}>
                    {EMOTION_LABELS[insightBest[0]]}
                  </span>{' '}
                  <span style={{ color: '#26a69a' }}>({Math.round((insightBest[1] as number) * 100)}% win rate)</span>
                </div>
                <div style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.6 }}>
                  Avoid trading when:{' '}
                  <span style={{ color: EMOTION_COLORS[insightWorst[0]], fontWeight: 700 }}>
                    {EMOTION_LABELS[insightWorst[0]]}
                  </span>{' '}
                  <span style={{ color: '#ef5350' }}>({Math.round((insightWorst[1] as number) * 100)}% win rate)</span>
                </div>
                {analytics?.most_profitable_reason_keywords?.length ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
                    Top keywords in winning trades:{' '}
                    {analytics.most_profitable_reason_keywords.slice(0, 3).map((k, i) => (
                      <span key={i} style={{ color: '#4fc3f7', marginRight: 6 }}>"{k.word}"</span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {entries.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#555', marginTop: 40, fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                <div>No data yet. Place and log some trades to see your psychology patterns.</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: '#9090b0', fontWeight: 600, marginBottom: 12 }}>Win Rate by Emotion State</div>
                  {winRateChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={winRateChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4e" />
                        <XAxis dataKey="emotion" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => [`${v}%`, 'Win Rate']}
                          contentStyle={{ background: '#1e1e35', border: '1px solid #3a3a5e', borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: '#c0c0c0' }}
                        />
                        <Bar dataKey="win_rate" radius={[4, 4, 0, 0]}>
                          {winRateChartData.map((entry, i) => (
                            <Cell key={i} fill={EMOTION_COLORS[entry.key] || '#4fc3f7'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: '#555', fontSize: 13 }}>Not enough data yet.</div>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: '#9090b0', fontWeight: 600, marginBottom: 12 }}>Avg PnL by Emotion State ($)</div>
                  {avgPnlChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={avgPnlChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4e" />
                        <XAxis dataKey="emotion" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => [`$${v.toFixed(2)}`, 'Avg PnL']}
                          contentStyle={{ background: '#1e1e35', border: '1px solid #3a3a5e', borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: '#c0c0c0' }}
                        />
                        <Bar dataKey="avg_pnl" radius={[4, 4, 0, 0]}>
                          {avgPnlChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.avg_pnl >= 0 ? '#26a69a' : '#ef5350'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: '#555', fontSize: 13 }}>Not enough data yet.</div>
                  )}
                </div>

                {analytics?.most_profitable_reason_keywords?.length ? (
                  <div>
                    <div style={{ fontSize: 13, color: '#9090b0', fontWeight: 600, marginBottom: 10 }}>Top Reason Keywords by Avg PnL</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {analytics.most_profitable_reason_keywords.map((k, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: '#16213e', borderRadius: 6, border: '1px solid #2a2a4e' }}>
                          <span style={{ color: '#4fc3f7', fontWeight: 600 }}>"{k.word}"</span>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                            <span style={{ color: '#888' }}>{k.count} trade{k.count !== 1 ? 's' : ''}</span>
                            <span style={{ color: k.avg_pnl >= 0 ? '#26a69a' : '#ef5350', fontWeight: 700 }}>
                              {k.avg_pnl >= 0 ? '+' : ''}${k.avg_pnl.toFixed(2)} avg
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default JournalTab;
