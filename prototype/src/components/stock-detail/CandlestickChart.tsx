'use client';

// Candlestick + volume + 4 overlay lines (S, R, Stop loss, Target) +
// MA20/MA50/MA200 price overlays + MA20 volume overlay.
// Built on lightweight-charts v4 — re-applies layout colors when [data-theme] changes
// so the chart follows the global theme switch without re-mount.
//
// Interval/lookback switchers refetch OHLCV via the parent (controlled).
// MA visibility toggles are local + persisted to localStorage.

import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CandleInterval,
  CandleLookback,
  OhlcvBar,
  PriceIndicators,
} from '@/lib/types';

interface Overlays {
  support: number;
  resistance: number;
  stop_loss: number;
  target_3m: number;
}

interface Props {
  bars: OhlcvBar[];
  indicators: PriceIndicators;
  overlays: Overlays;
  interval: CandleInterval;
  lookback: CandleLookback;
  onIntervalChange: (i: CandleInterval) => void;
  onLookbackChange: (l: CandleLookback) => void;
  loading?: boolean;
}

// Visibility toggles for MA overlays. Persisted to localStorage so the user's
// preference survives reload. MA200 default-off because it's often empty on
// monthly aggregates and can crowd shorter lookbacks.
type MAKey = 'ma20' | 'ma50' | 'ma200' | 'ma_volume_20';
type MAToggles = Record<MAKey, boolean>;
const STORAGE_KEY = 'stock-v2:candlestick-ma-toggles';
const DEFAULT_TOGGLES: MAToggles = {
  ma20: true,
  ma50: true,
  ma200: false,
  ma_volume_20: true,
};

// Hard-coded MA colors — chosen to be distinguishable on both light and dark
// themes and not collide with up/down (green/red) or S/R overlay colors.
const MA_COLORS: Record<MAKey, string> = {
  ma20: '#f7c948', // amber
  ma50: '#4d96ff', // sky blue
  ma200: '#ec6090', // pink-red (distinct from down=red)
  ma_volume_20: '#9aa4b2', // muted gray on the volume pane
};

// Read CSS var from :root — used to theme the chart background / grid / text.
function readVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Convert #rrggbb → rgba(r,g,b,a). Falls back to the raw input for non-hex values.
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}

