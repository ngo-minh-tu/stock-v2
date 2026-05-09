---
id: c10
title: Stock Detail Candlestick Chart Architecture
parent: 00-tad-system-overview.md
type: component
source: cluster 3 reconciliation 2026-05-09 (post Fix #2 candlestick upgrade)
version: v1.3 LOCKED (cluster 3 reconciliation)
---

# c10 — Stock Detail Candlestick Chart

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f08-stock-detail.md](../srs/f08-stock-detail.md) Section 2
>
> Related — global: [g02-api.md](g02-api.md) (`GET /api/stocks/{ticker}/prices?interval&lookback`), [c09-theme-i18n.md](c09-theme-i18n.md) (theme switching pattern)

## Changelog

- **v1.3 (2026-05-09, cluster 3 reconciliation):** Initial spec từ prototype `CandlestickChart.tsx`. Reflects post-Fix#2 state (2-tier selector + MA overlays + crosshair legend) và post-Fix#3 (multiplicative price scaling).

---

## 1. Library

**Lightweight Charts v4.2.3** (canvas-based, ~40KB bundle, ~263KB First Load JS cho `/stock-detail`).

Lý do chọn (vs Recharts cho candlestick):
- Recharts SVG-based — render 1500 daily bars sẽ chậm, scale issue
- Lightweight Charts có built-in candlestick + volume + priceLine + crosshair API mature

KHÔNG dynamic import — bundle acceptable cho 1 page chuyên dụng, dynamic import thêm complexity skeleton state.

---

## 2. Chart Structure

### Series

| Series | priceScaleId | Use |
|---|---|---|
| `addCandlestickSeries` | `right` (default) | OHLC candles |
| `addHistogramSeries` (volume) | `'volume'` (custom scale) | Volume bars dưới candle pane |
| `addLineSeries` × 4 | 3 trên `right`, 1 trên `'volume'` | MA20 / MA50 / MA200 / MA Vol 20 |
| `series.createPriceLine` × 4 | (attached to candle series) | Support / Resistance / Stop Loss / Target — dashed |

### Pane layout via scaleMargins

```ts
chart.priceScale('right').scaleMargins = { top: 0.05, bottom: 0.30 };
volumeSeries.priceScale().applyOptions({
  scaleMargins: { top: 0.70, bottom: 0 },
});
```

→ Candle pane chiếm ~70% chiều cao trên, volume ~25% dưới (5% gap). Trước Fix #2, cả 2 fill 100% gây tràn wick xuống volume.

---

## 3. Theme Switching via MutationObserver

Lightweight Charts là canvas — KHÔNG follow CSS variables. Pattern:

```ts
const observer = new MutationObserver(() => {
  chart.applyOptions(buildLayoutOptions());     // bg, grid, text colors
  repaintData(barsRef.current);                  // candle up/down colors
  repaintOverlays(overlaysRef.current);          // S/R/SL/Target line colors
  repaintIndicators(indicatorsRef.current);      // MA series colors (data re-set)
});
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
```

`buildLayoutOptions()` đọc CSS vars từ `getComputedStyle(documentElement)`:
- `--color-theme-card-bg` → chart background
- `--color-theme-text-primary` → axis text
- `--color-theme-charcoal` → grid lines
- `--ssi-up` / `--ssi-down` → candle up/down colors

**Critical:** `repaintData/repaintOverlays/repaintIndicators` thành single path. Theme apply gọi lại cả 3 với `barsRef`/`overlaysRef`/`indicatorsRef` — trước Fix #2 chỉ apply layout + candle colors, volume tints + overlay colors bị stuck màu cũ.

KHÔNG re-mount chart → giữ zoom/pan state.

---

## 4. 2-Tier Selector (Interval + Lookback)

> [v1.3] Fix #2 — replace single `period` enum

### Type contract

```ts
type CandleInterval = 'D' | 'W' | 'M';
type CandleLookback = '1T' | '3T' | '6T' | '1N' | '3N' | 'YTD' | 'All';

GET /api/stocks/{ticker}/prices?interval=D&lookback=6T
→ StockPricesResponse { interval, lookback, bars: OhlcvBar[], indicators: PriceIndicators }
```

i18n: vi `1T/3T/6T/1N/3N/YTD/Tất cả` ↔ en `1M/3M/6M/1Y/3Y/YTD/All`. Tier 1 dùng D/W/M (English ngắn) thay vì "T" để tránh xung đột tier 2 `1T` (1 Tháng).

### Threshold-5 disable + auto-bump

```ts
const MIN_LOOKBACK_BY_INTERVAL = { D: '1T', W: '3T', M: '6T' };  // ≥5 bars guarantee
```

- Lookback button có `bars < 5` cho interval hiện tại → disabled (opacity 0.35, tooltip "Khoảng quá ngắn")
- User đổi interval → if lookback hiện tại < min của interval mới → `onLookbackChange(min)` TRƯỚC `onIntervalChange(next)` — tránh 1 frame render với combo invalid

