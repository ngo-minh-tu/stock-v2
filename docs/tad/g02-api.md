---
id: g02
title: API Design — Endpoint Registry, Pagination, Health/Version, Key Responses
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§7); cluster 1 reconciliation 2026-05-09
version: v1.5 LOCKED (cluster 6 reconciliation)
---

# g02 — API Design

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ➕ Bổ sung §5 (Frontend API client `apiFetch` wrapper pattern: Bearer auto, envelope parse, 401 auto-logout, `JobConflictError` cho 409) và §6 (Response envelope shape — chuẩn hóa cho cả success & error). ❌ §3 health/version response: bump `srs_version: v1.0 → v1.2`, `tad_version: v1.1 → v1.2` (đồng bộ với cluster 1 reconciliation).
- **v1.3 (2026-05-09, cluster 4 reconciliation):** ➕ Bổ sung §7 Key Response Shapes (Cluster 4): `GET /api/stocks` (LatestPrice + newly_listed flag), `GET /api/news` (source_errors envelope + pagination), `GET /api/news/sentiment/{ticker}` (30-day rollup, count=0 → NEUTRAL/0.0/empty breakdown). Bump `srs_version: v1.2 → v1.4`, `tad_version: v1.2 → v1.3`.
- **v1.4 (2026-05-09, cluster 5 reconciliation):** ❌ §1 endpoint registry: `DELETE /portfolio/{id}` 204 → **200 + envelope** (rationale §8.1). ➕ ADDED `DELETE /runs/{id}` (cluster 5 missing in original registry); ➕ ADDED `GET /backtest/{id}/status` + `GET /backtest/{id}/results` (cluster 5 2-stage polling). ➕ Bổ sung §8 Key Response Shapes (Cluster 5): PortfolioListResponse + HoldingRow joined, validateHolding mirror, DELETE 200+envelope rationale, CompareResponse 4 sub-shapes, RunSummary expanded với 5 new fields, Backtest 2-stage polling shapes + 1.5s timing. Bump `srs_version: v1.4`, `tad_version: v1.3 → v1.4`.
- **v1.5 (2026-05-09, cluster 6 reconciliation):** ➕ §1 ADDED `DELETE /share/{token}` 200+envelope (cluster 6); UPDATE `POST /share`, `GET /share` (list active), `GET /share/{token}` (public, no auth). ➕ Bổ sung §9 Key Response Shapes (Cluster 6): PDF Content-Disposition, Share CRUD shapes (uuid v4 + 7-day TTL), Telegram test mock 70/30, Password change return new token. Bump `tad_version: v1.4 → v1.5`.

---

## 1. Full Endpoint Registry

> [v1.1 MUST-FIX 1 + 2] Async endpoints + Stock Detail by run

