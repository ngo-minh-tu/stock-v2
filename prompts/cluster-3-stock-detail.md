# PROMPT — CỤM 3: Stock Detail Deep-dive

> **Prototype UI/UX** trong `/Users/ngominhtu/Projects/stock-v2/prototype/` — đây là prototype để test UX, KHÔNG implement business logic thực. Mọi data từ MSW mocks.
>
> Build trên Cụm 1+2.

---

## 0. Context — Đọc trước khi code

1. `prompts/cluster-1-shell-foundation.md`, `prompts/cluster-2-screening-flow.md` + code đã có
2. `docs/PRD_v0.5A_Final_Locked.md` §6 (Entry Logic), §7.6-7.8, §8.4
3. `docs/design.md` §3.2 (stock colors), §7 (chart palette)
4. `tad/g02-api.md` §4 — Stock Detail response shape (full JSON example)
5. `tad/c01-engines.md`, `tad/c03-entry-engine.md`
6. `srs/f03-entry-point-logic.md` — 7 entry signals + priority order
7. `srs/f08-stock-detail.md` — Stock Detail page spec
8. `srs/f09-risk-management.md` — Stop loss + allocation + warning badges + confidence penalty

---

## 1. Mục tiêu cụm

Test UX cho deep analysis: từ Top MUA hoặc Price Board click vào 1 mã → xem candlestick + radar + breakdown 5 nhóm + entry signal + risk display.

Implement page **`/stock-detail?run_id=X&ticker=Y`** với 5 sections:
1. Header info (ticker, name, exchange, sector, current price + delta)
2. Candlestick chart (6 tháng) với S/R zones overlay
3. Score breakdown (Radar 5 nhóm + bảng 38 features chi tiết, expandable)
4. Entry signal panel (signal chip + reason_code + S/R zones + reasoning)
5. Risk panel (stop loss + allocation + warning badges + confidence raw/penalty/final)

---

## 2. Tech additions (so với Cụm 1+2)

| Library | Purpose |
|---|---|
| `lightweight-charts` ~40KB | Candlestick (theo TAD §2) |

Tổng số chart libraries giờ = 2 (Recharts + Lightweight Charts), đúng theo TAD chốt.

---

## 3. Page layout `/stock-detail`

### 3.1 Header strip

- Left: Ticker + Tên đầy đủ + exchange tag (HOSE/HNX/UPCOM) + sector
- Center: Current price (text-3xl) + delta % (color theo TTCK rule: ceil tím / up xanh / ref vàng / down đỏ / floor xanh dương)
- Right: AI Score badge (large) + Recommendation chip (MUA/GIỮ/BÁN)
- Sub-row: Run selector (dropdown — switch giữa các run đã chấm mã này)

### 3.2 Section 2: Candlestick

- Lightweight Charts `createChart` với candlestick series
- 6 tháng OHLCV mock data (~125 trading days)
- Overlay:
  - Support zone: horizontal line @ `support_zone` price (green dashed)
  - Resistance zone: @ `resistance_zone` (red dashed)
  - Stop loss: @ `stop_loss_price` (orange dashed) với label "SL -10%"
  - Target price 3M: @ `target_price_3m` (purple dashed) với label "Target 3M"
- Volume bars dưới candlestick (50% chiều cao panel)
- Theme-aware: candle up/down colors lấy từ CSS vars (`--ssi-up`, `--ssi-down`)
- Toolbar: zoom, pan, reset, period switcher (1M/3M/6M/1Y) — click 1M/1Y refetch

### 3.3 Section 3: Score breakdown

**Radar (full size, 400×400):**
- 5 axes: Cơ bản, Kỹ thuật, Vĩ mô, BĐS, Sentiment
- Plot ticker score per group + (optional, faded) industry average từ Dashboard radar data
- Recharts `RadarChart`

