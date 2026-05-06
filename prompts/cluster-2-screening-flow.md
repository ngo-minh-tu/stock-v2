# PROMPT — CỤM 2: Screening Flow (Run + Dashboard + Top MUA + Red Flags)

> **Prototype UI/UX** trong `/Users/ngominhtu/Projects/stock-v2/prototype/` — đây là prototype để test UX, KHÔNG implement business logic thực. Mọi data từ MSW mocks.
>
> Build trên Cụm 1 (Shell & Foundation đã hoàn thành).

---

## 0. Context — Đọc trước khi code

1. `prompts/cluster-1-shell-foundation.md` + code Cụm 1 đã có trong `prototype/`
2. `docs/PRD_v0.5A_Final_Locked.md` §3.1, §5, §7.1-7.5, §8.4 (charts)
3. `docs/design.md` §3.1-3.4 (brand colors, stock market colors, gradients), §7 (chart palette)
4. `tad/g01-runtime.md` — Run state machine (7 states), polling 2s
5. `tad/g02-api.md` — API §1 endpoints + §4 key response shape
6. `tad/g05-cross-cutting.md` — 409 CONFLICT, error envelope
7. `tad/c05-dashboard.md` — Dashboard aggregate
8. `srs/f01-core-screening-pipeline.md` — Screening pipeline + run states
9. `srs/f04-dashboard-market-overview.md` — Dashboard 6 charts/KPIs spec
10. `srs/f06-top-mua-explainability.md` — Top MUA list + expand
11. `srs/f07-red-flags-risk-warnings.md` — Red Flags + warning badges

---

## 1. Mục tiêu cụm

Test UX cho **golden path**: PO bấm Chạy → xem progress → xem kết quả qua 4 màn hình.

Implement:
- **Run trigger + polling UX**: button → 202 → progress bar → status states → done
- **Dashboard** (6 visual: Treemap, Pie, Line, Bar, Radar + KPI cards) — full color theme TTCK VN
- **Top MUA list** (TanStack Table, expand row hiển thị stop loss + allocation + warning badges)
- **Red Flags** (table mã bị loại + warning badges cho mã scored)

---

## 2. Tech additions (so với Cụm 1)

| Library | Purpose |
|---|---|
| `@tanstack/react-table` v8 | Top MUA + Red Flags tables |
| `recharts` ~60KB | Treemap, Pie/Donut, Line, Bar, Radar |
| `swr` HOẶC custom `usePolling` hook | Status polling 2s interval |

**KHÔNG** thêm Lightweight Charts cụm này (Candlestick thuộc Cụm 3).

---

## 3. Run trigger + polling

### 3.1 RunButton component

- Đặt ở Header (bên trái theme/locale, đặt label "Chạy" / "Run")
- States UI: `idle | starting | running | completed | failed`
- Click `idle` → `POST /api/run { total_capital }` → nhận `{ run_id, status: PENDING }` → switch sang `running`
- Trong lúc `running`: hiển thị mini progress bar + step text trong button
- `completed` → toast success + auto navigate `/` (Dashboard load `run_id` mới nhất)
- `failed` → toast error đỏ với run_error
- 409 CONFLICT → toast warning "Đang có tác vụ chạy: {active_job}"

### 3.2 Total capital modal

- Trước khi run: open modal hỏi tổng vốn (number input + unit "VND")
- Validate > 0
- Submit → POST /api/run với capital
- Có checkbox "Bỏ qua, chạy không tính phân bổ" → POST với capital=0

### 3.3 Polling

- `usePolling(runId, interval=2000)` hook
- GET `/api/runs/{run_id}/status` mỗi 2s
- Stop khi status ∈ {COMPLETED, COMPLETED_WITH_WARNINGS, FAILED}
- Return `{ status, progress_percent, current_step, message, warnings }`

### 3.4 Progress UI

- Floating progress card phía dưới Header (sticky), z-index cao hơn content
- Hiển thị: status badge + step text + progress bar 0-100% + warnings count nếu có
- Nút "Hủy" disabled (MVP không cancel — rule TAD)
- Auto dismiss 3s sau khi COMPLETED

---

## 4. Dashboard page (`/`)

### 4.1 Layout

Khi chưa có run nào: empty state "Chưa có dữ liệu — Bấm Chạy để bắt đầu" + nút Run inline.

Khi có ≥1 run: load run mới nhất (GET /api/runs?limit=1 → /api/runs/{run_id}/dashboard).

URL state: `?run_id=xxx` để navigate tới run cũ. Nếu không có param → run mới nhất.

### 4.2 6 visual elements

Từ aggregate payload `GET /api/runs/{run_id}/dashboard`:

| # | Element | Library | Data |
|---|---|---|---|
| 1 | KPI cards (4 cards) | Native | Total mã, MUA count, GIỮ count, BÁN count, alpha vs VN-Index nếu có |
| 2 | Treemap | Recharts | ~81 mã, size = market cap, color = recommendation (MUA xanh, GIỮ vàng, BÁN đỏ) |
| 3 | Pie/Donut | Recharts | Tỷ lệ MUA/GIỮ/BÁN |
| 4 | Line | Recharts | VN-Index xu hướng (mock 6 tháng) + line aggregate ngành BĐS |
| 5 | Bar | Recharts | Top 10 mã theo AI Score |
| 6 | Radar | Recharts | Avg 5 nhóm features (fundamental, technical, macro, realestate, sentiment) cho ngành |

### 4.3 Colors

Theo design.md §3.2:
- MUA = `--ssi-up` (`#0bdf39` classic / `#078c54` light)
- GIỮ = `--ssi-ref` (`#fdff12` / `#e78b03`)
- BÁN = `--ssi-down` (`#ff0017`)
- Treemap gradient theo `--ssi-grad-green/red/yellow`

### 4.4 Run selector

Dropdown ở góc phải Dashboard: list 10 runs gần nhất (GET /api/runs?limit=10), label = `{run_at} — {scored_count} mã`. Switch run → reload dashboard.

---

## 5. Top MUA page (`/top-mua`)

### 5.1 Bảng (TanStack Table)

Columns:
- Ticker | Tên | AI Score | Recommendation badge | Confidence % | Upside % | Entry Signal chip | Action (expand)

Sort default: AI Score DESC. Filter theo recommendation (chỉ MUA), search ticker.

### 5.2 Expand row

Click ticker → expand panel hiển thị:
- 3-5 lý do (từ `reasons[]` — đã có sẵn trong response, KHÔNG generate)
- Stop loss price + buy_price reference
- Allocation amount + weight %
- Warning badges (bản chip: `HIGH_DEBT`, `NEGATIVE_OCF`, `LEGAL_RISK`, `HIGH_INVENTORY`)
- Confidence breakdown: raw - penalty = final
- Nút "Xem chi tiết" → navigate `/stock-detail?run_id=X&ticker=Y` (page Cụm 3)

### 5.3 Empty state

- Run chưa có mã MUA: "Không có mã MUA trong run này" + suggestion lower threshold

---

## 6. Red Flags page (`/red-flags`)

### 6.1 Section A: Mã bị loại

TanStack Table:
- Ticker | Loại ở vòng | Reason code | Reason text

Filter theo round (1-4), filter theo reason_code.

### 6.2 Section B: Warning badges (mã đã scored)

TanStack Table:
- Ticker | AI Score | Recommendation | Badges (chips) | Confidence penalty

Chỉ hiển thị mã có ≥1 badge. Filter theo badge type.

### 6.3 Empty states

- Section A: "Không có mã bị loại" (rare)
- Section B: "Không có mã có cảnh báo trong run này"

---

## 7. Mock API (MSW handlers thêm)

### 7.1 Run lifecycle

`POST /api/run`:
- Sinh `run_id = "run_" + Date.now()`
- Lưu state vào in-memory store (handlers shared state — singleton module)
- Return `202 { run_id, status: "PENDING" }` (envelope)
- Background simulation: setTimeout chuyển states qua thời gian:
  - 0s: PENDING (5%)
  - 2s: CHECKING_DATA (15%)
  - 5s: SCREENING (40%, current_step="Filtering 81 stocks")
  - 10s: SCORING (75%, current_step="Scoring features")
  - 15s: COMPLETED (100%) HOẶC COMPLETED_WITH_WARNINGS (random 20% chance)

`GET /api/runs/{run_id}/status` → đọc từ in-memory store.

`GET /api/runs/{run_id}/results` → trả mock 81 tickers (xem §7.3).

`GET /api/runs/{run_id}/dashboard` → trả aggregate computed từ results.

`GET /api/runs/{run_id}` → summary metadata.

`GET /api/runs?limit=10` → list 10 mock runs (sinh sẵn 3 runs lúc init, mỗi POST /api/run thêm 1).

### 7.2 Failure modes (test UX)

Thêm dev-only toggle (URL param hoặc UI button trong Settings):
- `mock_run_outcome=success | warnings | failed | conflict` 
- `failed` → status FAILED + run_error="Mock failure for UX test"
- `conflict` → POST /api/run trả 409 ngay
- `warnings` → COMPLETED_WITH_WARNINGS với 2-3 warnings: data_from_cache, telegram_error

### 7.3 Mock data — 81 tickers

