'use client';

// Candlestick + volume + 4 overlay lines (S, R, Stop loss, Target).
// Built on lightweight-charts v4 — re-applies layout colors when [data-theme] changes
// so the chart follows the global theme switch without re-mount.
//
// Period switcher refetches OHLCV via the parent (controlled).

import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';

import type { OhlcvBar } from '@/lib/types';

export type CandlePeriod = '1M' | '3M' | '6M' | '1Y';

interface Overlays {
  support: number;
  resistance: number;
  stop_loss: number;
  target_3m: number;
}

interface Props {
  bars: OhlcvBar[];
  overlays: Overlays;
  period: CandlePeriod;
  onPeriodChange: (p: CandlePeriod) => void;
  loading?: boolean;
}

// Read CSS var from :root — used to theme the chart background / grid / text.
function readVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildLayoutOptions() {
  // Defer reads to runtime so SSR doesn't crash.
  const bg = readVar('--color-theme-card-bg') || '#1e1e1e';
  const text = readVar('--color-theme-text-primary') || '#ddd';
  const grid = readVar('--color-theme-charcoal') || '#3f4160';
  return {
    layout: {
      background: { type: ColorType.Solid, color: bg },
      textColor: text,
    },
    grid: {
      vertLines: { color: grid },
      horzLines: { color: grid },
    },
    crosshair: { mode: CrosshairMode.Magnet },
    rightPriceScale: { borderColor: grid },
    timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false },
  };
}

function dateToTime(s: string): UTCTimestamp {
  // 'YYYY-MM-DD' → midnight UTC seconds. Lightweight Charts accepts UTCTimestamp.
  return Math.floor(new Date(`${s}T00:00:00Z`).getTime() / 1000) as UTCTimestamp;
}

const PERIODS: CandlePeriod[] = ['1M', '3M', '6M', '1Y'];