**Feature table (expandable):**
- Default collapsed
- Toggle "Hiển thị 38 features" → expand
- Group theo 5 nhóm với header collapsible
- Columns: Feature ID | Tên | Value | Normalized score | Direction (↑/↓ icon)
- Highlight features có giá trị "tốt" (green tint) vs "xấu" (red tint) theo direction
- Imputed features có icon ⚠ + tooltip "Đã impute, giảm confidence"

### 3.4 Section 4: Entry signal panel

- Lớn, bordered card với accent crimson
- Signal chip lớn: enum 7 trạng thái với màu/icon riêng:
  - `BUY_STRONG` 🟢 green strong
  - `BUY_NOW` 🟢 green
  - `WAIT_FOR_BREAKOUT` 🟡 yellow
  - `WAIT_FOR_PULLBACK` 🟡 yellow
  - `WAIT_FOR_CONFIRMATION` 🟡 yellow
  - `NO_ENTRY` ⚫ gray
  - `INSUFFICIENT_DATA` ⚪ light gray với icon ⚠
- Reason code parsed → human-readable: "VALUATION_ATTRACTIVE+BULLISH_TREND" → "Định giá hấp dẫn + Xu hướng tăng"
- Hiển thị raw_indicators_used (chips list)
- Support / Resistance zones visualized: mini horizontal bar showing current price between S/R

### 3.5 Section 5: Risk panel

3 sub-cards horizontal:

**Card A — Stop Loss:**
- Big number: stop_loss_price (red large text)
- Calc: "Buy price × 0.90" hoặc "Current price × 0.90 (chưa có buy_price)"
- Distance % từ current price

**Card B — Phân bổ vốn:**
- Big number: allocation_amount (VND format)
- Weight % của tổng vốn
- Note: "Dựa trên tổng vốn {total_capital} đã nhập khi chạy"
- Nếu total_capital=0 → "Bỏ qua phân bổ" placeholder

**Card C — Confidence breakdown:**
- Visual bar: raw_confidence (full) → penalty (subtracted) → final
- 82% - 5pp = 77%
- Warning badges chips bên dưới (mỗi badge có tooltip giải thích reason)

---

## 4. Mock API (MSW handlers thêm)

### 4.1 GET /api/runs/{run_id}/stocks/{ticker}

- Trả full payload theo TAD g02 §4 example (KDH-like)
- Lookup từ stocks-fixture: nếu ticker ∈ fixture → compose từ score data Cụm 2; nếu không → 404
- Bao gồm `features` object đầy đủ 38 keys (sinh value tương ứng score)
- `feature_availability`: random 32-38

### 4.2 GET /api/stocks/{ticker}/prices?period=6M

- Sinh OHLCV 125 days
- Algorithm: random walk với drift + occasional gap
- Volume: gaussian 500K-2M
- Return: `[{ date, open, high, low, close, volume }]`
- Period query: 1M=22, 3M=66, 6M=125, 1Y=250 days

### 4.3 GET /api/stocks/{ticker}

Static info (không cần run_id).

---

## 5. Components mới

```
src/components/
├── stock-detail/
│   ├── StockHeader.tsx
│   ├── CandlestickChart.tsx       # Lightweight Charts wrapper
│   ├── ScoreBreakdown.tsx
│   ├── FeatureTable.tsx
│   ├── EntrySignalPanel.tsx
│   ├── RiskPanel.tsx
│   ├── StopLossCard.tsx
│   ├── AllocationCard.tsx
│   └── ConfidenceCard.tsx
└── badges/
    └── ExchangeBadge.tsx           # HOSE/HNX/UPCOM
```

Hooks: `useStockDetail(runId, ticker)`, `useStockPrices(ticker, period)`.

---

## 6. Entry signal mapping

