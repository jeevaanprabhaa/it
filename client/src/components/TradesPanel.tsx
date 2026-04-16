import React from 'react';
import { Trade } from '../types';

interface Props {
  trades: Trade[];
}

const TradesPanel: React.FC<Props> = ({ trades }) => {
  return (
    <div style={{ height: '100%', overflowY: 'auto', fontSize: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-panel)' }}>
            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Time</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Price</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Side</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, i) => {
            const isBuy = !trade.isBuyerMaker;
            const time = new Date(trade.time).toLocaleTimeString();
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--bg-base)' }}>
                <td style={{ padding: '2px 8px', color: 'var(--text-muted)' }}>{time}</td>
                <td style={{ padding: '2px 8px', textAlign: 'right', color: isBuy ? 'var(--accent)' : 'var(--danger)' }}>
                  {parseFloat(trade.price).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </td>
                <td style={{ padding: '2px 8px', textAlign: 'right', color: 'var(--text-primary)' }}>
                  {parseFloat(trade.qty).toFixed(4)}
                </td>
                <td style={{ padding: '2px 8px', textAlign: 'right', color: isBuy ? 'var(--accent)' : 'var(--danger)' }}>
                  {isBuy ? 'BUY' : 'SELL'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TradesPanel;