| Method | Endpoint | Response | Phase | Description |
|---|---|---|---|---|
| GET | /health | 200 {"status": "ok"} | 0 | Health check |
| GET | /version | 200 {versions} | 0 | App + doc + model versions |
| POST | /auth/login | 200 {token} | 2 | Login → JWT |
| PUT | /auth/password | 200 | 2 | Change password |
| POST | /refresh/all | **202** {refresh_id} | 1 | Async refresh all |
| POST | /refresh/prices | **202** {refresh_id} | 1 | Async refresh prices only |
| GET | /refresh/{id}/status | 200 {status, progress} | 1 | Poll refresh status |
| POST | /run | **202** {run_id, status} | 1 | Async start screening |
| GET | /runs | 200 {items[], total} | 3 | List runs, paginated |
| GET | /runs/{run_id} | 200 {summary} | 1 | Run metadata |
| GET | /runs/{run_id}/status | 200 {status, progress} | 2 | Poll run progress |
| GET | /runs/{run_id}/results | 200 {results[]} | 2 | Full results array |
| GET | /runs/{run_id}/dashboard | 200 {aggregate} | 2 | 5 charts + 5 KPI cards |
| GET | /runs/{run_id}/stocks/{ticker} | 200 {detail} | 2 | **[v1.1 NEW]** Stock analysis by run |
| GET | /runs/{run_id}/compare/{run_id_b} | 200 {diff} | 3 | Compare 2 runs (4-section schema §8.3) |
| DELETE | /runs/{run_id} | **200 + envelope** | 3 | **[v1.4]** Delete run (200+envelope, không 204 — rationale §8.1) |
| GET | /stocks | 200 {items[], total} | 2 | Whitelist + latest prices, paginated |
| GET | /stocks/{ticker} | 200 {static info} | 2 | Static info + latest price |
| GET | /stocks/{ticker}/prices | 200 {prices[]} | 2 | Historical OHLCV |
| GET | /news | 200 {items[], total} | 3 | News list, paginated |
| GET | /news/sentiment/{ticker} | 200 {summary} | 3 | Sentiment for ticker |
| GET | /portfolio | 200 {items[]} | 3 | Holdings |
| POST | /portfolio | 201 {holding} | 3 | Add holding |
| PUT | /portfolio/{id} | 200 {holding} | 3 | Update holding |
| DELETE | /portfolio/{id} | **200 + envelope** | 3 | **[v1.4]** Delete holding (rationale §8.1) |
| POST | /backtest | 202 {backtest_id, status: PENDING} | 4 | Start backtest (Stage 1 of 2-stage polling §8.6) |
| GET | /backtest/{id}/status | 200 {status, progress} | 4 | **[v1.4]** Poll backtest progress (1.5s interval) |
| GET | /backtest/{id} | 200 {metrics} | 4 | Backtest metrics (fetch khi terminal) |
| GET | /backtest/{id}/results | 200 {results[]} | 4 | **[v1.4]** Per-ticker backtest results |
| GET | /export/pdf/{run_id} | 200 binary/pdf | 3 | Download PDF (Content-Disposition attachment §9.1) |
| POST | /share | 201 {token, url, expires} | 4 | Create share link |
| GET | /share | 200 {items[]} | 4 | **[v1.5]** List active share links (Settings management) |
| GET | /share/{token} | 200 {read-only results} | 4 | View shared (PUBLIC route — bypass ProtectedRoute) |
| DELETE | /share/{token} | **200 + envelope** | 4 | **[v1.5]** Revoke share link (rationale §8.1) |
| POST | /telegram/test | 200 {sent, error} | 3 | Test send (~70% success / ~30% fail mock §9.4) |
| GET | /settings | 200 {settings} | 3 | Get settings |
| PUT | /settings | 200 {settings} | 3 | Update settings |

---

## 2. Pagination Standard

> [v1.1 SHOULD-FIX] Basic pagination

```
GET /news?limit=20&offset=0
GET /runs?limit=10&offset=0
GET /stocks?limit=100&offset=0

Response:
{
  "success": true,
  "data": {
    "items": [...],
    "total": 245,
    "limit": 20,
    "offset": 0
  }
}
```

---

## 3. Health & Version Responses

```json
GET /health → 200
{"status": "ok", "active_job": null}

GET /version → 200
{
  "app_version": "0.1.0",
  "prd_version": "v0.5A",
  "srs_version": "v1.4",
  "tad_version": "v1.5",
  "model_version": "baseline_v2",
  "db_tables": 16
}
```

---

## 4. Key Response: GET /runs/{run_id}/stocks/{ticker}

> [v1.1 MUST-FIX 2] Stock Detail scoped to run

```json
{
  "success": true,
  "data": {
    "ticker": "KDH",
    "name": "Khang Điền",
    "run_id": "run_20260504_001",
    "static": {
      "exchange": "HOSE",
      "sector": "Residential",
      "current_price": 32.5
    },
    "scoring": {
      "ai_score": 82,
      "recommendation": "MUA",
      "confidence_raw": 82,
      "confidence_penalty": 5,
      "confidence": 77,
      "target_price_3m": 38.5,
      "upside_pct": 18.5
    },
    "entry": {
      "signal": "BUY_NOW",
      "reason_code": "VALUATION_ATTRACTIVE+BULLISH_TREND",
      "support_zone": 30.5,
      "resistance_zone": 36.0
    },
    "risk": {
      "stop_loss_price": 29.25,
      "allocation_amount": 150000000,
      "allocation_weight": 0.30,
      "warning_badges": ["HIGH_INVENTORY"]
    },
    "reasons": [
      {"text": "ROE cao (16.8%)", "feature_id": "F03", "value": 16.8},
      {"text": "D/E thấp (0.8)", "feature_id": "F06", "value": 0.8}
    ],
    "features": {
      "F01": 12.5, "F02": 1.8, "F03": 16.8,
      "T01": 78, "T03": 52, "T05": 0.45
    },
    "feature_availability": 36,
    "radar": {
      "fundamental": 82, "technical": 68,
      "macro": 55, "realestate": 75, "sentiment": 52
    }
  }
}
```