Vd: D + 1T → click M → state cập nhật lookback=6T trước, sau đó interval=M → render M+6T (≥5 bars).

---

## 5. MA Overlays + Crosshair Legend

### MA series

4 lines, hardcoded hex (theme-agnostic):

| Series | Color | Default |
|---|---|---|
| MA20 | `#f7c948` amber | on |
| MA50 | `#4d96ff` sky blue | on |
| MA200 | `#ec6090` pink-red | **off** (rỗng trên monthly + clutter ở lookback ngắn) |
| MA Vol 20 | `#9aa4b2` gray | on |

`priceLineVisible: false`, `lastValueVisible: false`, `crosshairMarkerVisible: false` — không clutter axis.

### Toggle persist

State `{ ma20, ma50, ma200, ma_volume_20 }` persist `localStorage['stock-v2:candlestick-ma-toggles']`. Lazy init via `useState(readToggles)`. Apply visibility qua `series.applyOptions({ visible: bool })` (KHÔNG setData trống — giữ data).

### Crosshair-driven floating legend

```ts
chart.subscribeCrosshairMove((param) => {
  const idx = findBarIndex(param.time);
  setLegend({ date, ohlc, volume, pctChange, ma20, ma50, ma200 });
});
```

Mouse leave → fallback last bar. Bars effect cũng seed legend = last bar ngay từ render đầu.

JSX overlay top-left `position: absolute`:
- Hàng 1: Date + OHLCV + %change (xanh/đỏ tone). Background `withAlpha(card-bg, 0.85)` + `backdrop-filter: blur(2px)`
- Hàng 2: 4 chip toggle MA. Active = chấm đầy, inactive = chấm rỗng + opacity 0.45

`pointer-events-none` outer + `pointer-events-auto` inner → chart vẫn nhận hover trừ buttons.

---

## 6. Fixture Strategy (Frontend Mock)

> Backend MVP sẽ trả OHLCV thực từ vnstock. Frontend prototype dùng deterministic mock pattern dưới đây.

### 1500 daily padding

```ts
const BASE_DAYS = 1500;  // ~6 năm trading days
```

Sinh full daily series → cache theo `${ticker}:${currentPrice.toFixed(2)}`. Toggle interval D↔W↔M serve aggregation từ cùng base data.

### Aggregation D → W (ISO week) / M (YYYY-MM)

```ts
function aggregate(daily, interval) {
  // group bars theo week (ISO) hoặc month (YYYY-MM)
  // bucket: open=first.open, high=max, low=min, close=last.close, volume=sum
  // date = ngày bar cuối trong bucket (chart-friendly)
}
```

### Lookback → tail count

| Interval | 1T | 3T | 6T | 1N | 3N | YTD | All |
|---|---|---|---|---|---|---|---|
| D | 22 | 66 | 125 | 250 | 750 | scan ngược tới Jan 1 | full ~1250 |
| W | ÷5 | ÷5 | ÷5 | ÷5 | ÷5 | scan | full ~260 |
| M | ÷22 | ÷22 | ÷22 | ÷22 | ÷22 | scan | full ~60 |

### MA pre-computation (backend convention)

```ts
function computeSMA(values, period) {
  // Standard SMA, null cho period-1 entry đầu
}

// Tính trên FULL aggregated series TRƯỚC slice tail
// → window hiển thị thừa hưởng MA "warm" từ padding bars trái nó
// → D + 1T (22 bars) vẫn có MA200 đầy đủ thay vì rỗng 199 bars đầu
```

Frontend KHÔNG tính MA — backend trả pre-computed array trong `StockPricesResponse.indicators`. `null` cho bar không đủ history.

### Multiplicative price scaling (Fix #3)

```ts
const scale = currentPrice / closes[lastUnmodified];
closes = closes.map(c => c * scale);
scaledStartPrice = startPrice * scale;
```

Random walk 1500 ngày tự nhiên drift ~2.12x. Trước Fix #3, code overwrite chỉ bar cuối → tạo "cliff" ở mép phải, autoscale dãn trục Y rộng. Fix: scale ALL closes proportionally → preserve shape (volatility, % returns) chỉ đổi level → bar cuối tự nhiên = currentPrice → autoscale fit gọn.

---

## 7. Frontend Hook

```ts
// frontend/src/lib/hooks/useStockDetail.ts
useStockPrices(ticker, interval, lookback, reloadKey)
  → useApiResource<StockPricesResponse>(
      `/api/stocks/${ticker}/prices?interval=${interval}&lookback=${lookback}`,
      reloadKey
    );
```

Period switcher → refetch (KHÔNG client-side filter). Mỗi 1M/3M/6M/1Y trigger `useApiResource` mới với path khác → MSW gen lại OHLCV với seed khác → 1Y tail không trùng 6M tail (nếu client-side filter, tail luôn giống gây illusion "không đổi data").