export function CandlestickChart({ bars, overlays, period, onPeriodChange, loading }: Props) {
  const t = useTranslations('stockDetail.candlestick');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const overlayLinesRef = useRef<IPriceLine[]>([]);
  // Keep latest bars + overlays in refs so the theme-apply path can re-paint them
  // with the new color tokens without re-mounting the chart.
  const barsRef = useRef<OhlcvBar[]>([]);
  const overlaysRef = useRef<Overlays | null>(null);

  // 1) Init chart once + ResizeObserver for responsive width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      ...buildLayoutOptions(),
      autoSize: false,
      width: el.clientWidth,
      height: el.clientHeight,
    });
    chartRef.current = chart;

    const upColor = readVar('--ssi-up') || '#0bdf39';
    const downColor = readVar('--ssi-down') || '#ff0017';

    const candle = chart.addCandlestickSeries({
      upColor,
      downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
    });
    candleRef.current = candle;

    // Volume on its own (overlay) price scale, pinned to bottom 30%.
    // Both candle (right) and volume (overlay) scales need explicit margins so they
    // visually stack instead of overlapping — lightweight-charts default fills 100%.
    const volume = chart.addHistogramSeries({
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      color: 'rgba(120, 120, 120, 0.4)',
    });
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.3 },
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });
    volumeRef.current = volume;

    // Resize on container width change.
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      overlayLinesRef.current = [];
    };
  }, []);

  // Single repaint path — used by data-change AND theme-change so volume tints + overlay
  // line colors stay in sync with the current CSS variables.
  const repaintData = (currentBars: OhlcvBar[]) => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candle || !volume || !chart) return;
    const candles: CandlestickData[] = currentBars.map((b) => ({
      time: dateToTime(b.date),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    const upColor = readVar('--ssi-up') || '#0bdf39';
    const downColor = readVar('--ssi-down') || '#ff0017';
    const volumes: HistogramData[] = currentBars.map((b) => ({
      time: dateToTime(b.date),
      value: b.volume,
      color: b.close >= b.open ? `${upColor}55` : `${downColor}55`,
    }));
    candle.setData(candles);
    volume.setData(volumes);
  };

  const repaintOverlays = (currentOverlays: Overlays) => {
    const candle = candleRef.current;
    if (!candle) return;
    overlayLinesRef.current.forEach((l) => candle.removePriceLine(l));
    overlayLinesRef.current = [];
    const lines: { price: number; color: string; title: string }[] = [
      { price: currentOverlays.support, color: 'var(--ssi-up)', title: t('overlay.support') },
      { price: currentOverlays.resistance, color: 'var(--ssi-down)', title: t('overlay.resistance') },
      { price: currentOverlays.stop_loss, color: '#f49f3b', title: t('overlay.stopLoss') },
      { price: currentOverlays.target_3m, color: '#a06bff', title: t('overlay.target') },
    ];
    lines.forEach((l) => {
      const colorResolved = l.color.startsWith('var(') ? readVar(l.color.slice(4, -1)) : l.color;
      const pl = candle.createPriceLine({
        price: l.price,
        color: colorResolved || l.color,
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: l.title,
      });
      overlayLinesRef.current.push(pl);
    });
  };

  // 2) Push data when `bars` changes.
  useEffect(() => {
    barsRef.current = bars;
    repaintData(bars);
    chartRef.current?.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);

  // 3) Re-draw overlay lines when overlays change.
  useEffect(() => {
    overlaysRef.current = overlays;
    repaintOverlays(overlays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays, t]);

  // 4) Re-apply layout colors + repaint colored data when [data-theme] changes.
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const chart = chartRef.current;
      const candle = candleRef.current;
      if (!chart || !candle) return;
      chart.applyOptions(buildLayoutOptions());
      const upColor = readVar('--ssi-up') || '#0bdf39';
      const downColor = readVar('--ssi-down') || '#ff0017';
      candle.applyOptions({
        upColor,
        downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
      // Volume tints + overlay line colors are baked from CSS vars at draw time —
      // re-paint them so they follow the new theme.
      repaintData(barsRef.current);
      if (overlaysRef.current) repaintOverlays(overlaysRef.current);
    };
    const observer = new MutationObserver((muts) => {
      if (muts.some((m) => m.attributeName === 'data-theme')) apply();
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const periodButtons = useMemo(
    () =>
      PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPeriodChange(p)}
          className="text-2xs px-2 py-1 rounded border"
          style={{
            backgroundColor:
              p === period ? 'var(--color-theme-crimson)' : 'transparent',
            color: p === period ? '#ffffff' : 'var(--color-theme-text-primary)',
            borderColor:
              p === period ? 'var(--color-theme-crimson)' : 'var(--color-theme-input-border)',
          }}
        >
          {t(`period.${p}`)}
        </button>
      )),
    [period, onPeriodChange, t],
  );

  return (
    <section className="card p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('title')}
          </h2>
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">{periodButtons}</div>
          <button
            type="button"
            onClick={() => chartRef.current?.timeScale().fitContent()}
            className="btn btn-ghost text-2xs px-2 py-1"
          >
            {t('reset')}
          </button>
        </div>
      </header>

      <div
        ref={containerRef}
        style={{ width: '100%', height: 360, position: 'relative' }}
        aria-label={t('title')}
      >
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{
              backgroundColor: 'rgba(0,0,0,0.25)',
              color: 'var(--color-theme-text-tertiary)',
              zIndex: 2,
            }}
          >
            {t('loading')}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-2xs">
        <span style={{ color: 'var(--ssi-up)' }}>— {t('overlay.support')}: {overlays.support.toFixed(2)}</span>
        <span style={{ color: 'var(--ssi-down)' }}>— {t('overlay.resistance')}: {overlays.resistance.toFixed(2)}</span>
        <span style={{ color: '#f49f3b' }}>— {t('overlay.stopLoss')}: {overlays.stop_loss.toFixed(2)}</span>
        <span style={{ color: '#a06bff' }}>— {t('overlay.target')}: {overlays.target_3m.toFixed(2)}</span>
      </div>
    </section>
  );
}
