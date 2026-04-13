import React, { useEffect, useRef } from 'react';
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

const Chart: React.FC<Props> = ({ klines, symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const upperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const lowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: '#1a1a2e' }, textColor: '#c0c0c0' },
      grid: { vertLines: { color: '#2a2a3e' }, horzLines: { color: '#2a2a3e' } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#3a3a5e' },
      rightPriceScale: { borderColor: '#3a3a5e' },
    });
    chartRef.current = chart;
    candleRef.current = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    smaRef.current = chart.addLineSeries({ color: '#2196F3', lineWidth: 1, title: 'SMA20' });
    upperRef.current = chart.addLineSeries({ color: '#FF9800', lineWidth: 1, lineStyle: 2, title: 'BB Upper' });
    lowerRef.current = chart.addLineSeries({ color: '#FF9800', lineWidth: 1, lineStyle: 2, title: 'BB Lower' });

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
    if (!klines.length || !candleRef.current) return;
    const candleData: CandlestickData[] = klines.map(k => ({
      time: k.time as CandlestickData['time'],
      open: k.open, high: k.high, low: k.low, close: k.close,
    }));
    candleRef.current.setData(candleData);

    const closes = klines.map(k => k.close);
    const { sma, upper, lower } = calcBollingerBands(closes, 20, 2);

    const smaData: LineData[] = klines
      .map((k, i) => ({ time: k.time as LineData['time'], value: sma[i] }))
      .filter(d => d.value !== null) as LineData[];
    const upperData: LineData[] = klines
      .map((k, i) => ({ time: k.time as LineData['time'], value: upper[i] }))
      .filter(d => d.value !== null) as LineData[];
    const lowerData: LineData[] = klines
      .map((k, i) => ({ time: k.time as LineData['time'], value: lower[i] }))
      .filter(d => d.value !== null) as LineData[];

    smaRef.current?.setData(smaData);
    upperRef.current?.setData(upperData);
    lowerRef.current?.setData(lowerData);
    chartRef.current?.timeScale().fitContent();
  }, [klines]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default Chart;