```typescript
// constants.ts
export const ENTRY_SIGNAL_META = {
  BUY_STRONG:  { color: 'green-strong', icon: '🟢', priority: 3 },
  BUY_NOW:     { color: 'green', icon: '🟢', priority: 4 },
  WAIT_FOR_BREAKOUT:     { color: 'yellow', icon: '🟡', priority: 5 },
  WAIT_FOR_PULLBACK:     { color: 'yellow', icon: '🟡', priority: 6 },
  WAIT_FOR_CONFIRMATION: { color: 'yellow', icon: '🟡', priority: 7 },
  NO_ENTRY:              { color: 'gray', icon: '⚫', priority: 2 },
  INSUFFICIENT_DATA:     { color: 'light-gray', icon: '⚠', priority: 1 },
}
```

Reason code parser: split "+", lookup từ map → translate i18n. Vd:
- VALUATION_ATTRACTIVE → "Định giá hấp dẫn"
- BULLISH_TREND → "Xu hướng tăng"
- NEAR_RESISTANCE → "Gần kháng cự"
- OVERBOUGHT → "Quá mua"
- (đầy đủ list trong mocks/data/reason-codes.ts)

---

## 7. Warning badges

Toàn bộ enum + meta theo PRD §7.5:

| Code | Label VI | Label EN | Trigger |
|---|---|---|---|
| HIGH_DEBT | Đòn bẩy cao | High debt | D/E ≥ 3 |
| NEGATIVE_OCF | Dòng tiền âm | Negative OCF | OCF < 0 |
| LEGAL_RISK | Rủi ro pháp lý | Legal risk | Legal score ≥ 4 |
| HIGH_INVENTORY | Tồn kho cao | High inventory | Inv/TA > 60% |

Render: chip với icon + tooltip giải thích. Lookup từ `mocks/data/warning-badges.ts`.

---

## 8. i18n keys thêm

- `stockDetail.section.candlestick` / `.breakdown` / `.entry` / `.risk`
- `stockDetail.feature.group.fundamental` / `.technical` / `.macro` / `.realestate` / `.sentiment`
- `stockDetail.candlestick.period.1M` / `.3M` / `.6M` / `.1Y`
- `stockDetail.candlestick.overlay.support` / `.resistance` / `.stopLoss` / `.target`
- `stockDetail.entry.reasonCode.*` (đầy đủ list)
- `stockDetail.risk.stopLoss.title` / `.calc.buyPrice` / `.calc.currentPrice`
- `stockDetail.risk.allocation.title` / `.skipped`
- `stockDetail.risk.confidence.raw` / `.penalty` / `.final`
- Warning labels (Đòn bẩy cao / High debt, etc.)

---

## 9. Acceptance criteria

1. Top MUA expand → click "Xem chi tiết" → navigate `/stock-detail?run_id=X&ticker=KDH` đúng URL
2. 5 sections render đầy đủ với data đúng từ MSW
3. Candlestick: zoom/pan/reset work, period switcher refetch và update chart
4. Overlay 4 lines (S, R, SL, Target) hiển thị đúng vị trí, color theo TTCK
5. Radar plot 5 axes; click "Hiển thị 38 features" → expand bảng có 5 nhóm collapsible
6. 7 entry signals test được (mock fixture cho mỗi enum: VHM=BUY_STRONG, KDH=BUY_NOW, NLG=WAIT_FOR_BREAKOUT, ...)
7. Warning badges hiển thị tooltip đúng, MOCK_BUY_WARN có 1 badge confidence penalty -5pp
8. INSUFFICIENT_DATA case (MOCK_INSUFFICIENT) render UX đặc biệt (entry panel disable, risk panel "Không đủ data")
9. Theme dark/light/oled: candlestick + radar + cards đều theme-aware
10. Run selector trong header strip switch run khác → reload toàn bộ data

---

## 10. Lưu ý

- **KHÔNG** implement screening logic hoặc compute features thật — features từ mock fixture.
- Candlestick KHÔNG dùng Recharts (Recharts không support candlestick well — TAD đã chốt Lightweight Charts cho candlestick).
- Reason codes lookup table phải đầy đủ — không generate text tự do (GUARD-02).
- 7 entry signals UX phải distinct — đây là test point chính của cụm này.