---

## 5. Frontend API Client (`apiFetch`)

> [v1.2] Chốt từ cluster 1 prototype — tất cả API call FE đều đi qua wrapper này

```ts
// frontend/src/lib/api.ts
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('token')
    : null;

  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  // 401 anywhere → auto logout
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('UNAUTHORIZED');
  }

  const body = await res.json();

  // 409 → typed error cho job lock conflict (cluster 2 POST /api/run)
  if (res.status === 409) {
    throw new JobConflictError(body.error?.message ?? 'Job conflict', body.error?.code);
  }

  if (!body.success) {
    throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  }

  return body.data as T;
}

export class JobConflictError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'JobConflictError';
  }
}
```

**Trách nhiệm wrapper:**
1. Auto-inject `Authorization: Bearer {token}` từ `localStorage.token`.
2. Parse envelope `{success, data}` → return `data` trực tiếp; throw nếu `success=false`.
3. 401 → clear token + redirect `/login` (không retry).
4. 409 → throw `JobConflictError` typed (caller dùng `instanceof` để hiển thị toast "Đang có tác vụ chạy").
5. Network error / 5xx → throw generic `Error`, caller responsibility xử lý.

**Caller pattern:**

```ts
try {
  const data = await apiFetch<DashboardData>('/api/runs/123/dashboard');
} catch (e) {
  if (e instanceof JobConflictError) showToast(e.message, 'warning');
  else showToast('Lỗi tải dữ liệu', 'error');
}
```

---

## 6. Response Envelope (chuẩn cho mọi endpoint)

**Success:**
```json
{ "success": true, "data": <T> }
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERR-XX-XX",
    "message": "Human-readable VN message",
    "detail": "Technical detail (optional)"
  }
}
```

Backend FastAPI MUST wrap mọi response (kể cả 4xx/5xx) bằng envelope này. Xem [g05 §3 Error Response Standard](g05-cross-cutting.md). Frontend `apiFetch` rely vào shape này để parse.

---

## 7. Key Response Shapes (Cluster 4)

### 7.1 `GET /api/stocks?limit=100&offset=0`

```ts
type StockListItem = {
  ticker: string;
  name: string;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';
  sector: string;
  newly_listed: boolean;     // true cho 6 mã anchor (xem SRS g03 §P)
  latest: LatestPrice;
};

type LatestPrice = {
  open: number;       // ngàn đồng
  high: number;
  low: number;
  close: number;       // current_price (ưu tiên từ run mới nhất nếu có)
  reference: number;
  ceiling: number;
  floor: number;
  change: number;       // signed
  change_pct: number;   // signed %
  volume: number;       // raw shares
  as_of: string;        // ISO 8601
};
```

```json
{
  "success": true,
  "data": {
    "items": [ /* 81 StockListItem */ ],
    "total": 81,
    "limit": 100,
    "offset": 0
  }
}
```

**Anchor logic** (mock + backend):
- `current_price` ưu tiên lấy từ run mới nhất terminal (`runsStore.latest()`); fallback fixture seed nếu chưa có run. Đảm bảo Stock Detail header và Price Board cùng số tiền cho cùng 1 mã.
- `newly_listed=true` qua `NEWLY_LISTED_INDEXES = {5,17,31,46,58,73}` (mock); backend tính qua first-listed-date < 4 quarters.
- `seed%12 → ceiling`, `seed%13 → floor`, `seed%17 → reference` anchor cases (mock-only) đảm bảo AC-05-02 luôn cover 5 cases TTCK.

### 7.2 `GET /api/news?limit=20&offset=0&...`

Query params:

| Param | Type | Note |
|---|---|---|
| `limit`, `offset` | number | Default 20, 0 |
| `source` | NewsSource[] (CSV) | Multi-select OR-logic; empty = all |
| `sentiment` | SentimentLabel | Single; absent = ALL |
| `ticker` | string | Single; filter `related_tickers` contains |
| `from`, `to` | ISO 8601 | Date range |
| `mock_news_failure` | NewsSource | Dev only — simulate source down |

