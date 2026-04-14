import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface HeatmapAsset {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  volume_24h: number;
}

interface HeatmapData {
  data: HeatmapAsset[];
  updated_at: number;
  demo: boolean;
}

interface Props {
  onSelectSymbol: (symbol: string) => void;
  onNavigateHome: () => void;
}

function getTileColor(change: number): { bg: string; border: string } {
  if (change > 5)  return { bg: '#1b5e20', border: '#2e7d32' };
  if (change > 2)  return { bg: '#2e7d32', border: '#388e3c' };
  if (change > 0)  return { bg: '#1b3a20', border: '#2d5a2e' };
  if (change > -2) return { bg: '#3a1a1a', border: '#5a2d2d' };
  if (change > -5) return { bg: '#7f1f1f', border: '#c62828' };
  return             { bg: '#b71c1c', border: '#d32f2f' };
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1)    return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return price.toFixed(5);
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

const GRID_COLS = 12;

function computeSpan(volume: number, minVol: number, maxVol: number): { col: number; row: number } {
  const logMin = Math.log(minVol + 1);
  const logMax = Math.log(maxVol + 1);
  const logVal = Math.log(volume + 1);
  const ratio = logMax > logMin ? (logVal - logMin) / (logMax - logMin) : 0.5;
  const col = Math.max(2, Math.min(6, Math.round(2 + ratio * 4)));
  const row = Math.max(1, Math.min(3, Math.round(1 + ratio * 2)));
  return { col, row };
}

const Legend = () => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {[
      { label: '>+5%', bg: '#1b5e20' }, { label: '+2%', bg: '#2e7d32' }, { label: '0%', bg: '#1b3a20' },
      { label: '-2%', bg: '#3a1a1a' }, { label: '-5%', bg: '#7f1f1f' }, { label: '<-5%', bg: '#b71c1c' },
    ].map(l => (
      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <div style={{ width: 12, height: 12, borderRadius: 2, background: l.bg }} />
        <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
      </div>
    ))}
  </div>
);

const HeatmapPage: React.FC<Props> = ({ onSelectSymbol, onNavigateHome }) => {
  const isMobile = useIsMobile();
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/heatmap');
      const json: HeatmapData = await res.json();
      setHeatmapData(json);
    } catch {}
    setLoading(false);
    setCountdown(30);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleTileClick = (asset: HeatmapAsset) => {
    onSelectSymbol(asset.symbol);
    onNavigateHome();
  };

  const assets = heatmapData?.data || [];
  const volumes = assets.map(a => a.volume_24h);
  const minVol = Math.min(...volumes);
  const maxVol = Math.max(...volumes);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: isMobile ? '8px 12px' : '8px 16px',
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0,
      }}>
        <button
          onClick={onNavigateHome}
          style={{
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--text-muted)', padding: '4px 10px', cursor: 'pointer', fontSize: 13,
          }}
        >
          ← {isMobile ? '' : 'Terminal'}
        </button>
        <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16, color: 'var(--accent)' }}>
          {isMobile ? 'Heatmap' : 'Market Heatmap'}
        </div>
        {heatmapData?.demo && (
          <span style={{ padding: '2px 8px', background: 'rgba(255,152,0,0.08)', border: '1px solid #ff9800', borderRadius: 12, fontSize: 11, color: '#ff9800' }}>
            DEMO
          </span>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: countdown <= 5 ? '#ff9800' : 'var(--text-muted)' }}>
          {isMobile ? `${countdown}s` : `Refreshing in ${countdown}s`}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 8 : 16 }}>
        {!isMobile && (
          <div style={{ marginBottom: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tile size = 24h volume · Color = % change</span>
            <Legend />
          </div>
        )}
        {isMobile && (
          <div style={{ marginBottom: 8 }}>
            <Legend />
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', fontSize: 16 }}>
            Loading heatmap data...
          </div>
        ) : isMobile ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
          }}>
            {assets.map(asset => {
              const { bg, border } = getTileColor(asset.change_pct);
              const isPositive = asset.change_pct >= 0;
              return (
                <div
                  key={asset.symbol}
                  onClick={() => handleTileClick(asset)}
                  style={{
                    background: bg, border: `1px solid ${border}`, borderRadius: 8,
                    padding: '12px 10px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 4,
                    minHeight: 90,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'rgba(232,234,240,0.95)' }}>{asset.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(232,234,240,0.6)' }}>{formatPrice(asset.price)}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isPositive ? '#a5d6a7' : '#ef9a9a', marginTop: 'auto' }}>
                    {isPositive ? '▲' : '▼'} {Math.abs(asset.change_pct).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(232,234,240,0.35)' }}>
                    {formatVolume(asset.volume_24h)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridAutoRows: '80px',
            gap: 4,
            width: '100%',
          }}>
            {assets.map(asset => {
              const { col, row } = computeSpan(asset.volume_24h, minVol, maxVol);
              const { bg, border } = getTileColor(asset.change_pct);
              const isPositive = asset.change_pct >= 0;
              const tileHeight = row * 80 + (row - 1) * 4;
              return (
                <div
                  key={asset.symbol}
                  onClick={() => handleTileClick(asset)}
                  style={{
                    gridColumn: `span ${col}`, gridRow: `span ${row}`,
                    background: bg, border: `1px solid ${border}`, borderRadius: 6,
                    padding: '8px 10px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    transition: 'filter 0.15s, transform 0.15s',
                    minHeight: tileHeight, position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.filter = 'brightness(1.2)'; el.style.transform = 'scale(1.01)'; el.style.zIndex = '10';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.filter = ''; el.style.transform = ''; el.style.zIndex = '';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: col >= 4 ? 18 : 13, color: 'rgba(232,234,240,0.95)', lineHeight: 1.1 }}>
                      {asset.name}
                    </div>
                    {col >= 3 && (
                      <div style={{ fontSize: col >= 4 ? 12 : 10, color: 'rgba(232,234,240,0.6)', marginTop: 2 }}>
                        {formatPrice(asset.price)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: col >= 5 ? 20 : col >= 3 ? 15 : 12, fontWeight: 700, color: isPositive ? '#a5d6a7' : '#ef9a9a' }}>
                      {isPositive ? '▲' : '▼'} {Math.abs(asset.change_pct).toFixed(2)}%
                    </div>
                    {col >= 4 && row >= 2 && (
                      <div style={{ fontSize: 10, color: 'rgba(232,234,240,0.4)', marginTop: 2 }}>
                        Vol {formatVolume(asset.volume_24h)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatmapPage;
