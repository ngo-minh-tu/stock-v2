# SSI Design System

> Extracted from [ssi.com.vn](https://www.ssi.com.vn) — Công ty Cổ phần Chứng khoán SSI
> Version: iBoard v2.0.5.5 | Last updated: April 2026
> Project version: v1.2 (post-prototype reconciliation 2026-05-09)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ❌ REMOVED AG-Grid references (TAD §2 đã exclude AG-Grid; project dùng TanStack Table v8). Cập nhật §6.5 (Price Board Table styling) sang pattern TanStack Table + CSS variables. §10 Tech Stack: cập nhật Data Grid + Charts khớp với TAD §2 (TanStack + Recharts + Lightweight Charts). Line 43 type scale: "AG-Grid data" → "TanStack Table data".
- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ ADDED `--color-theme-tooltip-background` + `--color-theme-tooltip-border` vào cả 4 theme blocks (gap có từ cluster 1, lộ ở cluster 2 khi 8 chart components dùng). ➕ NEW §6.7 Chart Tooltips (chuẩn padding/border/shadow/blur), §6.8 Pie Center Label (donut hole pattern), §6.9 Radar Custom Tooltip (INWARD placement, polar geometry, dual-series). ➕ ADDED Toast Warning color `#f49f3b` (hardcoded brand alert).

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

// Body row (alternating)
<tr style={{
  backgroundColor: index % 2 === 0
    ? 'var(--color-theme-price-table-row-even)'
    : 'var(--color-theme-price-table-row-odd)',
}}>...</tr>

// Cell
<td className="text-2xs tabular-nums px-2 py-1">{value}</td>
```

**Typography:** font-size `text-2xs` (11px / 0.688rem) cho data cells, `tabular-nums` cho numeric alignment, Roboto antialiased.

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