```ts
type NewsListResponse = {
  items: NewsArticle[];
  total: number;
  limit: number;
  offset: number;
  source_errors: NewsSource[];   // luôn tồn tại, có thể empty
};
```

**`source_errors` envelope:** 200 OK với array (KHÔNG return 503 per-source). Lý do: client cần data từ source khác + banner đồng thời. Xem [TAD c04 §4](c04-news-sentiment.md).

### 7.3 `GET /api/news/sentiment/{ticker}?days=30`

```ts
type SentimentSummaryResponse = {
  ticker: string;
  score_avg: number;             // 2dp signed
  label_counts: {
    POSITIVE: number;
    NEUTRAL: number;
    NEGATIVE: number;
  };
  source_breakdown: Record<NewsSource, number>;
  total: number;
};
```

**count=0 case (GUARD-08):**

```json
{
  "success": true,
  "data": {
    "ticker": "MOCK_INSUFFICIENT",
    "score_avg": 0.0,
    "label_counts": { "POSITIVE": 0, "NEUTRAL": 0, "NEGATIVE": 0 },
    "source_breakdown": {},
    "total": 0
  }
}
```

Frontend SentimentSummaryWidget render "Không có tin trong 30 ngày" italic note thay vì error (xem [SRS f10 AC-10-12](../srs/f10-news-sentiment.md)).

---

## 8. Key Response Shapes (Cluster 5)

### 8.1 DELETE Endpoints — 200 + Envelope (NOT 204)

Cluster 5 **đổi convention** cho mọi DELETE endpoint: trả `200 OK + {success:true, data:{deleted:true}}` thay vì `204 No Content`.

**Rationale:** `apiFetch` wrapper (xem §5) parse JSON với `await res.json()`. 204 empty body → `await res.json()` throw `SyntaxError: Unexpected end of JSON input`. Để giữ envelope đồng nhất + `apiFetch` không cần special-case 204 → return 200 với envelope `{deleted: true}`.

**Trade-off:** lệch khỏi REST best-practice (DELETE thường 204). Nhưng UI nhận envelope nhất quán — đáng đổi.

**Áp dụng:** `DELETE /portfolio/{id}`, `DELETE /runs/{id}`, `DELETE /share/{token}` (cluster 6).

### 8.2 Portfolio

**`GET /api/portfolio`:**

```ts
type PortfolioListResponse = {
  items: PortfolioHolding[];
  total: number;
};

type PortfolioHolding = {
  id: number;
  ticker: string;
  quantity: number;
  buy_price: number;        // ngàn đồng
  buy_date: string;          // YYYY-MM-DD
  notes?: string;
  created_at: string;
  updated_at: string;
};
```

Frontend page join với `/api/stocks` snapshot trong `useMemo` để build `HoldingRow[]` (= holding + computed `current_price`, `cost_basis`, `market_value`, `unrealized_pnl`, `unrealized_pnl_pct`).

**`POST /api/portfolio` validateHolding (server-side mirror SRS f11 AC-11-02..04 + buy_date ≤ TODAY):**

```ts
function validateHolding(req: PortfolioCreateRequest): ValidationError | null {
  if (!STOCK_FIXTURE.includes(req.ticker)) return { code: 'ERR-11-04', ... };
  if (!Number.isInteger(req.quantity) || req.quantity <= 0) return { code: 'ERR-11-02', ... };
  if (!Number.isFinite(req.buy_price) || req.buy_price <= 0) return { code: 'ERR-11-03', ... };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.buy_date)) return { code: 'ERR-11-05', ... };
  if (req.buy_date > MOCK_FIXTURE_TODAY) return { code: 'ERR-11-06', ... };  // xem SRS g03 §S
  return null;
}
```

### 8.3 Compare Response (4 sections)

**`GET /api/runs/{a}/compare/{b}`** — schema mới cluster 5 (REPLACE old `{added_to_buy, removed_from_buy, ...}`):

