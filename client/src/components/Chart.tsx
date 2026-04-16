import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';
import { Kline } from '../types';

interface Props {
  klines: Kline[];
  symbol: string;
}

function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcBollingerBands(data: number[], period = 20, multiplier = 2) {
  const sma = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  data.forEach((_, i) => {
    if (i < period - 1) { upper.push(null); lower.push(null); return; }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push(mean + multiplier * std);
    lower.push(mean - multiplier * std);
  });
  return { upper, lower, sma };
}

function calcVWAP(klines: Kline[]): (number | null)[] {
  const result: (number | null)[] = [];
  let cumTPV = 0;
  let cumVol = 0;
  let currentDay: string | null = null;
  for (const k of klines) {
    const date = new Date(k.time * 1000);
    const day = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    if (day !== currentDay) { cumTPV = 0; cumVol = 0; currentDay = day; }
    const tp = (k.high + k.low + k.close) / 3;
    cumTPV += tp * k.volume;
    cumVol += k.volume;
    result.push(cumVol > 0 ? cumTPV / cumVol : null);
  }
  return result;
}

const Chart: React.FC<Props> = ({ klines, symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const upperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [showSma, setShowSma] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [showVwap, setShowVwap] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const styles = getComputedStyle(document.documentElement);
    const theme = {
      bgBase: styles.getPropertyValue('--bg-base').trim(),
      accent: styles.getPropertyValue('--accent').trim(),
      danger: styles.getPropertyValue('--danger').trim(),
      textMuted: styles.getPropertyValue('--text-muted').trim(),
      border: styles.getPropertyValue('--border').trim(),
    };
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: theme.bgBase }, textColor: theme.textMuted },
      grid: { vertLines: { color: theme.border }, horzLines: { color: theme.border } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: theme.border },
      rightPriceScale: { borderColor: theme.border },
    });
    chartRef.current = chart;
    candleRef.current = chart.addCandlestickSeries({
      upColor: theme.accent, downColor: theme.danger,
      borderUpColor: theme.accent, borderDownColor: theme.danger,
      wickUpColor: theme.accent, wickDownColor: theme.danger,
    });
    smaRef.current = chart.addLineSeries({ color: theme.accent, lineWidth: 1, title: 'SMA20' });
    upperRef.current = chart.addLineSeries({ color: theme.accent, lineWidth: 1, lineStyle: 2, title: 'BB Upper' });
    lowerRef.current = chart.addLineSeries({ color: theme.accent, lineWidth: 1, lineStyle: 2, title: 'BB Lower' });
    vwapRef.current = chart.addLineSeries({ color: theme.textMuted, lineWidth: 2, title: 'VWAP' });

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    smaRef.current?.applyOptions({ visible: showSma });
  }, [showSma]);

  useEffect(() => {
    upperRef.current?.applyOptions({ visible: showBB });
    lowerRef.current?.applyOptions({ visible: showBB });
  }, [showBB]);

  useEffect(() => {
    vwapRef.current?.applyOptions({ visible: showVwap });
  }, [showVwap]);

  useEffect(() => {
    if (!klines.length || !candleRef.current) return;
    const candleData: CandlestickData[] = klines.map(k => ({
      time: k.time as CandlestickData['time'],
      open: k.open, high: k.high, low: k.low, close: k.close,
    }));
    candleRef.current.setData(candleData);

    const closes = klines.map(k => k.close);
    const { sma, upper, lower } = calcBollingerBands(closes, 20, 2);
    const vwap = calcVWAP(klines);

    const smaData: LineData[] = klines
      .map((k, i) => ({ time: k.time as LineData['time'], value: sma[i] }))
      .filter(d => d.value !== null) as LineData[];
    const upperData: LineData[] = klines
      .map((k, i) => ({ time: k.time as LineData['time'], value: upper[i] }))
      .filter(d => d.value !== null) as LineData[];
    const lowerData: LineData[] = klines
      .map((k, i) => ({ time: k.time as LineData['time'], value: lower[i] }))
      .filter(d => d.value !== null) as LineData[];
    const vwapData: LineData[] = klines
      .map((k, i) => ({ time: k.time as LineData['time'], value: vwap[i] }))
      .filter(d => d.value !== null) as LineData[];

    smaRef.current?.setData(smaData);
    upperRef.current?.setData(upperData);
    lowerRef.current?.setData(lowerData);
    vwapRef.current?.setData(vwapData);
    chartRef.current?.timeScale().fitContent();
  }, [klines]);

  const checkboxStyle = (color: string, checked: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
    padding: '2px 8px', borderRadius: 4,
    background: checked ? 'var(--accent-dim)' : 'var(--bg-card)',
    border: `1px solid ${checked ? color : 'var(--border)'}`,
    color: checked ? color : 'var(--text-muted)',
    fontSize: 11, fontWeight: 600, userSelect: 'none',
    transition: 'all 0.15s',
  });

  const currentVwap = klines.length > 0
    ? (() => {
        const vwap = calcVWAP(klines);
        const last = vwap[vwap.length - 1];
        return last ? last.toLocaleString(undefined, { maximumFractionDigits: 4 }) : null;
      })()
    : null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 8, left: 8, zIndex: 10,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <div style={checkboxStyle('var(--accent)', showSma)} onClick={() => setShowSma(v => !v)}>
          <span>SMA20</span>
        </div>
        <div style={checkboxStyle('var(--accent)', showBB)} onClick={() => setShowBB(v => !v)}>
          <span>BB</span>
        </div>
        <div style={checkboxStyle('var(--text-muted)', showVwap)} onClick={() => setShowVwap(v => !v)}>
          <span>VWAP{showVwap && currentVwap ? ` ${currentVwap}` : ''}</span>
        </div>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default Chart;
