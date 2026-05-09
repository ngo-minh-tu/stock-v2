---
id: g02
title: API Design — Endpoint Registry, Pagination, Health/Version, Key Responses
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§7); cluster 1 reconciliation 2026-05-09
version: v1.3 LOCKED (cluster 4 reconciliation)
---

# g02 — API Design

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ➕ Bổ sung §5 (Frontend API client `apiFetch` wrapper pattern: Bearer auto, envelope parse, 401 auto-logout, `JobConflictError` cho 409) và §6 (Response envelope shape — chuẩn hóa cho cả success & error). ❌ §3 health/version response: bump `srs_version: v1.0 → v1.2`, `tad_version: v1.1 → v1.2` (đồng bộ với cluster 1 reconciliation).
- **v1.3 (2026-05-09, cluster 4 reconciliation):** ➕ Bổ sung §7 Key Response Shapes (Cluster 4): `GET /api/stocks` (LatestPrice + newly_listed flag), `GET /api/news` (source_errors envelope + pagination), `GET /api/news/sentiment/{ticker}` (30-day rollup, count=0 → NEUTRAL/0.0/empty breakdown). Bump `srs_version: v1.2 → v1.4`, `tad_version: v1.2 → v1.3`.

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
| GET | /runs/{run_id}/compare/{run_id_b} | 200 {diff} | 3 | Compare 2 runs |
| GET | /stocks | 200 {items[], total} | 2 | Whitelist + latest prices, paginated |
| GET | /stocks/{ticker} | 200 {static info} | 2 | Static info + latest price |
| GET | /stocks/{ticker}/prices | 200 {prices[]} | 2 | Historical OHLCV |
| GET | /news | 200 {items[], total} | 3 | News list, paginated |
| GET | /news/sentiment/{ticker} | 200 {summary} | 3 | Sentiment for ticker |
| GET | /portfolio | 200 {items[]} | 3 | Holdings |
| POST | /portfolio | 201 {holding} | 3 | Add holding |
| PUT | /portfolio/{id} | 200 {holding} | 3 | Update holding |
| DELETE | /portfolio/{id} | 204 | 3 | Delete holding |
| POST | /backtest | 202 {backtest_id} | 4 | Start backtest |
| GET | /backtest/{id} | 200 {metrics} | 4 | Backtest results |
| GET | /export/pdf/{run_id} | 200 binary/pdf | 3 | Download PDF |
| POST | /share | 201 {token, url, expires} | 4 | Create share link |
| GET | /share/{token} | 200 {read-only results} | 4 | View shared |
| POST | /telegram/test | 200 {sent, error} | 3 | Test send |
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
  "tad_version": "v1.3",
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