```ts
type CompareResponse = {
  summary_diff: {
    scored: { a: number, b: number, delta: number },
    buy_count: { a: number, b: number, delta: number },
    hold_count: { a: number, b: number, delta: number },
    sell_count: { a: number, b: number, delta: number },
    avg_score: { a: number, b: number, delta: number },
    duration_seconds: { a: number, b: number, delta: number }
  };
  recommendation_changes: Array<{
    ticker: string; name: string;
    rec_a: 'MUA' | 'GIỮ' | 'BÁN';
    rec_b: 'MUA' | 'GIỮ' | 'BÁN';
    score_a: number; score_b: number;
    direction: 'upgrade' | 'downgrade';   // theo REC_RANK heuristic — xem SRS g03 §Q
  }>;
  new_entries: Array<{ ticker, name, rec_b, score_b }>;
  removed:     Array<{ ticker, name, rec_a, score_a }>;
  score_distribution: {
    buckets: ['<30', '30-45', '45-60', '60-75', '75-90', '≥90'],
    a_counts: number[];   // 6 numbers
    b_counts: number[];
  };
};
```

**Validation:** `run_a !== run_b` server-side → 400 ERR-12-01.

**Compute pattern (mock):** `computeCompare()` thuần function đọc `runsStore.get(a).computed.results` trực tiếp, KHÔNG roundtrip 2 lần `/api/runs/{id}/results`. Backend phase phải tự fetch khi MSW thay bằng FastAPI thật.

### 8.4 RunSummary Expanded (cluster 5 additive)

Cluster 5 thêm 5 field vào `RunSummary` (additive — RunSelector cluster 2 không bị ảnh hưởng):

```ts
type RunSummary = {
  // cluster 2 fields (existing)
  run_id: string;
  run_at: string;
  status: RunStatus;
  scored_count: number;
  buy_count: number;
  hold_count: number;
  sell_count: number;
  // cluster 5 new fields (additive)
  model_version: 'baseline_v1' | 'baseline_v2';
  settings_version: number;            // 1 | 2
  duration_seconds: number;             // live cho active runs (now - started_at_ms); recalc khi terminal
  warnings_count: number;               // derived từ warnings_json.length
  avg_score: number;                    // mean(ai_score) trên scored
};
```

**`runs-store.start()`** mặc định `baseline_v2` + settings 2 (production model). Cluster 6 wire Settings UI → runsStore.

### 8.5 Backtest 2-Stage Polling

```
Stage 1: POST /api/backtest
         body: { period_from, period_to }
         response: 202 { backtest_id, status: 'PENDING' }
         frontend: setActiveId(backtest_id)

Stage 2: usePolling on /api/backtest/{id}/status
         interval: 1500ms (NOT 2000ms — backtest only 8.5s total)
         terminal: COMPLETED | FAILED
         When status === 'COMPLETED':
           fire /api/backtest/{id}        (metrics)
           fire /api/backtest/{id}/results (per-ticker rows)
           via useApiResource (single-fire, không poll)
```

**State machine 4 transitions:** PENDING → RUNNING (5%) → RUNNING (25%) → RUNNING (55%) → RUNNING (80%) → COMPLETED. Total 8.5s mock.

**1.5s vs 2s rationale:** backtest chỉ 8.5s mock total, polling 2s tick chỉ 4 lần → progress jump rời rạc. 1.5s tick 5-6 lần smooth hơn.

### 8.6 BacktestMetricsResponse + ResultsResponse

```ts
type BacktestMetricsResponse = {
  backtest_id: number;
  period_from: string;
  period_to: string;
  status: 'COMPLETED' | 'FAILED';
  recommendation_accuracy: number;     // 0..1
  price_error_mean: number;             // 0..100 (%)
  portfolio_roi: number;                // signed % (e.g. +18.5)
  vnindex_roi: number;
  alpha: number;                         // = portfolio_roi - vnindex_roi
  correct_count: number;
  total_count: number;                   // = scored_count latest run, NOT 81
  roi_curve: Array<{ week: string; portfolio: number; vnindex: number }>;  // 9-26 weekly points
};

type BacktestResultsResponse = {
  results: Array<{
    ticker: string;
    predicted_recommendation: 'MUA' | 'GIỮ' | 'BÁN';
    predicted_price: number;             // ngàn đồng
    actual_price: number;                 // mock: predicted × (1 ± errPct)
    price_error_pct: number;
    actual_return_3m: number;             // signed %
    recommendation_correct: boolean;       // heuristic — xem SRS f12 AC-12-23
  }>;
};
```

