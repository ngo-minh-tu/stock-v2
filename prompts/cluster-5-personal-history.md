# PROMPT — CỤM 5: Personal & History (Portfolio Lite + Run History + Compare)

> **Prototype UI/UX** trong `/Users/ngominhtu/Projects/stock-v2/prototype/` — đây là prototype để test UX, KHÔNG implement business logic thực. Mọi data từ MSW mocks.
>
> Build trên Cụm 1-4.

---

## 0. Context — Đọc trước khi code

1. Code Cụm 1-4 trong `prototype/`
2. `docs/PRD_v0.5A_Final_Locked.md` §7.9 (Portfolio Lite), §7.10 (Run History + Backtest)
3. `tad/g02-api.md` — `/portfolio` CRUD, `/runs` list, `/runs/{a}/compare/{b}`, `/backtest`
4. `tad/g03-database.md` Tables 10 (portfolio), 13 (backtest_runs), 14 (backtest_results)
5. `srs/f11-portfolio-lite.md`
6. `srs/f12-run-history-backtest.md`

---

## 1. Mục tiêu cụm

Test UX cho:
- **Portfolio Lite** (`/portfolio`): CRUD danh mục cá nhân + tính lãi/lỗ basic
- **Run History** (`/run-history`): list runs + so sánh 2 runs (diff recommendations)
- **Backtest panel** (subsection trong Run History): metrics đơn giản

PRD §7.9: Portfolio MVP chỉ CRUD + lãi/lỗ cơ bản. Lịch sử giao dịch nâng cao = Post-MVP → KHÔNG implement.

---

## 2. Tech additions

Không thêm thư viện. Reuse TanStack Table + Recharts.

---

## 3. Portfolio page (`/portfolio`)

### 3.1 Layout

- Top: KPI cards 4 cards
  - Tổng vốn đầu tư
  - Giá trị hiện tại
  - Lãi/lỗ tổng (VND + %)
  - Số lượng mã
- Bảng holdings (TanStack Table)
- Bottom: Add holding button (FAB hoặc inline trên bảng)

### 3.2 Bảng holdings

Columns:
| Column | Source | Note |
|---|---|---|
| Ticker | portfolio.ticker | click → /stock-detail |
| Tên | stocks.name (lookup) | |
| SL | portfolio.quantity | format thousand |
| Giá mua | portfolio.buy_price | VND |
| Ngày mua | portfolio.buy_date | format dd/MM/yyyy |
| Giá hiện tại | latest stock price | TTCK color |
| Tổng vốn | quantity × buy_price | |
| Giá trị hiện tại | quantity × current_price | |
| Lãi/lỗ | (current - buy) × qty | up=green / down=red |
| Lãi/lỗ % | (current-buy)/buy × 100 | matching color |
| Notes | portfolio.notes | tooltip nếu dài |
| Action | edit / delete buttons | |

Sort default: Lãi/lỗ % DESC.

### 3.3 Add/Edit modal

Form fields:
- Ticker (autocomplete từ stocks fixture)
- Số lượng (number, > 0)
- Giá mua (number VND, > 0)
- Ngày mua (date picker, ≤ today)
- Notes (textarea, optional)

Submit:
- Add: POST /api/portfolio
- Edit: PUT /api/portfolio/{id}
- Validation lỗi inline

### 3.4 Delete confirm

Modal: "Xóa {ticker} khỏi danh mục?" → DELETE /api/portfolio/{id} → toast.

### 3.5 Empty state

"Chưa có mã nào trong danh mục" + nút "Thêm mã đầu tiên".

---

## 4. Run History page (`/run-history`)

### 4.1 Layout

- Top: KPI cards (Tổng số runs, Run gần nhất, Avg accuracy nếu có backtest)
- Bảng runs (TanStack Table)
- Right side panel (collapsible): Compare 2 runs

### 4.2 Bảng runs

