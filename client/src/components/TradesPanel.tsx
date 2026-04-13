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
          <tr style={{ color: '#666', borderBottom: '1px solid #2a2a4e', position: 'sticky', top: 0, background: '#1e1e35' }}>
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
              <tr key={i} style={{ borderBottom: '1px solid #1a1a2e' }}>
                <td style={{ padding: '2px 8px', color: '#888' }}>{time}</td>
                <td style={{ padding: '2px 8px', textAlign: 'right', color: isBuy ? '#26a69a' : '#ef5350' }}>
                  {parseFloat(trade.price).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </td>
                <td style={{ padding: '2px 8px', textAlign: 'right', color: '#c0c0c0' }}>
                  {parseFloat(trade.qty).toFixed(4)}
                </td>
                <td style={{ padding: '2px 8px', textAlign: 'right', color: isBuy ? '#26a69a' : '#ef5350' }}>
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
