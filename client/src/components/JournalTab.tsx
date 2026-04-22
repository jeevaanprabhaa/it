import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { JournalEntry, Analytics, Emotion } from '../types';

const EMOTION_COLORS: Record<string, string> = {
  confident: 'var(--accent)',
  fearful: 'var(--danger)',
  fomo: 'var(--accent)',
  neutral: 'var(--text-muted)',
  greedy: 'var(--text-muted)',
};

const EMOTION_LABELS: Record<string, string> = {
  confident: 'Confident',
  fearful: 'Fearful',
  fomo: 'FOMO',
  neutral: 'Neutral',
  greedy: 'Greedy',
};

const MC_COLORS: Record<string, string> = {
  trending: 'var(--accent)',
  ranging: 'var(--accent)',
  volatile: 'var(--danger)',
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
        fetch(apiUrl('/api/journal')),
        fetch(apiUrl('/api/journal/analytics')),
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
        padding: '5px 16px', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, background: 'var(--bg-card)',
        color: subPage === t ? 'var(--accent)' : 'var(--text-muted)',
        borderBottom: subPage === t ? '2px solid var(--accent)' : '2px solid var(--border)',
      }}
    >
      {label}
    </button>
  );

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Loading journal...</div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, paddingLeft: 4 }}>
        {tabBtn('timeline', 'Timeline')}
        {tabBtn('psychology', 'My Psychology')}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {subPage === 'timeline' && (
          <>
            {entries.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📓</div>
                <div>No journal entries yet.</div>
                <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>Place a paper trade to start logging.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entries.map(entry => {
                  const pnl = entry.trade?.pnl ?? null;
                  const isWin = pnl !== null && pnl > 0;
                  return (
                    <div key={entry.id} style={{
                      background: 'var(--bg-panel)', border: `1px solid ${pnl !== null ? (isWin ? 'var(--accent)' : 'var(--danger)') : 'var(--border)'}`,
                      borderLeft: `3px solid ${pnl !== null ? (isWin ? 'var(--accent)' : 'var(--danger)') : 'var(--border)'}`,
                      borderRadius: 6, padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            background: `${EMOTION_COLORS[entry.emotion] || 'var(--text-muted)'}22`,
                            color: EMOTION_COLORS[entry.emotion] || 'var(--text-muted)',
                            border: `1px solid ${EMOTION_COLORS[entry.emotion] || 'var(--text-muted)'}55`,
                          }}>
                            {EMOTION_LABELS[entry.emotion] || entry.emotion}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: 11,
                            background: `${MC_COLORS[entry.market_condition] || 'var(--text-muted)'}22`,
                            color: MC_COLORS[entry.market_condition] || 'var(--text-muted)',
                          }}>
                            {entry.market_condition}
                          </span>
                          {entry.trade && (
                            <span style={{ fontSize: 11, color: entry.trade.side === 'BUY' ? 'var(--accent)' : 'var(--danger)' }}>
                              {entry.trade.side} {entry.trade.quantity} {entry.trade.symbol?.replace('USDT', '')}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                          {pnl !== null && (
                            <div style={{ fontSize: 14, fontWeight: 700, color: isWin ? 'var(--accent)' : 'var(--danger)' }}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(entry.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {entry.reason && (
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
                          "{entry.reason}"
                        </div>
                      )}
                      {entry.notes && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{entry.notes}</div>
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
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Psychology Insights
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.6 }}>
                  Your best trades happen when feeling:{' '}
                  <span style={{ color: EMOTION_COLORS[insightBest[0]], fontWeight: 700 }}>
                    {EMOTION_LABELS[insightBest[0]]}
                  </span>{' '}
                  <span style={{ color: 'var(--accent)' }}>({Math.round((insightBest[1] as number) * 100)}% win rate)</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  Avoid trading when:{' '}
                  <span style={{ color: EMOTION_COLORS[insightWorst[0]], fontWeight: 700 }}>
                    {EMOTION_LABELS[insightWorst[0]]}
                  </span>{' '}
                  <span style={{ color: 'var(--danger)' }}>({Math.round((insightWorst[1] as number) * 100)}% win rate)</span>
                </div>
                {analytics?.most_profitable_reason_keywords?.length ? (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                    Top keywords in winning trades:{' '}
                    {analytics.most_profitable_reason_keywords.slice(0, 3).map((k, i) => (
                      <span key={i} style={{ color: 'var(--accent)', marginRight: 6 }}>"{k.word}"</span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {entries.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                <div>No data yet. Place and log some trades to see your psychology patterns.</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>Win Rate by Emotion State</div>
                  {winRateChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={winRateChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="emotion" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => [`${v}%`, 'Win Rate']}
                          contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Bar dataKey="win_rate" radius={[4, 4, 0, 0]}>
                          {winRateChartData.map((entry, i) => (
                            <Cell key={i} fill={EMOTION_COLORS[entry.key] || 'var(--accent)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Not enough data yet.</div>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>Avg PnL by Emotion State ($)</div>
                  {avgPnlChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={avgPnlChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="emotion" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `$${v}`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => [`$${v.toFixed(2)}`, 'Avg PnL']}
                          contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Bar dataKey="avg_pnl" radius={[4, 4, 0, 0]}>
                          {avgPnlChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.avg_pnl >= 0 ? 'var(--accent)' : 'var(--danger)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Not enough data yet.</div>
                  )}
                </div>

                {analytics?.most_profitable_reason_keywords?.length ? (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10 }}>Top Reason Keywords by Avg PnL</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {analytics.most_profitable_reason_keywords.map((k, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--bg-panel)', borderRadius: 6, border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>"{k.word}"</span>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k.count} trade{k.count !== 1 ? 's' : ''}</span>
                            <span style={{ color: k.avg_pnl >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>
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