Columns:
| Column | Source |
|---|---|
| Run ID | screening_runs.run_id (truncate) |
| Run at | run_at (relative time + absolute trên hover) |
| Status | status badge |
| Model version | model_version |
| Settings version | settings_version |
| Total scored | scored_count |
| Buy / Hold / Sell | buy_count / hold_count / sell_count (3 mini bars) |
| Total capital | total_capital VND |
| Duration | duration_seconds (format mm:ss) |
| Warnings | warnings_json count badge |
| Action | View / Compare / Delete |

Sort default: run_at DESC. Pagination limit=10.

### 4.3 Compare panel

- Click "Compare" trên row → mark run A
- Click "Compare" trên row khác → mark run B
- Auto open compare panel
- Panel hiển thị 4 sections:

**Section 1 — Summary diff:**
| Metric | Run A | Run B | Δ |
|---|---|---|---|
| Total scored | ... | ... | ... |
| Buy count | ... | ... | green/red |
| Hold count | ... | ... | |
| Sell count | ... | ... | |
| Avg score | ... | ... | |
| Duration | ... | ... | |

**Section 2 — Recommendation changes:**
Bảng list các mã có recommendation khác nhau:
| Ticker | Run A rec | Run B rec | Score A | Score B | Δ Score |

Highlight màu:
- Upgrade (BÁN→GIỮ, GIỮ→MUA, BÁN→MUA): green
- Downgrade: red

**Section 3 — New entries / Removed:**
- Mã chỉ có trong Run B (mới scored)
- Mã chỉ có trong Run A (bị loại trong Run B)

**Section 4 — Score distribution:**
Mini histogram 2 runs overlay (Recharts).

### 4.4 Click View (single run)

Navigate `/?run_id=X` (Dashboard với run đó).

### 4.5 Delete run

Confirm modal → DELETE /api/runs/{id} (mock).

---

## 5. Backtest panel (subsection trong Run History)

### 5.1 Trigger

Button "Run Backtest" trên Run History page → modal:
- Period from (date picker)
- Period to (date picker)
- Submit → POST /api/backtest → 202 + backtest_id
- Polling tương tự run polling Cụm 2 → COMPLETED

### 5.2 Result card

Sau COMPLETED, render card:
- **Recommendation accuracy** (big %) + threshold ≥60% → green/red color
- **Avg price error** (%)
- **Portfolio ROI** vs **VN-Index ROI** (2 numbers + alpha)
- **Mini chart**: portfolio cumulative return vs VN-Index (Line chart)

### 5.3 Detail expansion

Expand → bảng `backtest_results`:
| Ticker | Predicted rec | Actual return 3M | Predicted price | Actual price | Error % | Correct? |

Sort theo error.

---

## 6. Mock API (MSW handlers thêm)

### 6.1 Portfolio CRUD

```
GET    /api/portfolio        → list 5-10 mock holdings (sinh từ stocks-fixture)
POST   /api/portfolio        → add với id auto-increment
PUT    /api/portfolio/{id}   → update
DELETE /api/portfolio/{id}   → 204
```

In-memory store cho portfolio.

### 6.2 Runs list

```
GET /api/runs?limit=10&offset=0
```

Sinh 10 mock runs (từ Cụm 2 store + 7 historical pre-baked):
- Mỗi historical: random scored_count, buy/hold/sell distribution, varied model_version (baseline_v1, baseline_v2)
- Run mới nhất phải khớp run từ Cụm 2 (shared store)

### 6.3 Compare

`GET /api/runs/{run_a}/compare/{run_b}` → compute diff on-the-fly từ 2 runs results:
- summary_diff
- recommendation_changes (mã chung có rec khác)
- new_entries / removed
- score_distribution

### 6.4 Backtest

```
POST /api/backtest { period_from, period_to } → 202 + backtest_id
GET /api/backtest/{id}/status → polling tương tự run
GET /api/backtest/{id}        → mock metrics:
  - recommendation_accuracy: random 0.55-0.75
  - price_error_mean: random 8-18%
  - portfolio_roi: random 5-25%
  - vnindex_roi: random 3-15%
  - alpha: portfolio_roi - vnindex_roi
GET /api/backtest/{id}/results → 81 ticker rows
```