**Mock heuristic correctness** (prototype, KHÔNG strict per PRD §4.5):
- MUA: `actual_return_3m > 0`
- GIỮ: `-7% ≤ actual_return_3m ≤ +12%` (xem g03 §K BACKTEST_HOLD_RETURN_*)
- BÁN: `actual_return_3m < 0`

Backend Phase 4 phải implement strict version với per-ticker VN-Index reference (mock không track).

---

## 9. Key Response Shapes (Cluster 6)

### 9.1 PDF Export — `GET /api/export/pdf/{run_id}`

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="run-{id}.pdf"

<binary PDF>          # production weasyprint
<HTML string>         # prototype mock (xem c06 §1.2)
```

**Trade-off prototype:** HTML giả serve as `application/pdf` — file `.pdf` mở bằng PDF reader sẽ broken; mở bằng browser sẽ render OK. Production replace mock template bằng weasyprint render thật. Frontend KHÔNG đổi (download flow giống nhau).

### 9.2 Share — Create + List + Get + Delete

**`POST /api/share`:**

```ts
type ShareCreateRequest = { run_id: string; expires_in_days?: number };  // default 7

type ShareCreateResponse = {
  token: string;          // uuid v4
  url: string;             // https://app.example/share/{token} — store URL
  created_at: string;
  expires_at: string;      // +7 days
};
```

Status: 201 Created.

**`GET /api/share`** (Settings management):

```ts
type ShareListResponse = {
  items: Array<{
    token: string;
    run_id: string;
    created_at: string;
    expires_at: string;
  }>;
};
```

Sort newest first. Filter only non-expired (production).

**`GET /api/share/{token}`** (PUBLIC, no auth):

```ts
type SharedViewResponse = {
  token: string;
  run_id: string;
  expires_at: string;
  data: {
    summary: { /* ...same as DashboardResponse.summary */ };
    dashboard: { /* ...DashboardResponse */ };
    top_mua: TopMuaItem[];     // read-only Top MUA
  };
};
```

404 nếu token invalid hoặc expired.

**`DELETE /api/share/{token}`:** 200 + envelope `{deleted: true}` (xem §8.1 cluster 5 rationale).

### 9.3 Frontend Share URL — 2 Forms

| Form | Where stored | Where actually used |
|---|---|---|
| Mock backend URL `https://app.example/share/{token}` | `ShareLink.url` field (matches TAD spec) | — |
| Origin-relative `${window.location.origin}/share/{token}` | computed at copy time | Clipboard write — user mở được trên cùng tab |

**Rationale:** prototype chạy ở `localhost:3001`; copy mock URL → user mở sẽ broken (no DNS). Button "Sao chép" override với `window.location.origin`. Production: backend trả URL **relative** (`/share/{token}`), frontend tự build với origin runtime → không hardcode domain.

### 9.4 Telegram Test — `POST /api/telegram/test`

```ts
type TelegramTestResponse = {
  sent: boolean;
  error: string | null;
};
```

**Mock distribution (cluster 6):**
- `Math.random() >= 0.3` → `{sent: true, error: null}` (~70%)
- `Math.random() < 0.3` → `{sent: false, error: 'Telegram API timeout' | 'Bot token invalid' | 'Chat not found'}` (~30%)

**Envelope:** `{success: true, data: {sent, error}}` — HTTP success (200), Telegram error là application-level state. Frontend handle qua `data.sent` flag (xem [c07 §4](c07-telegram.md)).

### 9.5 Password Change — `PUT /api/auth/password`

```ts
type PasswordChangeRequest = {
  current: string;
  new: string;
};

type PasswordChangeResponse = {
  token: string;       // new JWT (production) hoặc mock_jwt_{ts} (prototype)
};
```

Validation:
- `current` empty → 400 ERR-AUTH-01 "Mật khẩu hiện tại bắt buộc"
- `new.length < 8` → 400 ERR-AUTH-02 "Mật khẩu mới phải ≥8 ký tự"
- (Production) bcrypt verify `current` against `user_profile.password_hash`

Frontend: write `localStorage.token = response.token` trực tiếp (KHÔNG qua `AuthContext.setToken`); subsequent API calls dùng token mới tự động qua `apiFetch` reads localStorage mỗi request. Xem [c08 §5](c08-auth.md) cho rationale.
