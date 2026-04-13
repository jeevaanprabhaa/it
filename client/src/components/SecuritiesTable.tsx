import React, { useState, useEffect } from 'react';
import { SYMBOLS } from '../types';

interface SymbolData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

interface Props {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

const SecuritiesTable: React.FC<Props> = ({ selectedSymbol, onSelectSymbol }) => {
  const [data, setData] = useState<SymbolData[]>(
    SYMBOLS.map(s => ({ symbol: s, lastPrice: '...', priceChangePercent: '0', volume: '...' }))
  );

  const generateDemoData = () => {
    const prices: Record<string, number> = {
      BTCUSDT: 43500, ETHUSDT: 2280, SOLUSDT: 98, BNBUSDT: 310,
      XRPUSDT: 0.62, ADAUSDT: 0.48, DOGEUSDT: 0.085, MATICUSDT: 0.9
    };
    return SYMBOLS.map(s => ({
      symbol: s,
      lastPrice: (prices[s] * (1 + (Math.random() - 0.5) * 0.01)).toFixed(prices[s] < 1 ? 5 : 2),
      priceChangePercent: ((Math.random() - 0.5) * 6).toFixed(2),
      volume: (Math.random() * 50000 + 1000).toFixed(0),
    }));
  };

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch('/api/ticker/24hr');
        if (!res.ok || res.status === 451) throw new Error('failed');
        const all: SymbolData[] = await res.json();
        const filtered = SYMBOLS.map(sym => all.find((t: SymbolData) => t.symbol === sym)).filter(Boolean) as SymbolData[];
        if (filtered.length) setData(filtered);
        else setData(generateDemoData());
      } catch {
        setData(generateDemoData());
      }
    };
    fetchTickers();
    const id = setInterval(fetchTickers, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', fontSize: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: '#666', borderBottom: '1px solid #2a2a4e' }}>
            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Symbol</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Price</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Change</th>
            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Volume</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => {
            const change = parseFloat(row.priceChangePercent);
            const isSelected = row.symbol === selectedSymbol;
            return (
              <tr
                key={row.symbol}
                onClick={() => onSelectSymbol(row.symbol)}
                style={{
                  cursor: 'pointer',
                  background: isSelected ? '#2a2a4e' : 'transparent',
                  borderBottom: '1px solid #22223a',
                }}
              >
                <td style={{ padding: '4px 8px', color: '#e0e0e0', fontWeight: isSelected ? 600 : 400 }}>{row.symbol}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e0e0e0' }}>
                  {parseFloat(row.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: change >= 0 ? '#26a69a' : '#ef5350' }}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: '#888' }}>
                  {parseFloat(row.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SecuritiesTable;