function buildLayoutOptions() {
  // Defer reads to runtime so SSR doesn't crash.
  const bg = readVar('--color-theme-card-bg') || '#1e1e1e';
  const text = readVar('--color-theme-text-primary') || '#ddd';
  const grid = readVar('--color-theme-charcoal') || '#3f4160';
  const gridFaint = withAlpha(grid, 0.12);
  return {
    layout: {
      background: { type: ColorType.Solid, color: bg },
      textColor: text,
    },
    grid: {
      vertLines: { color: gridFaint },
      horzLines: { color: gridFaint },
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

const INTERVALS: CandleInterval[] = ['D', 'W', 'M'];
const LOOKBACKS: CandleLookback[] = ['1T', '3T', '6T', '1N', '3N', 'YTD', 'All'];

// Minimum lookback per interval that yields ≥5 bars (avoids "1 candle" charts).
// D ≥ 22 bars at 1T → always OK. W ≥ 13 bars at 3T. M ≥ 6 bars at 6T.
const MIN_LOOKBACK_BY_INTERVAL: Record<CandleInterval, CandleLookback> = {
  D: '1T',
  W: '3T',
  M: '6T',
};

// Linear rank for fixed-window lookbacks. YTD/All sit at "always-sufficient":
// YTD is calendar-dependent (varies through the year) and All has the most bars,
// so neither participates in the disable/auto-bump arithmetic.
const LOOKBACK_RANK: Record<CandleLookback, number> = {
  '1T': 1,
  '3T': 2,
  '6T': 3,
  '1N': 4,
  '3N': 5,
  YTD: 99,
  All: 99,
};

// Snapshot of values shown in the chart's top-left legend. Driven by crosshair
// hover (or falls back to the most recent bar when the cursor is outside).
interface LegendSnapshot {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  pctChange: number | null; // close vs prev close, in %
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
}

function readToggles(): MAToggles {
  if (typeof window === 'undefined') return DEFAULT_TOGGLES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOGGLES;
    const parsed = JSON.parse(raw) as Partial<MAToggles>;
    return { ...DEFAULT_TOGGLES, ...parsed };
  } catch {
    return DEFAULT_TOGGLES;
  }
}

export function CandlestickChart({
  bars,
  indicators,
  overlays,
  interval,
  lookback,
  onIntervalChange,
  onLookbackChange,
  loading,
}: Props) {
  const t = useTranslations('stockDetail.candlestick');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma200Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const maVol20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const overlayLinesRef = useRef<IPriceLine[]>([]);
  // Keep latest bars + overlays + indicators in refs so the theme-apply path
  // and the crosshair handler can read them without stale closures.
  const barsRef = useRef<OhlcvBar[]>([]);
  const overlaysRef = useRef<Overlays | null>(null);
  const indicatorsRef = useRef<PriceIndicators | null>(null);

  const [toggles, setToggles] = useState<MAToggles>(readToggles);
  const [legend, setLegend] = useState<LegendSnapshot | null>(null);

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
      // Highlight current price: dashed line + bubble label on the right axis.
      priceLineVisible: true,
      priceLineStyle: 2,
      priceLineWidth: 1,
      lastValueVisible: true,
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

    // MA overlays — three on the price (right) scale, one on the volume scale.
    // priceLineVisible/lastValueVisible disabled so they don't add extra dashed
    // lines or axis labels that would clutter the candle's "current price" marker.
    const lineOpts = (color: string, scaleId?: string) => ({
      color,
      lineWidth: 1 as const,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      ...(scaleId ? { priceScaleId: scaleId } : {}),
    });
    ma20Ref.current = chart.addLineSeries(lineOpts(MA_COLORS.ma20));
    ma50Ref.current = chart.addLineSeries(lineOpts(MA_COLORS.ma50));
    ma200Ref.current = chart.addLineSeries(lineOpts(MA_COLORS.ma200));
    maVol20Ref.current = chart.addLineSeries(lineOpts(MA_COLORS.ma_volume_20, 'volume'));

    // Crosshair → legend snapshot. When the cursor leaves the chart we fall back
    // to the most-recent bar so the legend always shows something useful.
    const handleCrosshair = (param: MouseEventParams) => {
      const barsNow = barsRef.current;
      const indNow = indicatorsRef.current;
      if (barsNow.length === 0 || !indNow) {
        setLegend(null);
        return;
      }
      let idx = barsNow.length - 1;
      if (param.time != null) {
        const t = param.time as UTCTimestamp;
        const found = barsNow.findIndex((b) => dateToTime(b.date) === t);
        if (found >= 0) idx = found;
      }
      const b = barsNow[idx];
      const prev = idx > 0 ? barsNow[idx - 1] : null;
      const pct = prev ? ((b.close - prev.close) / prev.close) * 100 : null;
      setLegend({
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        pctChange: pct,
        ma20: indNow.ma20[idx] ?? null,
        ma50: indNow.ma50[idx] ?? null,
        ma200: indNow.ma200[idx] ?? null,
      });
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    // Resize on container width change.
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      ma20Ref.current = null;
      ma50Ref.current = null;
      ma200Ref.current = null;
      maVol20Ref.current = null;
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

  // Push aligned MA series into their lightweight-charts line series.
  // Bars and indicators arrays must be the same length (server contract); we
  // skip null entries so lightweight-charts draws gaps where MA is undefined.
  const repaintIndicators = (
    currentBars: OhlcvBar[],
    currentIndicators: PriceIndicators,
  ) => {
    const series: [ISeriesApi<'Line'> | null, (number | null)[]][] = [
      [ma20Ref.current, currentIndicators.ma20],
      [ma50Ref.current, currentIndicators.ma50],
      [ma200Ref.current, currentIndicators.ma200],
      [maVol20Ref.current, currentIndicators.ma_volume_20],
    ];
    for (const [s, values] of series) {
      if (!s) continue;
      const data: LineData[] = [];
      for (let i = 0; i < currentBars.length; i += 1) {
        const v = values[i];
        if (v == null) continue;
        data.push({ time: dateToTime(currentBars[i].date), value: v });
      }
      s.setData(data);
    }
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

  // 2) Push data when `bars` (or `indicators`) changes. Indicators are aligned
  // to bars by the server contract, so they share a single repaint pass.
  // We also seed the top-left legend with the last bar so the user sees current
  // OHLC/MA values immediately, before they hover the chart.
  useEffect(() => {
    barsRef.current = bars;
    indicatorsRef.current = indicators;
    repaintData(bars);
    repaintIndicators(bars, indicators);
    chartRef.current?.timeScale().fitContent();
    if (bars.length > 0) {
      const idx = bars.length - 1;
      const b = bars[idx];
      const prev = idx > 0 ? bars[idx - 1] : null;
      setLegend({
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        pctChange: prev ? ((b.close - prev.close) / prev.close) * 100 : null,
        ma20: indicators.ma20[idx] ?? null,
        ma50: indicators.ma50[idx] ?? null,
        ma200: indicators.ma200[idx] ?? null,
      });
    } else {
      setLegend(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, indicators]);

  // 2b) Apply MA visibility whenever the user toggles a chip. Lightweight-charts
  // accepts `visible: false` to hide a series without losing its data.
  useEffect(() => {
    ma20Ref.current?.applyOptions({ visible: toggles.ma20 });
    ma50Ref.current?.applyOptions({ visible: toggles.ma50 });
    ma200Ref.current?.applyOptions({ visible: toggles.ma200 });
    maVol20Ref.current?.applyOptions({ visible: toggles.ma_volume_20 });
  }, [toggles]);

  // Persist toggles. Wrapped in try/catch so private-mode browsers don't error.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
    } catch {
      /* ignore */
    }
  }, [toggles]);

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
      // re-paint them so they follow the new theme. MA lines use hard-coded
      // hex (theme-agnostic) so they don't need re-tinting, but their data must
      // be re-set if the candle series was replaced.
      repaintData(barsRef.current);
      if (indicatorsRef.current) repaintIndicators(barsRef.current, indicatorsRef.current);
      if (overlaysRef.current) repaintOverlays(overlaysRef.current);
    };
    const observer = new MutationObserver((muts) => {
      if (muts.some((m) => m.attributeName === 'data-theme')) apply();
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMA = useCallback((key: MAKey) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Format helpers for the legend.
  const fmtPrice = (n: number | null): string => (n == null ? '—' : n.toFixed(2));
  const fmtVolume = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };
  const fmtPct = (n: number | null): string => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`);

  // Switching to a coarser interval auto-bumps lookback so the chart never
  // collapses to a near-empty result (e.g. M + 1T = 1 bar). We bump only when
  // the current lookback would render fewer than ~5 bars at the new interval.
  const handleIntervalClick = (next: CandleInterval) => {
    const minLookback = MIN_LOOKBACK_BY_INTERVAL[next];
    if (LOOKBACK_RANK[lookback] < LOOKBACK_RANK[minLookback]) {
      onLookbackChange(minLookback);
    }
    onIntervalChange(next);
  };

  const minLookbackRank = LOOKBACK_RANK[MIN_LOOKBACK_BY_INTERVAL[interval]];

  // Tier 1 — candle interval (D/W/M) as a segmented pill control.
  const intervalPills = useMemo(
    () =>
      INTERVALS.map((i) => {
        const active = i === interval;
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleIntervalClick(i)}
            className="text-2xs px-2.5 py-1 font-medium transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-theme-crimson)' : 'transparent',
              color: active ? '#ffffff' : 'var(--color-theme-text-secondary)',
            }}
          >
            {t(`interval.${i}`)}
          </button>
        );
      }),
    // handleIntervalClick captures `lookback` + the two setters; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interval, lookback, onIntervalChange, onLookbackChange, t],
  );

  // Tier 2 — lookback window as plain text buttons (TradingView/TCBS style).
  // Buttons that would render <5 bars at the current interval are disabled;
  // YTD/All are dynamic / unbounded and stay always-enabled.
  const lookbackButtons = useMemo(
    () =>
      LOOKBACKS.map((l) => {
        const active = l === lookback;
        const disabled = LOOKBACK_RANK[l] < minLookbackRank;
        return (
          <button
            key={l}
            type="button"
            disabled={disabled}
            onClick={() => onLookbackChange(l)}
            title={disabled ? t('lookbackUnavailable') : undefined}
            className="text-2xs px-2 py-1 rounded transition-colors"
            style={{
              color: active
                ? 'var(--color-theme-text-tertiary)'
                : 'var(--color-theme-text-secondary)',
              fontWeight: active ? 600 : 400,
              backgroundColor: active ? 'var(--color-theme-input-bg)' : 'transparent',
              opacity: disabled ? 0.35 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {t(`lookback.${l}`)}
          </button>
        );
      }),
    [lookback, onLookbackChange, minLookbackRank, t],
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
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex rounded-md overflow-hidden border"
            style={{ borderColor: 'var(--color-theme-input-border)' }}
            role="group"
            aria-label={t('intervalGroup')}
          >
            {intervalPills}
          </div>
          <div className="flex gap-0.5" role="group" aria-label={t('lookbackGroup')}>
            {lookbackButtons}
          </div>
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
        {/* Top-left legend — OHLCV of hovered (or last) bar + clickable MA chips. */}
        {legend && (
          <div
            className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <div
              className="flex flex-wrap gap-x-3 gap-y-0.5 text-2xs px-2 py-1 rounded pointer-events-auto"
              style={{
                backgroundColor: withAlpha(readVar('--color-theme-card-bg') || '#1e1e1e', 0.85),
                color: 'var(--color-theme-text-secondary)',
                backdropFilter: 'blur(2px)',
              }}
            >
              <span style={{ color: 'var(--color-theme-text-tertiary)', fontWeight: 600 }}>
                {legend.date}
              </span>
              <span>O <b>{fmtPrice(legend.open)}</b></span>
              <span>H <b>{fmtPrice(legend.high)}</b></span>
              <span>L <b>{fmtPrice(legend.low)}</b></span>
              <span>C <b>{fmtPrice(legend.close)}</b></span>
              <span>V <b>{fmtVolume(legend.volume)}</b></span>
              <span
                style={{
                  color:
                    legend.pctChange == null
                      ? undefined
                      : legend.pctChange >= 0
                      ? 'var(--ssi-up)'
                      : 'var(--ssi-down)',
                  fontWeight: 600,
                }}
              >
                {fmtPct(legend.pctChange)}
              </span>
            </div>
            <div
              className="flex flex-wrap gap-1 text-2xs pointer-events-auto"
              role="group"
              aria-label={t('maGroup')}
            >
              {(['ma20', 'ma50', 'ma200', 'ma_volume_20'] as MAKey[]).map((key) => {
                const active = toggles[key];
                const value =
                  key === 'ma_volume_20'
                    ? null /* shown via the volume pane, no header value */
                    : key === 'ma20'
                    ? legend.ma20
                    : key === 'ma50'
                    ? legend.ma50
                    : legend.ma200;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMA(key)}
                    title={active ? t('maToggleHide') : t('maToggleShow')}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-opacity"
                    style={{
                      opacity: active ? 1 : 0.45,
                      backgroundColor: withAlpha(
                        readVar('--color-theme-card-bg') || '#1e1e1e',
                        0.85,
                      ),
                      color: 'var(--color-theme-text-secondary)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: 9999,
                        backgroundColor: active ? MA_COLORS[key] : 'transparent',
                        border: `1px solid ${MA_COLORS[key]}`,
                      }}
                    />
                    <span>{t(`ma.${key}`)}</span>
                    {value != null && <b>{fmtPrice(value)}</b>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
    </section>
  );
}
