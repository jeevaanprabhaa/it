import React, { useState } from 'react';
import { Order, Emotion, MarketCondition, EMOTIONS, MARKET_CONDITIONS } from '../types';

interface Props {
  order: Order;
  onSave: (entry: { reason: string; emotion: Emotion; market_condition: MarketCondition; notes: string }) => void;
  onSkip: () => void;
}

const EMOTION_COLORS: Record<Emotion, string> = {
  confident: '#2ECC98',
  fearful: '#E5534B',
  fomo: '#ff9800',
  neutral: '#78909c',
  greedy: '#ab47bc',
};

const EMOTION_LABELS: Record<Emotion, string> = {
  confident: 'Confident',
  fearful: 'Fearful',
  fomo: 'FOMO',
  neutral: 'Neutral',
  greedy: 'Greedy',
};

const JournalModal: React.FC<Props> = ({ order, onSave, onSkip }) => {
  const [reason, setReason] = useState('');
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [market_condition, setMarketCondition] = useState<MarketCondition>('ranging');
  const [notes, setNotes] = useState('');

  const pnl = order.pnl ?? 0;
  const pnlColor = pnl >= 0 ? 'var(--accent)' : 'var(--danger)';

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: 'var(--bg-primary)',
    border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-primary)',
    fontSize: 13, resize: 'none' as const, outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10,
        width: 480, maxWidth: '95vw', padding: 24, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>Log This Trade</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {order.side} {order.quantity} {order.symbol.replace('USDT', '')} @ {order.price.toLocaleString()}
              <span style={{ marginLeft: 10, color: pnlColor, fontWeight: 600 }}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} PnL
              </span>
            </div>
          </div>
          <button onClick={onSkip} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Why did you take this trade?
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Breakout above key resistance with volume confirmation..."
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Emotional State
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EMOTIONS.map(em => (
              <button
                key={em}
                onClick={() => setEmotion(em)}
                style={{
                  padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `2px solid ${emotion === em ? EMOTION_COLORS[em] : 'var(--border)'}`,
                  background: emotion === em ? `${EMOTION_COLORS[em]}22` : 'transparent',
                  color: emotion === em ? EMOTION_COLORS[em] : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {EMOTION_LABELS[em]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Market Condition
          </label>
          <select
            value={market_condition}
            onChange={e => setMarketCondition(e.target.value as MarketCondition)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {MARKET_CONDITIONS.map(mc => (
              <option key={mc} value={mc}>{mc.charAt(0).toUpperCase() + mc.slice(1)}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12, marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Additional Notes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any other observations..."
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onSave({ reason, emotion, market_condition, notes })}
            style={{
              flex: 1, padding: '10px 0', background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 14,
            }}
          >
            Save to Journal
          </button>
          <button
            onClick={onSkip}
            style={{
              padding: '10px 18px', background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default JournalModal;