---

## 7. Components mới

```
src/components/
├── portfolio/
│   ├── PortfolioTable.tsx
│   ├── PortfolioKPI.tsx
│   ├── HoldingFormModal.tsx
│   └── DeleteHoldingModal.tsx
├── run-history/
│   ├── RunHistoryTable.tsx
│   ├── ComparePanel.tsx
│   ├── CompareSummary.tsx
│   ├── RecommendationChangesTable.tsx
│   ├── NewRemovedSection.tsx
│   └── ScoreHistogram.tsx
├── backtest/
│   ├── BacktestModal.tsx
│   ├── BacktestResultCard.tsx
│   ├── BacktestRoiChart.tsx
│   └── BacktestDetailTable.tsx
└── common/
    └── DatePicker.tsx              # native HTML date input wrapped
```

Hooks: `usePortfolio`, `useRunsList`, `useCompare(a, b)`, `useBacktest(id)`.

---

## 8. P&L formulas

Pure UI display — không gọi API:

```typescript
const totalCost = holdings.reduce((s, h) => s + h.quantity * h.buy_price, 0);
const currentValue = holdings.reduce((s, h) => s + h.quantity * currentPriceOf(h.ticker), 0);
const totalPnl = currentValue - totalCost;
const totalPnlPct = totalCost > 0 ? totalPnl / totalCost * 100 : 0;
```

`currentPriceOf` lookup từ stocks fixture (cùng source với Price Board).

---

## 9. i18n keys thêm

- `portfolio.kpi.totalCost` / `.currentValue` / `.totalPnl` / `.holdingCount`
- `portfolio.column.*`
- `portfolio.modal.add.title` / `.edit.title` / `.field.ticker` / `.quantity` / `.buyPrice` / `.buyDate` / `.notes`
- `portfolio.delete.confirm` / `.empty`
- `runHistory.kpi.totalRuns` / `.lastRun` / `.avgAccuracy`
- `runHistory.column.*`
- `runHistory.compare.summary` / `.changes` / `.newEntries` / `.removed` / `.distribution`
- `runHistory.compare.upgrade` / `.downgrade`
- `backtest.modal.title` / `.periodFrom` / `.periodTo` / `.submit`
- `backtest.metric.accuracy` / `.priceError` / `.portfolioRoi` / `.vnindexRoi` / `.alpha`
- `backtest.detail.column.*`

---

## 10. Acceptance criteria

1. Portfolio: CRUD đầy đủ — add → list → edit → delete, validate ticker từ fixture
2. P&L tính đúng cho mock holdings (so với formula thủ công)
3. TTCK color cho cột "Giá hiện tại" và "Lãi/lỗ %"
4. Run History list 10 runs, gồm runs từ Cụm 2 + historical
5. Click "Compare" 2 runs → panel hiện đủ 4 sections
6. Recommendation changes table highlight upgrade/downgrade đúng
7. Backtest modal → run → polling progress → result card với 4 metrics
8. Backtest detail expand → bảng 81 rows
9. ROI chart line render đúng (portfolio vs VN-Index)
10. Empty states đầy đủ cho cả portfolio và run history (chưa có data)
11. Mobile responsive: tables horizontal scroll, modals full-screen

---

## 11. Lưu ý

- Portfolio = MVP scope: CRUD + lãi/lỗ cơ bản. KHÔNG implement transactions table (Post-MVP).
- Compare panel reuse data từ /runs/{id}/results đã có Cụm 2 — handler chỉ join 2 runs.
- Backtest correctness theo PRD §4.5 (đã ghi rõ MUA/GIỮ/BÁN đúng/sai khi nào). Mock metrics phải plausible.
- KHÔNG add transaction cost / slippage — Post-MVP.
