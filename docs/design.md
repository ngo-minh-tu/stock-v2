# SSI Design System

> Extracted from [ssi.com.vn](https://www.ssi.com.vn) — Công ty Cổ phần Chứng khoán SSI
> Version: iBoard v2.0.5.5 | Last updated: April 2026
> Project version: v1.4 (post-prototype reconciliation 2026-05-09)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ❌ REMOVED AG-Grid references (TAD §2 đã exclude AG-Grid; project dùng TanStack Table v8). Cập nhật §6.5 (Price Board Table styling) sang pattern TanStack Table + CSS variables. §10 Tech Stack: cập nhật Data Grid + Charts khớp với TAD §2 (TanStack + Recharts + Lightweight Charts). Line 43 type scale: "AG-Grid data" → "TanStack Table data".
- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ ADDED `--color-theme-tooltip-background` + `--color-theme-tooltip-border` vào cả 4 theme blocks (gap có từ cluster 1, lộ ở cluster 2 khi 8 chart components dùng). ➕ NEW §6.7 Chart Tooltips (chuẩn padding/border/shadow/blur), §6.8 Pie Center Label (donut hole pattern), §6.9 Radar Custom Tooltip (INWARD placement, polar geometry, dual-series). ➕ ADDED Toast Warning color `#f49f3b` (hardcoded brand alert).
- **v1.3 (2026-05-09, cluster 3 reconciliation):** ➕ NEW §6.10 Stock Detail Chart Patterns — gộp 4 patterns: Candlestick (Lightweight Charts MA colors + grid opacity + 2-tier selector + crosshair legend), AiScoreRing (tier-based color), RecommendationPill (soft-tinted vs Badge solid), StopLoss panel-frame card.
- **v1.4 (2026-05-09, cluster 4 reconciliation):** ➕ NEW §3.7 Exchange Tag Colors (`--exchange-hose` ssi-up green / `--exchange-hnx` ssi-floor blue / `--exchange-upcom` riêng). ➕ ADDED `--exchange-upcom` token vào 4 theme block (classic-dark + oled = `#c9a227` amber trầm; classic-light + light = `#e78b03` giữ tone cũ). ❌ §3.2 NOTE: UPCOM exchange badge KHÔNG dùng `--ssi-ref` (#fdff12 quá chói trên OLED + classic-dark — phát hiện cluster 4 post-fix 2026-05-08); ref yellow giữ cho TTCK reference price rule. ➕ §6.5 UPDATE Price Board Table — anchor prop on dynamic PriceCell, ceiling/floor BEFORE up/down clamp `>=`/`<=`, default sort `[close DESC]`, ExchangeBadge integration. ➕ NEW §6.11 NewsCard + SentimentChip pattern. ➕ NEW §6.12 SentimentSummaryWidget (CSS conic-gradient doughnut, KHÔNG Recharts pie). ➕ NEW §6.13 Source Error Banner (persistent, không dismissible). ➕ NEW §6.14 Mobile Filter Drawer (slide-in + overlay backdrop).
- **v1.4 (2026-05-09, cluster 5 reconciliation):** ➕ NEW §6.15 PortfolioKPI 4-card grid (PnL color signed). ➕ NEW §6.16 HoldingFormModal validation pattern (6 client-side rules + datalist max 8 + ESC + edit mode disable). ➕ NEW §6.17 RunHistoryTable MiniBars 3-bar + Compare button A/B label. ➕ NEW §6.18 ComparePanel 4-section grid (CompareSummary positiveIsGood, RecommendationChangesTable row tint, NewRemovedSection 2-col, ScoreHistogram 6-bucket). ➕ NEW §6.19 BacktestResultCard 4-metric + 2-series ROI chart. ➕ NEW §6.20 DeleteConfirmModal common pattern (used by holding + run + share).

---

## 1. Brand Identity

- **Brand Name:** Ngô Minh Tú
- **Tagline:** "Navigation data, the decision is yours" - Dữ liệu dẫn đường, quyết định thuộc về bạn
- **Industry:** Model AI Stock Trading
- **Founded:** April 2026, Ha Noi City, Vietnam

---

## 2. Typography

### Font Stack

| Context | Font Family | Fallback |
|---------|-----------|----------|
| **Primary** | `Roboto` | `sans-serif` |
| **System** | `system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial` | `sans-serif` |
| **Monospace** | `ui-monospace, SFMono-Regular, Consolas, Liberation Mono, Menlo` | `monospace` |
| **Legacy/Charts** | `Helvetica Neue, Helvetica, Arial` | `sans-serif` |

### Font Weights

| Weight | Token | Usage |
|--------|-------|-------|
| 300 | Light | Subtle labels, secondary info |
| 400 | Regular | Body text, table data |
| 500 | Medium | Section headers, modal titles |
| 700 | Bold | Emphasis, key metrics, CTA |
| 900 | Black | Hero numbers, brand accent |

### Type Scale

| Token | Size (rem) | Size (px) | Usage |
|-------|-----------|-----------|-------|
| `text-3xs` | 0.625 | 10 | Micro labels, timestamps |
| `text-2xs` | 0.688 | 11 | Price board cells, TanStack Table data |
| `text-xs` | 0.750 | 12 | Table data, small labels, footnotes |
| `text-sm` | 0.813 | 13 | Form labels, input text, buttons |
| `text-base` | 0.875 | 14 | Body text, descriptions |
| `text-md` | 0.938 | 15 | Modal titles, section headers |
| `text-lg` | 1.125 | 18 | Page subtitles |
| `text-xl` | 1.250 | 20 | Page titles |
| `text-2xl` | 1.500 | 24 | Hero sections |
| `text-3xl` | 1.563 | 25 | Dashboard KPIs |
| `text-4xl` | 1.875 | 30 | Featured numbers |

---

## 3. Color System

SSI sử dụng hệ thống 4 themes: **Classic** (dark purple), **OLED** (true black), **Light**, và theme aliasing qua `--color-theme-*` tokens.

### 3.1 Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **SSI Red / Crimson** | `#d32f2f` | Primary brand accent, CTAs, errors |
| **SSI Badge Red** | `#e80a32` | Badges, alerts, notifications |
| **SSI Buy Green** | `#1aa67c` | Buy signals, positive actions |
| **SSI Sell Red** | `#c9111f` | Sell signals, negative actions |
| **SSI Info Blue** | `#009bde` | Informational toasts, links |

### 3.2 Stock Market Semantic Colors

Đây là bảng màu đặc trưng cho thị trường chứng khoán Việt Nam:

| Semantic | Token | Classic | Light | OLED | Meaning |
|----------|-------|---------|-------|------|---------|
| **Ceiling (Trần)** | `text-ceil` | `#f23aff` | `#be00be` | `#fd02fd` | Giá trần — tím |
| **Up (Tăng)** | `text-up` | `#0bdf39` | `#078c54` | `#0bdf39` | Giá tăng — xanh lá |
| **Reference (Tham chiếu)** | `text-ref` | `#fdff12` | `#e78b03` | `#fdff12` | Giá tham chiếu — vàng |
| **Down (Giảm)** | `text-down` | `#ff0017` | `#ff0017` | `#ff0d0d` | Giá giảm — đỏ |
| **Floor (Sàn)** | `text-floor` | `#00c9ff` | `#088db7` | `#52d3f9` | Giá sàn — xanh dương |
| **Stable (Đứng giá)** | `text-stable` | `#dfe1e3` | `#1e2329` | `#d6d6d6` | Không đổi — trung tính |

> [v1.4] **UPCOM exchange badge KHÔNG dùng `--ssi-ref`** (#fdff12 quá chói trên OLED + classic-dark; phát hiện cluster 4 post-fix 2026-05-08). Giữ `--ssi-ref` cho TTCK reference price rule (PriceCell color rule); UPCOM exchange tag dùng `--exchange-upcom` riêng — xem §3.7.

### 3.3 Flash Colors (Price Board Highlights)

| Semantic | Token | Value | Usage |
|----------|-------|-------|-------|
| Flash Ceil | `flash-ceil` | `#fd02fd` | Bảng giá flash trần |
| Flash Up | `flash-up` | `#01a77a` | Bảng giá flash tăng |
| Flash Ref | `flash-ref` | `#d69000` | Bảng giá flash tham chiếu |
| Flash Down | `flash-down` | `#c0002e` | Bảng giá flash giảm |
| Flash Floor | `flash-floor` | `#0030cc` | Bảng giá flash sàn |
| Flash Stable | `flash-stable` | `#565759` | Bảng giá flash đứng giá |

### 3.4 Gradient Colors

| Token | Value | Usage |
|-------|-------|-------|
| `gradient-green` | `#01c27f` | Positive gradient, gain charts |
| `gradient-red` | `#ee3f3f` | Negative gradient, loss charts |
| `gradient-yellow` | `#e2b000` | Warning gradient, neutral charts |

### 3.5 Status & Feedback Colors

| Status | Token | Value | Usage |
|--------|-------|-------|-------|
| Success | `text-success` | `#0bdf39` / `#2e8e43` (light) | Lệnh khớp, giao dịch thành công |
| Fail | `text-fail` | `#ff0d0d` / `#d32f2f` (light) | Lệnh lỗi, giao dịch thất bại |
| Pending | `text-pending` | `#d69000` | Chờ khớp, đang xử lý |
| Cancel | `text-cancel` | `#969696` / `#8f8f8f` (light) | Đã hủy |
| Disabled | `text-disabled` | `#737373` / `#c1c1c1` (light) | Không khả dụng |

### 3.6 Toast Notifications

| Type | Token | Value |
|------|-------|-------|
| Default | `toast-background-default` | `#282637` / `#f4f4f4` (light) |
| Error | `toast-background-error` | `#d32f2f` |
| Info | `toast-background-info` | `#009bde` |
| Success | `toast-background-success` | `#3fa885` |
| Warning | `toast-background-warning` | `#f49f3b` |

### 3.7 Exchange Tag Colors (Cluster 4)

> [v1.4] Exchange badge cho HOSE / HNX / UPCOM dùng tokens **riêng**, KHÔNG reuse TTCK price tokens (`--ssi-ref` vàng quá chói cho UPCOM trên OLED + classic-dark). Tách biến để nâng cấp tone từng exchange độc lập với TTCK price rule.

| Exchange | Token | Classic Dark | OLED | Light | Classic Light | Source token mapping |
|---|---|---|---|---|---|---|
| **HOSE** | `--exchange-hose` | (alias) | (alias) | (alias) | (alias) | `var(--ssi-up)` xanh lá |
| **HNX** | `--exchange-hnx` | (alias) | (alias) | (alias) | (alias) | `var(--ssi-floor)` xanh dương |
| **UPCOM** | `--exchange-upcom` | `#c9a227` | `#c9a227` | `#e78b03` | `#e78b03` | **dedicated** (amber trầm cho dark, gold cho light) |

**Lý do tách `--exchange-upcom`:** prototype cluster 4 dùng `--ssi-ref` cho UPCOM badge → user report yellow #fdff12 chói trên OLED/classic-dark, không nhìn được chữ. Không thể đổi `--ssi-ref` vì biến này là TTCK reference yellow dùng khắp Price Board (5-color rule), GIU recommendation badge, run-history bars — và PRD §8.2 AC-17-03 yêu cầu ổn định cross-theme. Fix: tách biến mới chỉ cho exchange tag.

Used by: [SRS f05 §AC-05-08](srs/f05-price-board.md), `prototype/src/components/badges/ExchangeBadge.tsx`, Price Board exchange filter chips.

---

## 4. Theme Definitions

### 4.1 Classic Theme (Default Dark — Purple)

```css
:root, .theme-classic {
  /* === Surfaces === */
  --color-theme-primary:             #020210;   /* Deepest background */
  --color-theme-secondary:           #1c1a29;   /* Cards, panels */
  --color-theme-tertiary:            #282637;   /* Elevated surfaces */
  --color-theme-midnight:            #201d31;   /* Sub-backgrounds */
  --color-theme-onyx:                #2a263c;   /* Highlighted rows */
  --color-theme-charcoal:            #3f4160;   /* Borders, dividers */
  --color-theme-neutral:             #363645;   /* Subtle backgrounds */
  --color-theme-disabled:            #363645;   /* Disabled state bg */
  --color-theme-explain:             #292737;   /* Explanatory panels */
  --color-theme-highlight:           #6c697b;   /* Hover highlights */
  --color-theme-invert:              #3d3950;   /* Inverted accents */
  --color-theme-overlay:             #00000094;

  /* === Text === */
  --color-theme-text-primary:        #c1c1c1;   /* Body text */
  --color-theme-text-secondary:      #eaecef;   /* Emphasized text */
  --color-theme-text-tertiary:       #ffffff;   /* Headers, high emphasis */
  --color-theme-text-highlight:      #ffffff;   /* Active/hover text */
  --color-theme-text-invert:         #ffffff;
  --color-theme-text-dark:           #1e2329;
  --color-theme-text-explain:        #dfe1e3;

  /* === Interactive === */
  --color-theme-crimson:             #d32f2f;   /* Primary CTA */
  --color-theme-buy:                 #1aa67c;   /* Buy action */
  --color-theme-sell:                #c9111f;   /* Sell action */

  /* === Inputs === */
  --color-theme-input-background:    #1c1a29;
  --color-theme-input-border:        #3f4160;
  --color-theme-input-disabled:      #45444f;

  /* === Dropdowns === */
  --color-theme-dropdown-background: #3d3950;
  --color-theme-dropdown-active:     #6c697b;

  /* === Price Board === */
  --color-theme-price-board-menu:    #292737;
  --color-theme-price-table-border:  #353641;
  --color-theme-price-table-header:  #1c1a29;
  --color-theme-price-table-row-even:#171225;
  --color-theme-price-table-row-odd: #05040e;
  --color-theme-price-table-col-highlight: #2a263c;

  /* === Tables === */
  --color-theme-table-border:        #3f4160;
  --color-theme-table-header:        #383644;
  --color-theme-table-row-even:      #1c1a29;
  --color-theme-table-row-odd:       #282637;

  /* === Cards === */
  --color-theme-card-bg:             #282638;
  --color-theme-panel-background:    #282637;
  --color-theme-icon-bg:             #282638;

  /* === Tooltips (charts + custom) === [v1.3 cluster 2] */
  --color-theme-tooltip-background:  rgba(20, 18, 32, 0.96);
  --color-theme-tooltip-border:      rgba(255, 255, 255, 0.10);

  /* === Exchange tags === [v1.4 cluster 4] */
  --exchange-upcom:                  #c9a227;   /* amber trầm cho dark — không dùng --ssi-ref vì #fdff12 chói */

  /* === Filter === */
  --color-theme-filter-bg:           #403b58;
  --color-theme-filter-border:       #3f4160;
  --color-theme-filter-btn:          #312e42;
  --color-theme-filter-dropdown:     #1c1a29;
  --color-theme-filter-unselect:     #b0b0b0;

  /* === Misc === */
  --color-theme-scroll:              #aaaaaa80;
  --color-theme-switch:              #020210;
  --color-theme-tooltip-background:  #6c697b;
  --color-theme-tooltip-text-color:  (inherits text-tertiary);
}
```

### 4.2 Light Theme

```css
.theme-light {
  /* === Surfaces === */
  --color-theme-primary:             #ededed;
  --color-theme-secondary:           #ffffff;
  --color-theme-tertiary:            #f4f4f4;
  --color-theme-midnight:            #f4f4f4;
  --color-theme-onyx:                #e6e6e8;
  --color-theme-charcoal:            #848e9c;
  --color-theme-neutral:             #f5f6f7;
  --color-theme-disabled:            #ececee;
  --color-theme-explain:             #f4f4f4;
  --color-theme-highlight:           #f4f4f4;
  --color-theme-invert:              #e5e5e5;
  --color-theme-overlay:             #00000094;

  /* === Text === */
  --color-theme-text-primary:        #1e2329;
  --color-theme-text-secondary:      #8f8f8f;
  --color-theme-text-tertiary:       #1e2329;
  --color-theme-text-highlight:      #d32f2f;   /* ← SSI Red on light */
  --color-theme-text-invert:         #ffffff;
  --color-theme-text-dark:           #1e2329;
  --color-theme-text-explain:        #c1c1c1;

  /* === Interactive === */
  --color-theme-crimson:             #d32f2f;
  --color-theme-buy:                 #1aa67c;
  --color-theme-sell:                #c9111f;

  /* === Inputs === */
  --color-theme-input-background:    #fafbfc;
  --color-theme-input-border:        #dfe1e6;
  --color-theme-input-disabled:      #e3e3e3;

  /* === Dropdowns === */
  --color-theme-dropdown-background: #ffffff;
  --color-theme-dropdown-active:     #f4f4f4;

  /* === Price Board === */
  --color-theme-price-board-menu:    #ffffff;
  --color-theme-price-table-border:  #cacccd;
  --color-theme-price-table-header:  #f4f4f4;
  --color-theme-price-table-row-even:#f4f4f4;
  --color-theme-price-table-row-odd: #ffffff;
  --color-theme-price-table-col-highlight: #e5e5e5;

  /* === Tables === */
  --color-theme-table-border:        #dfe1e6;
  --color-theme-table-header:        #fafafa;
  --color-theme-table-row-even:      #f4f4f4;
  --color-theme-table-row-odd:       #ffffff;

  /* === Cards === */
  --color-theme-card-bg:             #ffffff;
  --color-theme-panel-background:    #ffffff;

  /* === Tooltips (charts + custom) === [v1.3 cluster 2] */
  --color-theme-tooltip-background:  rgba(255, 255, 255, 0.98);
  --color-theme-tooltip-border:      rgba(0, 0, 0, 0.10);

  /* === Exchange tags === [v1.4 cluster 4] */
  --exchange-upcom:                  #e78b03;   /* gold cho light — giữ tone cũ pre-fix */

  /* === Filter === */
  --color-theme-filter-bg:           #f8f8fb;
  --color-theme-filter-border:       #e5e5e5;
  --color-theme-filter-btn:          #e5e5e5;
  --color-theme-filter-dropdown:     #e5e5e5;
  --color-theme-filter-unselect:     #898989;

  /* === Misc === */
  --color-theme-scroll:              #aaaaaa80;
  --color-theme-switch:              #c7c7c7;
  --color-theme-tooltip-background:  #e2e2e2;
  --color-theme-tooltip-text-color:  #1e2329;
}
```

### 4.3 OLED Theme (True Black)

```css
.theme-oled {
  /* === Surfaces === */
  --color-theme-primary:             #020210;
  --color-theme-secondary:           #282828;
  --color-theme-tertiary:            #303030;
  --color-theme-midnight:            #3a3a3a;
  --color-theme-onyx:                #303030;
  --color-theme-charcoal:            #3d3b44;
  --color-theme-neutral:             #404245;
  --color-theme-disabled:            #404245;
  --color-theme-explain:             #3f3f3f;
  --color-theme-highlight:           #898989;
  --color-theme-invert:              #646464;
  --color-theme-overlay:             #00000094;

  /* === Text === */
  --color-theme-text-primary:        #c1c1c1;
  --color-theme-text-secondary:      #eaecef;
  --color-theme-text-tertiary:       #ffffff;
  --color-theme-text-highlight:      #ffffff;
  --color-theme-text-invert:         #ffffff;
  --color-theme-text-dark:           #1e2329;
  --color-theme-text-explain:        #dfe1e3;

  /* === Inputs === */
  --color-theme-input-background:    #282828;
  --color-theme-input-border:        #4d5259;
  --color-theme-input-disabled:      #424242;

  /* === Dropdowns === */
  --color-theme-dropdown-background: #505050;
  --color-theme-dropdown-active:     #737373;

  /* === Price Board === */
  --color-theme-price-board-menu:    #3f3f3f;
  --color-theme-price-table-border:  #3b3d41;
  --color-theme-price-table-header:  #282828;
  --color-theme-price-table-row-even:#05040e;
  --color-theme-price-table-row-odd: #05040e;
  --color-theme-price-table-col-highlight: #303030;

  /* === Tables === */
  --color-theme-table-border:        #3a3a3a;
  --color-theme-table-header:        #434343;
  --color-theme-table-row-even:      #313131;
  --color-theme-table-row-odd:       #282828;

  /* === Cards === */
  --color-theme-card-bg:             #323232;
  --color-theme-panel-background:    #313131;

  /* === Tooltips (charts + custom) === [v1.3 cluster 2] */
  --color-theme-tooltip-background:  rgba(10, 10, 10, 0.96);
  --color-theme-tooltip-border:      rgba(255, 255, 255, 0.14);

  /* === Exchange tags === [v1.4 cluster 4] */
  --exchange-upcom:                  #c9a227;   /* amber trầm — ssi-ref vàng quá chói trên OLED */

  /* === Filter === */
  --color-theme-filter-bg:           #505050;
  --color-theme-filter-border:       #505050;
  --color-theme-filter-btn:          #303030;
  --color-theme-filter-dropdown:     #303030;
  --color-theme-filter-unselect:     #b0b0b0;

  /* === Misc === */
  --color-theme-scroll:              #aaaaaa80;
  --color-theme-switch:              #020210;
  --color-theme-tooltip-background:  #737373;
}
```

### 4.4 Classic Light (Toggle Sáng cho Classic Theme)

Khi user chọn theme **Classic** rồi toggle sang chế độ Sáng, hệ thống áp palette `classic-light`: kế thừa surfaces sáng kiểu Light theme **nhưng có tint xanh dương nhẹ** (hue ~210°, B > R = G — cool blue) để giữ nhận dạng "Classic" mà không bị tối như tint tím. Accent crimson, buy/sell và TTCK colors giống Light variant. Mục đích: user toggle Sáng trong Classic theme vẫn cảm thấy đây là "Classic" chứ không lẫn với `light` (pure neutral grays).

```css
[data-theme='classic-light'] {
  /* === Surfaces (cool-blue-tinted, hue ~215°, saturation rõ rệt) === */
  --color-theme-primary:             #e3e9f2;   /* Cool blue-gray base */
  --color-theme-secondary:           #eff4fc;   /* Off-white cards/panels */
  --color-theme-tertiary:            #e5ecf5;   /* Elevated surfaces */
  --color-theme-midnight:            #e3e9f2;
  --color-theme-onyx:                #cfdaeb;   /* Highlighted rows */
  --color-theme-charcoal:            #a3b3c6;   /* Borders, dividers (most visible) */
  --color-theme-neutral:             #e8f0fa;
  --color-theme-disabled:            #d9e2ee;
  --color-theme-explain:             #e5ecf5;
  --color-theme-highlight:           #d2dee9;
  --color-theme-invert:              #becee0;

  /* === Text === */
  --color-theme-text-primary:        #1e2329;
  --color-theme-text-secondary:      #5a6068;
  --color-theme-text-highlight:      #d32f2f;   /* SSI crimson preserved */

  /* === Accents (Classic identity) === */
  --color-theme-crimson:             #d32f2f;
  --color-theme-buy:                 #1aa67c;
  --color-theme-sell:                #c9111f;

  /* === Inputs / Dropdowns / Tables / Cards === */
  --color-theme-input-background:    #eff4fc;
  --color-theme-input-border:        #b8c7da;
  --color-theme-dropdown-background: #eff4fc;
  --color-theme-table-header:        #e8eff8;
  --color-theme-table-row-even:      #e5ecf5;
  --color-theme-table-row-odd:       #eff4fc;
  --color-theme-card-bg:             #eff4fc;
  --color-theme-panel-background:    #eff4fc;

  /* === Tooltips (charts + custom) === [v1.3 cluster 2] */
  --color-theme-tooltip-background:  rgba(255, 255, 255, 0.98);
  --color-theme-tooltip-border:      rgba(0, 0, 0, 0.10);

  /* === Exchange tags === [v1.4 cluster 4] */
  --exchange-upcom:                  #e78b03;   /* gold cho light — giữ tone cũ pre-fix */

  /* TTCK colors === Light variant (giống §4.2) === */
}
```

**Khác biệt với Light theme (§4.2):** Light dùng pure neutral grays (`#ededed`, `#ffffff`, `#f4f4f4`, `#848e9c`); Classic Light shift hue sang ~215° (cool blue) với B cao hơn R/G ~15-20 units (saturation rõ rệt, không bị nhạt). Khác biệt **rõ ràng nhìn bằng mắt thường**, đặc biệt ở borders (`charcoal` `#a3b3c6` vs `#848e9c`) và surface fills (`card-bg` `#eff4fc` vs `#ffffff`). Không dùng tint tím (~270°) vì cảm giác tối hơn — cool blue tươi sáng và "Classic-tech" hơn.

---

## 5. Spacing & Layout

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | `0.125rem` (2px) | Tags, badges, small chips |
| `radius-md` | `0.25rem` (4px) | Buttons, inputs, cards, modals, dropdowns |
| `radius-lg` | `0.5rem` (8px) | Large cards, panels (ít dùng) |

> SSI thiên về giao diện vuông vắn, chuyên nghiệp. Hầu hết các component sử dụng `border-radius: 4px`.

### Shadow System

```css
--shadow-dropdown: 0px 3px 5px rgba(9, 30, 66, 0.2), 0px 0px 1px rgba(9, 30, 66, 0.31);
```

> SSI sử dụng rất ít shadow — chủ yếu cho dropdown menus và modals. Hệ thống dựa vào sự phân tầng màu nền (surface color hierarchy) thay vì elevation bằng shadow.

### Spacing Scale (Tailwind-based)

| Token | Value |
|-------|-------|
| `space-1` | `0.25rem` (4px) |
| `space-2` | `0.5rem` (8px) |
| `space-3` | `0.75rem` (12px) |
| `space-4` | `1rem` (16px) |
| `space-5` | `1.25rem` (20px) |
| `space-6` | `1.5rem` (24px) |

---

## 6. Component Patterns

### 6.1 Buttons

```css
/* Primary CTA — Crimson Red */
.btn-primary {
  background-color: var(--color-theme-crimson);    /* #d32f2f */
  color: #ffffff;
  border-radius: 0.25rem;
  font-size: 0.813rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
}

/* Buy Button */
.btn-buy {
  background-color: var(--color-theme-buy);        /* #1aa67c */
  color: #ffffff;
}

/* Sell Button */
.btn-sell {
  background-color: var(--color-theme-sell);       /* #c9111f */
  color: #ffffff;
}
```

### 6.2 Form Inputs

```css
.input-control {
  background-color: var(--color-theme-input-background);
  border: 1px solid var(--color-theme-input-border);
  border-radius: 0.25rem;
  font-size: 0.813rem;
  min-height: 2rem;
  padding: 0.25rem 0.5rem;
  color: var(--color-theme-text-primary);
}

.input-control:focus {
  border-color: var(--color-theme-crimson);
  outline: 2px solid transparent;
}

.input-control:disabled {
  background-color: var(--color-theme-input-disabled);
  cursor: not-allowed;
}
```

### 6.3 Modal / Dialog

```css
.modal .overlay {
  position: fixed;
  inset: 0;
  background-color: var(--color-theme-overlay);    /* #00000094 */
  z-index: 50;
}

.modal .modal-content {
  background-color: var(--color-theme-secondary);
  border-radius: 0.25rem;
  position: relative;
  text-align: left;
  width: 100%;
}

.modal .modal-header .modal-title {
  font-size: 0.938rem;
  font-weight: 500;
  color: var(--color-theme-text-tertiary);
  padding: 1.25rem 0;
}
```

### 6.4 Dropdown

```css
.dropdown-menu {
  background-color: var(--color-theme-dropdown-background);
  border-radius: 0.25rem;
  box-shadow: 0px 3px 5px rgba(9, 30, 66, 0.2),
              0px 0px 1px rgba(9, 30, 66, 0.31);
  color: var(--color-theme-text-tertiary);
}

.dropdown-item:hover {
  background-color: var(--color-theme-dropdown-active);
}
```

### 6.5 Price Board Table (TanStack Table v8)

> [v1.2] Replaces AG-Grid styling. TanStack Table là headless library — markup do React component control trực tiếp, không có default CSS class selectors như AG-Grid. Apply theme tokens qua React `style` prop hoặc Tailwind utilities.
>
> [v1.4] Cluster 4 update — 14-col spec, PriceCell 2-mode pattern, ExchangeBadge integration.

**Theme tokens vẫn áp dụng (đã defined trong §4.1, §4.2, §4.3, §4.4):**
- `--color-theme-price-table-header` — header row background
- `--color-theme-price-table-border` — cell borders
- `--color-theme-price-table-row-even` / `--color-theme-price-table-row-odd` — alternating rows
- `--color-theme-price-table-col-highlight` — sticky/highlighted column

**Component pattern (xem [PriceBoardTable.tsx](../prototype/src/components/price-board/PriceBoardTable.tsx) cluster 4):**

```tsx
// Header cell
<th
  className="text-2xs font-medium px-2 py-1"
  style={{
    backgroundColor: 'var(--color-theme-price-table-header)',
    borderColor: 'var(--color-theme-price-table-border)',
  }}
>{header}</th>

// Body row (alternating, with data-color-tag for a11y/QA)
<tr
  data-color-tag={priceColor(row.close, row.ceiling, row.floor, row.reference)}
  style={{
    backgroundColor: index % 2 === 0
      ? 'var(--color-theme-price-table-row-even)'
      : 'var(--color-theme-price-table-row-odd)',
  }}
>...</tr>

// Cell
<td className="text-2xs tabular-nums px-2 py-1">{value}</td>
```

**Typography:** font-size `text-2xs` (11px / 0.688rem) cho data cells, `tabular-nums` cho numeric alignment, Roboto antialiased.

**PriceCell 2-mode (cluster 4):**

```tsx
// Static — force token color (Reference/Ceiling/Floor/Open columns)
<PriceCell mode="static" fixedColor="ref" value={32.5} />

// Dynamic — apply priceColor() rule
<PriceCell mode="dynamic" value={row.close} anchor={row.close}
  ceiling={row.ceiling} floor={row.floor} reference={row.reference} />

// Dynamic with anchor decoupled — Change/Change% color match Close, value displays change
<PriceCell mode="dynamic" value={row.change} anchor={row.close}
  ceiling={row.ceiling} floor={row.floor} reference={row.reference} />
```

**Color rule** (xem [SRS g03 §O priceColor()](srs/g03-appendix-enums-constants.md)):

```ts
// ORDER MATTERS — ceiling/floor BEFORE up/down
if (price >= ceiling) return 'ceil';   // var(--ssi-ceil) tím
if (price <= floor)   return 'floor';   // var(--ssi-floor) xanh dương
if (price === reference) return 'ref';  // var(--ssi-ref) vàng
if (price > reference)   return 'up';   // var(--ssi-up) xanh lá
return 'down';                          // var(--ssi-down) đỏ
```

Dùng `>=`/`<=` (KHÔNG `===` strict) cho ceiling/floor để robust với rounding 2dp.

**Default sort:** `[{ id: 'close', desc: true }]` — Close DESC. TanStack Table accept initial state này.

**ExchangeBadge integration** (cột "Sàn" + filter chips dùng chung):

```tsx
<ExchangeBadge exchange="UPCOM" />  // dùng var(--exchange-upcom) — KHÔNG --ssi-ref
```

Xem §3.7 cho color tokens. UPCOM tách `--exchange-upcom` riêng vì `--ssi-ref` (#fdff12) chói trên badge nhỏ.

### 6.6 Toast Notifications

```css
.toast {
  font-family: var(--toastify-font-family);
  border-radius: 0.25rem;
}

.toast-success { background-color: #3fa885; }
.toast-error   { background-color: #d32f2f; }
.toast-info    { background-color: #009bde; }
.toast-warning { background-color: #f49f3b; }   /* hardcoded brand alert — không qua theme */
.toast-default { background-color: var(--color-theme-toast-background-default); }
```

> [v1.3] Toast warning `#f49f3b` được hardcoded (không qua CSS variable) vì là **brand alert intent color** — phải nhất quán qua 4 theme. Kiểm tra contrast OK với cả dark/light backgrounds.

### 6.7 Chart Tooltips (Recharts custom + radar custom)

> [v1.3] Cluster 2 — chuẩn pattern cho 8 chart components

```css
.chart-tooltip {
  background-color: var(--color-theme-tooltip-background);
  border: 1px solid var(--color-theme-tooltip-border);
  border-radius: 0.375rem;     /* 6px — match shadow-md */
  padding: 8px 12px;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);  /* shadow-lg */
  backdrop-filter: blur(2px);
  pointer-events: none;
}
```

**Recommendation color sync** (Treemap, Pie center label):
- Khi hover ô / slice có `recommendation`, set `color = recommendationColor(rec)` (xem [TAD c05 §3](tad/c05-dashboard.md))
- 3 dòng tooltip (ticker / rec+score / extra info) cùng màu, dòng cuối `opacity: 0.85` cho hierarchy

**Recharts disable defaults:**
- `<Tooltip isAnimationActive={false} animationDuration={0} contentStyle={{ transition: 'none' }} wrapperStyle={{ transition: 'none', pointerEvents: 'none' }} />` — chống tooltip "trôi" theo cursor
- Nếu cần custom hover positioning (Radar, Pie center) → bỏ hẳn `<Tooltip>`, tự render overlay div

### 6.8 Pie Center Label (Donut Hole Pattern)

> [v1.3] Cluster 2 — Recommendation pie ở Dashboard

Donut hole (`innerRadius=50%, outerRadius=72%`) chứa label cố định ở tâm:

```tsx
<div className="relative">
  <ResponsiveContainer>
    <PieChart>...</PieChart>
  </ResponsiveContainer>
  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
       style={{ paddingBottom: 24 }}>  {/* bù legend dưới đáy */}
    {activeIndex === null ? (
      <>
        <div className="text-2xs uppercase tracking-wider opacity-70">Tổng</div>
        <div className="text-2xl font-bold">{total}</div>
        <div className="text-2xs opacity-70">mã</div>
      </>
    ) : (
      <div style={{ color: recommendationColor(slice.name) }}>
        <div className="text-2xs">{slice.name}</div>
        <div className="text-2xl font-bold">{slice.value}</div>
        <div className="text-2xs opacity-85">{percent}% · trên {total} mã</div>
      </div>
    )}
  </div>
</div>
```

**Critical:** `pointer-events-none` trên overlay để KHÔNG chặn mouse events vào pie bên dưới (nếu có pointer-events, hover detection trên pie sẽ vỡ).

**Lý do bỏ recharts default `<Tooltip>`:** popup bám cursor → khi hover gần tâm donut, tooltip đè trực tiếp lên ring → mất thẩm mỹ. Center label cố định ở vị trí tâm → không bao giờ chèn ring.

### 6.9 Radar Custom Tooltip (INWARD Placement)

> [v1.3] Cluster 2 — file `prototype/src/components/charts/radar-tooltip.tsx`

**Vấn đề với recharts default `<Tooltip>` trong RadarChart:**
- Polygon-area hover detection → mỗi mousemove là 1 reposition → "nhảy lung tung"
- OUTWARD placement (đẩy ra ngoài polygon) → đè vào PolarAngleAxis labels ("Sentiment", "Technical"…)

**Pattern fix — INWARD placement:**

1. **Custom dot factory:** mỗi axis vertex render visible dot (r=4, viền theme-aware) + invisible hitbox circle (r=14, `pointerEvents="all"`) cho dễ hover
2. **Hover state:** `{x, y, dx, dy, axis, value, color, seriesName}` — `(dx, dy)` là unit vector từ tâm chart hướng OUT theo polar geometry
3. **Tooltip position:** `tx = x - dx*offset, ty = y - dy*offset` (đẩy INWARD vào tâm polygon thay vì OUT)
4. **Anchor động:** translate dựa vào `(dx, dy)` threshold 0.3 — `dx > 0.3 → translateX(-100%)` (tooltip bên trái dot), `dx < -0.3 → translateX(0%)` (bên phải), else center
5. **PolarRadiusAxis angle = 45°** (KHÔNG 90°) → radius labels (0/25/50/75/100) ở góc chéo upper-right, nằm ngoài đường inward của tất cả dots
6. **Custom outward tick** cho PolarAngleAxis labels: push thêm 6px ra ngoài để không sát polygon → tooltip inward không đè

**Dual-series support** (Stock Detail radar — cluster 3):
- Mỗi `<Radar>` series có dot factory riêng (e.g. `renderTickerDot` color = `--ssi-up`, `renderIndustryDot` color = `--text-secondary`)
- Hover ticker dot → tooltip ticker; hover industry dot → tooltip industry; không show cả 2 cùng lúc

**Lợi thiết kế:**
- Tooltip position là **pure function** của (cx, cy, axis index, total axes) → identical mỗi lần hover cùng dot, không "trôi"
- Không có `mousemove` listener — chỉ enter/leave per dot
- Polygon interior thường trống (values < 100) → tooltip với background đặc che grid lines clean

### 6.10 Stock Detail Chart Patterns

> [v1.3] Cluster 3 — gộp 4 patterns trong Stock Detail page

#### Candlestick (Lightweight Charts v4)

**MA overlay colors** (hardcoded hex, theme-agnostic — chosen distinct với up/down/S/R):

| MA | Color | Use |
|---|---|---|
| MA20 | `#f7c948` amber | Short-term trend |
| MA50 | `#4d96ff` sky blue | Mid-term trend |
| MA200 | `#ec6090` pink-red | Long-term trend |
| MA Volume 20 | `#9aa4b2` gray | Volume baseline |

**Grid styling:** `withAlpha(grid_color, 0.12)` — gridline opacity 12% (giống TradingView, chart "thoáng" hơn).

**2-tier selector** UI:
- Tier 1 (interval): segmented pill `D | W | M`. Active = `var(--color-theme-crimson)` border + bg
- Tier 2 (lookback): row text button 7 values. Disabled = opacity 0.35

**Crosshair legend** (top-left chart, floating overlay):
- Background `withAlpha(card-bg, 0.85)` + `backdrop-filter: blur(2px)`
- 2 hàng: hàng 1 OHLCV + %change (xanh/đỏ tone), hàng 2 4 chip MA toggle
- Active chip = chấm tròn đầy + opacity 1; inactive = chấm rỗng + opacity 0.45

#### AiScoreRing (Stock Detail Header)

SVG donut ring với tier-based color:

| Score range | Color |
|---|---|
| ≥ 70 | `var(--ssi-up)` xanh |
| 40-69 | `var(--ssi-ref)` amber/vàng |
| < 40 | `var(--ssi-down)` đỏ |

Layout: number lớn ở center + "AI Score" label nhỏ dưới. Stroke-width tỷ lệ với score (visual fill).

#### RecommendationPill (Header) vs RecommendationBadge (Tables)

| Component | Where | Style |
|---|---|---|
| `<RecommendationPill>` | Stock Detail Header (calmer) | Soft-tinted bg (alpha 0.15-0.20 của recommendation color) + 1px hue border + status dot `•` + label MUA/GIỮ/BÁN |
| `<RecommendationBadge>` | Tables (TopMUA, RedFlags, etc.) | Solid background recommendation color + white text label (chip standard) |

→ KHÔNG dùng RecommendationBadge trong Stock Detail header — đè visual quá mạnh trên 1 line nhiều thông tin.

#### StopLoss Panel-Frame Card (RiskPanel Section 5)

Centered layout (vs label/value stacking lỏng cũ):

```
┌──────────────────────┐
│   ⌄ Cắt lỗ tại       │  ← chevron caption
│                       │
│      29.250          │  ← big red price (var(--ssi-down))
│                       │
│      [-10%]          │  ← distance pill
│   ─────              │  ← gap-track visual
│  buy_price × 0.90    │  ← calc note
└──────────────────────┘
```

Big price: `tabular-nums`, size lớn (~text-3xl), color `var(--ssi-down)`.
Distance pill: rounded-full, bg `withAlpha(ssi-down, 0.15)`, text `var(--ssi-down)`, padding 2px 8px.
Gap-track: `<hr>` 1px gray, opacity 0.3, margin top 8px.

### 6.11 NewsCard + SentimentChip (Cluster 4)

> [v1.4] Component pattern cho `<NewsCard>` ở News page.

**Card structure:**

```
┌────────────────────────────────────────────────┐
│ ┃ [C] CafeF · 2 giờ trước              ↗       │  ← header
│ ┃                                              │
│ ┃ Tiêu đề bài viết (link new tab)              │  ← title 2-line clamp
│ ┃                                              │
│ ┃ Snippet 2 dòng giới thiệu nội dung bài...    │  ← snippet opacity 0.7
│ ┃                                              │
│ ┃ [▲ POSITIVE] [KDH] [VHM]                     │  ← footer chips
└────────────────────────────────────────────────┘
  ↑ border-left 3px theo SENTIMENT_BORDER_TINT[label]
```

**Border-left** 3px solid:
| Label | Color |
|---|---|
| POSITIVE | `var(--ssi-up)` xanh lá |
| NEUTRAL | `var(--ssi-ref)` vàng (or stable nếu cần dịu hơn) |
| NEGATIVE | `var(--ssi-down)` đỏ |

**Header row** (flex, gap 8px):
- `<SourceLogo>` initials box (5 fixed colors: C/V/S/B/T) — `size-6 rounded text-xs font-bold`
- Source name — `text-xs`
- Relative time — `text-xs opacity-70`, qua i18n keys `news.time.{minutesAgo|hoursAgo|daysAgo|weeksAgo}` (KHÔNG hard-code chuỗi vi/en)
- Open-link icon (Lucide `ExternalLink`) — `size-3.5 opacity-60`, click → `window.open(url, '_blank')`

**Title:** `<a target="_blank" rel="noopener noreferrer">`, `text-base font-medium line-clamp-2`.

**Snippet:** `text-sm opacity-70 line-clamp-2`.

**Footer:** `<SentimentChip>` + ticker chips (`<TickerChip>` click → `/stock-detail?ticker=X`).

**`unavailable` reason:** khi `sentiment_reason === "unavailable"` → render italic note "Lý do không khả dụng" thay cho default citation.

**`<SentimentChip>` pattern:**

```tsx
<span className={`
  inline-flex items-center gap-1 px-2 py-0.5 rounded-full
  text-xs font-medium border
`} style={{
  color: SENTIMENT_COLOR[label],
  borderColor: withAlpha(SENTIMENT_COLOR[label], 0.4),
  backgroundColor: withAlpha(SENTIMENT_COLOR[label], 0.1),
}}>
  {label === 'POSITIVE' && <TrendingUp size={12} />}
  {label === 'NEUTRAL'  && <Minus size={12} />}
  {label === 'NEGATIVE' && <TrendingDown size={12} />}
  {label}
</span>
```

**Tooltip:** `Score: {score} ({label})` (xem cluster prompt §4.3).

### 6.12 Sentiment Summary Doughnut — CSS Conic-Gradient (Cluster 4)

> [v1.4] Pattern cho `<SentimentSummaryWidget>` khi user filter ticker. **KHÔNG dùng Recharts pie** — overhead lớn cho chart 3 slice; conic-gradient pure CSS.

```tsx
<div className="relative size-32 rounded-full"
  style={{
    background: `conic-gradient(
      var(--ssi-up)   0%        ${posPct}%,
      var(--ssi-ref)  ${posPct}% ${posPct + neuPct}%,
      var(--ssi-down) ${posPct + neuPct}% 100%
    )`,
  }}
>
  {/* inset white circle cho doughnut effect */}
  <div className="absolute inset-3 rounded-full
    bg-[var(--color-theme-card-bg)]
    flex items-center justify-center flex-col">
    <span className="text-2xs opacity-70">avg</span>
    <span className="text-lg font-bold">{scoreAvg.toFixed(2)}</span>
  </div>
</div>
```

**Theme awareness:** CSS var `--ssi-up/ref/down` resolve theo `[data-theme]` parent → re-render khi theme đổi tự động, không cần React re-render.

**count=0 case (GUARD-08):** thay vì render empty doughnut → render italic note "Không có tin trong 30 ngày — sentiment NEUTRAL/0.0".

**Source breakdown bar** (bên dưới doughnut):
- Horizontal bar 5-segment, mỗi segment width tỷ lệ với count, color theo source palette (5 màu fixed C/V/S/B/T).
- Legend 5 row dưới bar.

### 6.13 Source Error Banner (Cluster 4)

> [v1.4] Persistent banner, **không dismissible**.

```tsx
<div className="flex items-center gap-2 px-4 py-3 rounded
  border-l-4 mb-4"
  style={{
    backgroundColor: withAlpha(toastWarning, 0.12),  // #f49f3b @ 12%
    borderLeftColor: toastWarning,
    color: 'var(--color-theme-text-secondary)',
  }}
>
  <AlertCircle size={16} className="shrink-0"
    style={{ color: toastWarning }} />
  <span className="text-sm">
    Nguồn {sourceNames.join(', ')} tạm thời không khả dụng.
    Đã hiển thị tin từ các nguồn còn lại.
  </span>
</div>
```

**Why không dismissible:** user cần biết coverage thiếu trong suốt session. Dismiss → user mất context và tưởng đã thấy đủ tin.

**Color choice:** dùng toast warning tone (`#f49f3b`) thay `var(--ssi-down)` đỏ vì source down ≠ critical error — chỉ là partial degradation.

### 6.14 Mobile Filter Drawer (Cluster 4)

> [v1.4] Pattern slide-in drawer cho mobile <768px.

**Trigger:** filter button trong page header (visible chỉ khi `md:hidden`).

**Drawer layout:**

```tsx
{drawerOpen && (
  <>
    {/* Overlay backdrop */}
    <div
      className="fixed inset-0 z-40 bg-black/50 md:hidden"
      onClick={() => setDrawerOpen(false)}
    />
    {/* Drawer */}
    <aside
      className={`
        fixed top-0 right-0 z-50 h-screen w-80
        translate-x-0 transition-transform duration-200
        md:hidden overflow-y-auto
      `}
      style={{ backgroundColor: 'var(--color-theme-card-bg)' }}
    >
      <header className="flex items-center justify-between p-4 border-b">
        <h2 className="text-md font-medium">Bộ lọc</h2>
        <button onClick={() => setDrawerOpen(false)}>
          <X size={20} />
        </button>
      </header>
      <div className="p-4">
        {/* same FilterPanel content as desktop sticky aside */}
      </div>
    </aside>
  </>
)}
```

**Width:** 320px (`w-80`) — đủ chỗ cho 5 filter section, không quá rộng để cover toàn bộ screen.

**Animation:** `transition-transform duration-200` cho slide effect; entry from `translate-x-full` → exit cleanup.

**Z-index:** backdrop `z-40`, drawer `z-50` để drawer luôn trên backdrop.

**Close triggers:** click backdrop / click X button / press ESC (key listener bên ngoài).

### 6.15 PortfolioKPI 4-card Grid (Cluster 5)

> [v1.4] Pattern cho 4 KPI cards ở `/portfolio` page.

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <KpiCard label="Tổng vốn" value={formatVnd(totalCost, 'raw')} />
  <KpiCard label="Giá trị hiện tại" value={formatVnd(currentValue, 'raw')} />
  <KpiCard
    label="Lãi/lỗ"
    value={formatVnd(pnl, 'raw')}
    hint={`${pnl_pct.toFixed(2)}%`}
    color={pnl > 0 ? 'var(--ssi-up)' : pnl < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)'}
  />
  <KpiCard label="Số mã" value={count.toString()} />
</div>
```

**P&L color signed rule:**
- `pnl > 0` → `var(--ssi-up)` xanh lá
- `pnl < 0` → `var(--ssi-down)` đỏ
- `pnl === 0` → `var(--ssi-stable)` neutral

**Hint** (dòng dưới value): pnl_pct với 2dp signed. Apply same color theo pnl sign.

**KpiCard pattern:**

```tsx
<div className="rounded-md p-4"
  style={{ backgroundColor: 'var(--color-theme-card-bg)' }}>
  <div className="text-xs opacity-70">{label}</div>
  <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
  {hint && <div className="text-xs mt-1" style={{ color }}>{hint}</div>}
</div>
```

### 6.16 HoldingFormModal (Cluster 5)

> [v1.4] Add/edit shared modal pattern cho Portfolio.

**Layout structure:**

```
┌────────────────────────────────────┐
│ "Thêm mã" / "Sửa {ticker}"     [X] │
├────────────────────────────────────┤
│ Ticker  [____] (datalist max 8)    │  ← edit: disabled
│ Số lượng [____]                    │
│ Giá mua  [____] ngàn đồng           │
│ Ngày mua [____] (max=TODAY)         │
│ Ghi chú  [________________]         │
│                                     │
│ [Inline error message nếu có]      │
│                                     │
│        [Hủy]  [Lưu]                │
└────────────────────────────────────┘
```

**Auto-focus:** `useRef + .focus()` trong useEffect:
- Add mode → ticker input
- Edit mode → save button (user thường chỉ đổi qty/price)

**Edit mode:** ticker input `disabled` (không cho đổi mã, chỉ qty/price/date/notes).

**Datalist:**

```tsx
<input list="ticker-suggestions" />
<datalist id="ticker-suggestions">
  {STOCK_FIXTURE.slice(0, 8).map(s => (
    <option key={s.ticker} value={s.ticker}>{s.name}</option>
  ))}
</datalist>
```

Max 8 suggestion để tránh dropdown dài; user gõ thêm để filter native HTML.

**ESC + backdrop close:** key listener trên window + onClick backdrop. Hủy button cùng handler.

**Validation flow:**
1. Client-side check 6 rules → set inline error → return early.
2. Submit POST/PUT → server validate cùng rules.
3. Server error → display inline + toast.
4. Server success → close modal + toast + reload.

### 6.17 RunHistoryTable Patterns (Cluster 5)

> [v1.4] MiniBars + Compare button A/B label.

**MiniBars 3-bar pattern (cột MUA/GIỮ/BÁN):**

```tsx
function MiniBars({ buy, hold, sell }: { buy: number; hold: number; sell: number }) {
  const max = Math.max(buy, hold, sell, 1);
  const widths = {
    buy:  `${(buy  / max) * 100}%`,
    hold: `${(hold / max) * 100}%`,
    sell: `${(sell / max) * 100}%`,
  };
  return (
    <div className="flex flex-col gap-0.5 w-20">
      <Bar width={widths.buy}  color="var(--ssi-up)"   value={buy}  />
      <Bar width={widths.hold} color="var(--ssi-ref)"  value={hold} />
      <Bar width={widths.sell} color="var(--ssi-down)" value={sell} />
    </div>
  );
}

function Bar({ width, color, value }) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 rounded-full" style={{ width, backgroundColor: color }} />
      <span className="text-2xs tabular-nums opacity-80">{value}</span>
    </div>
  );
}
```

**Compare button A/B label visual:**

```tsx
{isSelectedA && <span className="bg-crimson text-white px-1.5 rounded">A</span>}
{isSelectedB && <span className="bg-info text-white px-1.5 rounded">B</span>}
{!isSelected && <ArrowLeftRight size={14} />}  // default icon
```

Border tone:
- A: `border-color: var(--color-theme-crimson)`
- B: `border-color: var(--ssi-info)`

### 6.18 ComparePanel 4-section Grid (Cluster 5)

> [v1.4] Pattern cho ComparePanel khi A và B đã chọn.

**Layout:**

```
┌─────────────────────────────────┐
│ "So sánh A vs B"            [X] │  ← header
├─────────────────────────────────┤
│ §1 Summary table (4-col)        │  ← 6 row metrics
├─────────────────────────────────┤
│ §2 Recommendation changes        │  ← TanStack 6-col, row tint
├─────────────────────────────────┤
│ §3 New (left) | Removed (right) │  ← md:grid-cols-2
├─────────────────────────────────┤
│ §4 Score histogram (Recharts)   │
└─────────────────────────────────┘
```

**§1 CompareSummary positiveIsGood color:**

```tsx
function deltaColor(delta: number, positiveIsGood: boolean | null): string {
  if (positiveIsGood === null) return 'var(--ssi-stable)';
  if (delta === 0) return 'var(--ssi-stable)';
  const isPositive = delta > 0;
  const isGood = positiveIsGood === isPositive;
  return isGood ? 'var(--ssi-up)' : 'var(--ssi-down)';
}
```

| Metric | positiveIsGood |
|---|---|
| scored | true |
| buy_count | true |
| sell_count | **false** (bug fix: tăng SELL ≠ tốt) |
| hold_count | null (neutral) |
| avg_score | true |
| duration_seconds | **false** (longer = slower) |

**§2 Row tint (RecommendationChangesTable):**

```tsx
<tr style={{
  backgroundColor: row.direction === 'upgrade'
    ? withAlpha('var(--ssi-up)', 0.08)
    : withAlpha('var(--ssi-down)', 0.08)
}}>
```

Sort: upgrade-first → delta magnitude DESC.

**§3 NewRemovedSection** — `<div className="grid md:grid-cols-2 gap-4">` 2 card. Each card: title `"{count} mã"`, list scrollable.

**§4 ScoreHistogram** — Recharts `<BarChart>` 2 series:

```tsx
<Bar dataKey="a_count" fill="var(--ssi-up)"   name={`Run A`} />
<Bar dataKey="b_count" fill="var(--ssi-info)" name={`Run B`} />
```

X-axis: 6 bucket labels (`<30 / 30-45 / 45-60 / 60-75 / 75-90 / ≥90`). Y-axis: count.

### 6.19 BacktestResultCard (Cluster 5)

> [v1.4] Result card với 4 metric + ROI chart + detail toggle.

**Header:**
```
backtest_id · period_from → period_to · {correct}/{total} đúng
```

**4 metric cards:**

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  <MetricCard
    label="Độ chính xác"
    value={`${(accuracy * 100).toFixed(1)}%`}
    valueClass="text-3xl"
    color={accuracy >= 0.6 ? 'var(--ssi-up)' : 'var(--ssi-down)'}
  />
  <MetricCard label="Sai số giá TB" value={`${priceError.toFixed(1)}%`} />
  <MetricCard
    label="ROI Danh mục" value={`${signed(portfolioRoi)}%`}
    color={portfolioRoi >= 0 ? 'var(--ssi-up)' : 'var(--ssi-down)'}
  />
  <MetricCard
    label="Alpha" value={`${signed(alpha)}%`}
    hint="Outperformance"
    color={alpha >= 0 ? 'var(--ssi-up)' : 'var(--ssi-down)'}
  />
</div>
```

**Accuracy threshold rule:** ≥60% → green; <60% → red. UI hint user về model effectiveness.

**ROI Chart (BacktestRoiChart):**

```tsx
<LineChart data={roi_curve}>
  <Line dataKey="portfolio" stroke="var(--ssi-up)"   name="Danh mục" />
  <Line dataKey="vnindex"   stroke="var(--ssi-info)" name="VN-Index" />
  <YAxis tickFormatter={(v) => `${v}%`} />
</LineChart>
```

Gap giữa 2 line ≈ alpha (visualization).

**Toggle "Xem chi tiết X mã"** → expand `<BacktestDetailTable>` bên dưới.

### 6.20 DeleteConfirmModal — Common Pattern (Cluster 5+)

> [v1.4] Pattern dùng chung cho Delete Holding (cluster 5), Delete Run (cluster 5), Revoke Share (cluster 6).

**Layout:**

```tsx
<Modal>
  <header>
    <h2 className="text-md font-medium">{title}</h2>
  </header>
  <div className="p-4 space-y-3">
    <p>Bạn có chắc muốn xóa <strong>{interpolation}</strong>?</p>
    {warning && (
      <p className="text-xs opacity-70">{warning}</p>
    )}
  </div>
  <footer className="flex justify-end gap-2 p-4">
    <button onClick={onCancel}>Hủy</button>
    <button
      onClick={onConfirm}
      style={{ backgroundColor: 'var(--ssi-down)', color: 'white' }}
      className="rounded px-3 py-1.5"
    >
      {confirmLabel ?? 'Xóa'}
    </button>
  </footer>
</Modal>
```

**Variants:**
| Use case | Title | Interpolation | Warning |
|---|---|---|---|
| Delete holding | "Xóa khỏi danh mục" | `<ticker>` | — |
| Delete run | "Xóa run" | `<run_id>` | "Hành động này không thể hoàn tác. Toàn bộ dữ liệu run + scored results sẽ bị xóa vĩnh viễn." |
| Revoke share | "Thu hồi link" | `<token prefix>...` | "Người đã có link sẽ không thể truy cập nữa." |

**ESC + Cancel handler:** cùng `onCancel` callback.

**Confirm button:** ssi-down red (visual hint destructive action).

---

## 7. Data Visualization Colors

### Chart Bar Colors

| Type | Token | Classic/OLED | Light |
|------|-------|-------------|-------|
| Bar Buy | `bar-buy` | `#0bdf39` | `#078c54` |
| Bar Sell | `bar-sell` | `#c9111f` | `#c9111f` |
| Bar Warning | `bar-warning` | `#fdff12` | `#e78b03` |

### Gradient Palette for Charts

```css
/* Positive */
background: linear-gradient(to top, transparent, #01c27f);

/* Negative */
background: linear-gradient(to top, transparent, #ee3f3f);

/* Neutral/Warning */
background: linear-gradient(to top, transparent, #e2b000);
```

---

## 8. Navigation & Menu Structure

### Header Menu (Corporate)

```
Khách hàng cá nhân
├── Tổng quan
├── Trung tâm kiến thức
├── Sản phẩm
├── Trung tâm phân tích
├── Dịch vụ
├── Tin tức
└── Hỗ trợ

Khách hàng tổ chức
├── Dịch vụ chứng khoán
├── Dịch vụ thị trường vốn
├── Dịch vụ thị trường nợ
├── Tư vấn M&A
├── Tư vấn tài chính doanh nghiệp
└── Dịch vụ ủy thác đầu tư KHTC

Về SSI | Quan hệ nhà đầu tư | Cơ hội nghề nghiệp
Ngôn ngữ: Vi | En | 简体中文 | 日本語
```

### iBoard Themes

```
Giao diện: Sáng (Light) | Tối (Classic) | OLED
```

---

## 9. Accessibility Notes

- Light theme sử dụng contrast cao: text `#1e2329` trên nền `#ffffff`
- Dark themes cần lưu ý: text `#c1c1c1` trên nền `#1c1a29` có thể không đạt WCAG AAA
- Màu ceil (`#f23aff`) và floor (`#00c9ff`) đủ saturated để phân biệt trên cả dark lẫn light
- Overlay sử dụng `rgba(0,0,0,0.58)` — đủ tối để tách modal khỏi nền

---

## 10. Tech Stack & Frameworks

> [v1.2] Tách 2 cột: SSI iBoard inspiration vs **VN RE AI Screener (project thực)**. Project KHÔNG dùng AG-Grid hay Highcharts — xem TAD 00 §2 để chốt cuối.

| Layer | SSI iBoard (inspiration) | VN RE AI Screener (project) |
|-------|--------------------------|------------------------------|
| **Frontend** | React SPA (Vite) | Next.js 14 App Router (single-user MVP, client-side routing) |
| **State** | React Hooks | React Hooks + Context (Auth/Theme/Locale) |
| **Styling** | Tailwind + CSS Custom Properties | ✅ Tailwind + CSS Custom Properties (giữ nguyên) |
| **Data Grid** | AG-Grid (ag-theme-dark) | **TanStack Table v8** (headless) |
| **Charts** | Highcharts | **Recharts** (Line/Bar/Pie/Treemap/Radar) + **Lightweight Charts** (Candlestick) |
| **Date Picker** | react-datepicker | TBD (cluster sau, default native input) |
| **Select** | rc-select, react-select | Native `<select>` + custom `<Select>` primitive (cluster 1) |
| **Font Loading** | Google Fonts API (Roboto) | ✅ Google Fonts (Roboto) — Next.js font optimizer |
| **Icons** | anticon (Ant Design Icons) | **Lucide React** (tree-shake, theme-aware via `currentColor`) |
| **Mock layer (dev)** | — | **MSW 2.x** (prototype-only, không bundle production) |
| **i18n** | — | **next-intl** (VIE/ENG, locale persisted localStorage) |
| **Service Worker** | Firebase Messaging | Không dùng (single-user, không push notification MVP) |
| **CDN / Protection** | Cloudflare | TBD (deployment cluster) |
| **Responsive** | `viewport: ...` | ✅ giữ |

---

## 11. Quick Reference — CSS Variables Copy-Paste

Sử dụng block CSS dưới đây để áp dụng nhanh SSI theme vào bất kỳ project nào:

```css
:root {
  /* Brand */
  --ssi-crimson:        #d32f2f;
  --ssi-badge-red:      #e80a32;
  --ssi-buy:            #1aa67c;
  --ssi-sell:           #c9111f;
  --ssi-info:           #009bde;
  --ssi-success:        #3fa885;
  --ssi-warning:        #f49f3b;

  /* Stock Market (VN Standard) */
  --ssi-ceil:           #f23aff;
  --ssi-up:             #0bdf39;
  --ssi-ref:            #fdff12;
  --ssi-down:           #ff0017;
  --ssi-floor:          #00c9ff;
  --ssi-stable:         #dfe1e3;

  /* Flash */
  --ssi-flash-ceil:     #fd02fd;
  --ssi-flash-up:       #01a77a;
  --ssi-flash-ref:      #d69000;
  --ssi-flash-down:     #c0002e;
  --ssi-flash-floor:    #0030cc;

  /* Gradients */
  --ssi-grad-green:     #01c27f;
  --ssi-grad-red:       #ee3f3f;
  --ssi-grad-yellow:    #e2b000;

  /* Typography */
  --ssi-font-primary:   'Roboto', sans-serif;
  --ssi-font-mono:      ui-monospace, SFMono-Regular, Consolas, monospace;

  /* Border Radius */
  --ssi-radius-sm:      0.125rem;
  --ssi-radius-md:      0.25rem;

  /* Shadow */
  --ssi-shadow-dropdown: 0px 3px 5px rgba(9, 30, 66, 0.2),
                         0px 0px 1px rgba(9, 30, 66, 0.31);
}
```

---

> **Lưu ý:** Design system này được reverse-engineer từ production CSS của SSI iBoard (iboard.ssi.com.vn) và thông tin từ ssi.com.vn corporate site. Các token có thể thay đổi theo version cập nhật của SSI.