Sinh fixture file `mocks/data/stocks-fixture.ts`:
- Dùng tickers VN BĐS thật: VHM, VIC, NVL, KDH, NLG, DXG, PDR, KBC, BCM, VRE, HDC, IJC, DIG, CEO, HQC, TIG, LDG, ITC, SCR, AGG, ... (extend đến 81 mã, có thể repeat pattern hoặc dùng tên ngẫu nhiên có prefix MOCK_)
- Mỗi mã: name, exchange, sector, current_price (random 10-150k VND), AI score (random 0-100 với bell curve quanh 60), upside random
- 5 mã đặc biệt theo TAD §22 (g06): MOCK_BUY_STRONG (score 92), MOCK_BUY_WARN (score 78 + 1 badge), MOCK_HOLD (score 55), MOCK_SELL (score 30), MOCK_INSUFFICIENT (excluded)
- Reasons: pre-baked 5-10 templates kèm feature_id (ví dụ: "ROE cao (16.8%)" / "F03"), pick random 3-5 cho mỗi mã

### 7.4 Aggregate computation

`/dashboard` compute on-the-fly từ results array:
- KPI counts
- Treemap data: ticker + market_cap (mock = current_price × shares random) + recommendation
- Pie: count by recommendation
- Line VN-Index: 6 tháng mock data (sinh sin wave + noise, 0-1500 range)
- Bar: top 10 by score
- Radar: avg score per group (chia features F=fundamental, T=technical, M=macro, R=realestate, S=sentiment)

---

## 8. Components mới

```
src/components/
├── run/
│   ├── RunButton.tsx
│   ├── RunStatusCard.tsx      # Floating progress card
│   ├── CapitalModal.tsx
│   └── RunSelector.tsx
├── charts/
│   ├── TreemapChart.tsx
│   ├── PieChart.tsx
│   ├── LineChart.tsx
│   ├── BarChart.tsx
│   └── RadarChart.tsx
├── dashboard/
│   ├── KPICards.tsx
│   └── DashboardGrid.tsx
├── tables/
│   ├── TopMuaTable.tsx
│   ├── RedFlagsExcludedTable.tsx
│   └── RedFlagsBadgesTable.tsx
└── badges/
    ├── RecommendationBadge.tsx
    ├── EntrySignalChip.tsx
    └── WarningBadge.tsx
```

Thêm hooks: `usePolling`, `useRun`, `useDashboard`.

---

## 9. i18n keys thêm (vi.json + en.json)

- `run.button.label` / `.starting` / `.running`
- `run.modal.capital.title` / `.placeholder` / `.skipAllocation`
- `run.status.PENDING` / `.CHECKING_DATA` / `.SCREENING` / `.SCORING` / `.COMPLETED` / `.COMPLETED_WITH_WARNINGS` / `.FAILED`
- `dashboard.kpi.totalScored` / `.muaCount` / `.holdCount` / `.sellCount` / `.alpha`
- `dashboard.chart.treemap.title` / `.pie.title` / `.line.title` / `.bar.title` / `.radar.title`
- `topMua.column.*` / `topMua.expand.reasons` / `.stopLoss` / `.allocation` / `.warnings`
- `redFlags.section.excluded` / `.warnings`
- `entry.signal.BUY_STRONG` / `.BUY_NOW` / `.WAIT_FOR_BREAKOUT` / `.WAIT_FOR_PULLBACK` / `.WAIT_FOR_CONFIRMATION` / `.NO_ENTRY` / `.INSUFFICIENT_DATA`
- `warning.HIGH_DEBT` / `.NEGATIVE_OCF` / `.LEGAL_RISK` / `.HIGH_INVENTORY`
- `recommendation.MUA` / `.HOLD` / `.SELL` (text "MUA"/"GIỮ"/"BÁN" giữ nguyên VIE; ENG: "BUY"/"HOLD"/"SELL")

---

## 10. Acceptance criteria

1. Click Run → modal capital → submit → progress card xuất hiện → tự động chuyển states 5 lần trong ~15s → COMPLETED toast → Dashboard auto-load run mới
2. Test 4 outcomes (toggle): success, warnings, failed, conflict — UX rõ ràng cho mỗi case
3. Click Run trong khi đang chạy → 409 toast (không tạo run mới)
4. Dashboard render đủ 6 visual với data từ aggregate, đổi theme → màu update
5. Run selector switch run cũ → toàn bộ dashboard reload đúng
6. Top MUA: sort score DESC default, filter MUA, search "VHM" → 1 row, expand → reasons + stop loss + allocation hiển thị
7. Red Flags: 2 sections, filter by round/reason_code/badge work
8. Tất cả màn hình empty state có handling rõ
9. Mobile responsive: charts shrink, table horizontal scroll
10. Performance: 81 mã render Treemap < 500ms

---

## 11. Lưu ý

- **KHÔNG** implement Stock Detail (Cụm 3), Price Board/News (Cụm 4), Portfolio/History (Cụm 5).
- Reason templates phải pre-baked (GUARD-02: không LLM generate).
- Polling phải cleanup khi unmount (memory leak).
- Mock state machine simulation chạy trong MSW handler, dùng singleton store để các handler share state.
- Pure UI/UX — KHÔNG tính features thật. Mọi number là mock.
