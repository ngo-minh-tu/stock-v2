---
title: 07 — Cache & Cross-cutting
source: TAD g04 (cache), g05 (concurrency + logging + errors), g07 (deployment)
---

# 07 — Cache & Cross-cutting

3 cross-cutting concerns: **cache** (granularity + TTL), **job lock** (concurrency), **error envelope** (response standard).

## Cache — source-level TTL (g04)

```mermaid
flowchart LR
    subgraph Sources["External — fetched by Crawlers"]
        VN[vnstock]
        SBV[SBV]
        GSO[GSO]
        Cafef
        VnEx[VnExpress]
        Vietstock
        BDS[Batdongsan]
        TN[ThanhNien]
    end

    Sources --> CacheMgr

    subgraph CacheMgr["Cache Manager — granularity = SOURCE level"]
        direction TB
        Meta[("cache_metadata<br/>PK = source<br/>last_refreshed_at + ttl_hours")]
        IsStale["is_stale(source):<br/>now - last_refreshed_at > ttl_hours × 3600"]
        Meta --> IsStale
    end

    subgraph TTL["TTL configuration"]
        direction TB
        T1["VNSTOCK_PRICES → 4h phiên / 24h ngoài giờ"]
        T2["VNSTOCK_FINANCIALS → 30 ngày"]
        T3["MACRO_SBV / MACRO_GSO → 30 ngày"]
        T4["NEWS_* (5 sources) → 6h"]
    end

    CacheMgr --> TTL
    IsStale --> Decision{stale?}
    Decision -- yes --> Refresh["Refresh flow trigger<br/>POST /api/refresh/all"]
    Decision -- no --> Use["Screening reads cached"]

    Refresh -.- RateLimit["⏱️ vnstock rate limit<br/>VNSTOCK_DELAY_SECONDS = 0.5<br/>between calls"]
```

**Granularity decision (g04 §1):**

| Aspect | MVP | Post-MVP |
|---|---|---|
| Cache key | `source` (e.g. `VNSTOCK_PRICES`) | `(source, ticker)` ticker-level |
| All ~81 tickers per source | Share TTL | Independent TTL |
| Refresh by source | All-or-nothing | Per-ticker resync |

## Job lock — single heavy job (g05 §1)

```mermaid
stateDiagram-v2
    [*] --> Free
    Free --> Held_Refresh : acquire("refresh_all"|"refresh_prices")
    Free --> Held_Screening : acquire("screening_run")
    Free --> Held_Backtest : acquire("backtest")

    Held_Refresh --> Free : release()
    Held_Screening --> Free : release()
    Held_Backtest --> Free : release()

    Held_Refresh --> Held_Refresh : new heavy job → 409<br/>JOB_CONFLICT
    Held_Screening --> Held_Screening : new heavy job → 409
    Held_Backtest --> Held_Backtest : new heavy job → 409

    note right of Free
      Lock = threading.Lock()
      _active_job : str | None
    end note

    note right of Held_Screening
      MVP STRICT: refresh ∪ screening
      ∪ backtest = ONLY 1 at a time
    end note
```

**API behavior khi lock held:**

```json
HTTP 409 CONFLICT
{
  "success": false,
  "error": {
    "code": "JOB_CONFLICT",
    "message": "Đang có tác vụ chạy: {active_job}. Vui lòng đợi hoàn thành."
  }
}
```

→ Frontend `apiFetch` catch 409 → throw `JobConflictError` → caller hiển thị toast warning (xem [g02 §5](../tad/g02-api.md)).

## Error envelope (g05 §3 + g02 §6)

```mermaid
flowchart TB
    Req[Client request<br/>apiFetch&lt;T&gt;] --> API[FastAPI handler]
    API --> Branch{outcome?}

    Branch -- "OK" --> Success["200 / 201 / 202<br/>{success: true, data: T}"]
    Branch -- "Validation" --> E400["400<br/>{success: false, error: {code, message}}"]
    Branch -- "Auth" --> E401["401 → apiFetch clears token<br/>+ redirect /login"]
    Branch -- "Lock" --> E409["409 JOB_CONFLICT<br/>→ apiFetch throws<br/>JobConflictError"]
    Branch -- "Not found" --> E404["404"]
    Branch -- "Server" --> E500["500<br/>{success: false, error}"]

    Success --> Parse[apiFetch returns body.data]
    E400 --> Throw[apiFetch throws Error]
    E404 --> Throw
    E500 --> Throw
    E401 --> Logout[Auto-logout]
    E409 --> JCE[JobConflictError]

    Parse --> Caller
    Throw --> Caller
    JCE --> Caller
    Logout --> Caller

    Caller["Caller component<br/>try/catch"]
```

**Convention chốt cluster 5/6:** DELETE endpoints trả **200 + envelope** thay vì 204 — vì `apiFetch` parse `await res.json()` (xem [g02 §8.1](../tad/g02-api.md)).

| Endpoint | Old | New |
|---|---|---|
| `DELETE /portfolio/{id}` | 204 No Content | 200 `{deleted: true}` |
| `DELETE /runs/{id}` | — (not exist) | 200 `{deleted: true}` |
| `DELETE /share/{token}` | — (not exist) | 200 `{deleted: true}` |

## SQLite hardening (g07)

```mermaid
flowchart LR
    Conn[SQLAlchemy connect] --> Pragmas

    subgraph Pragmas["@event.listens_for connect"]
        WAL["PRAGMA journal_mode=WAL"]
        Sync["PRAGMA synchronous=NORMAL"]
        FK["PRAGMA foreign_keys=ON"]
        Busy["PRAGMA busy_timeout=30000ms<br/>(env: SQLITE_BUSY_TIMEOUT_MS)"]
    end

    Pragmas --> Rules

    subgraph Rules["Transaction rules"]
        R1[KHÔNG giữ tx mở<br/>khi crawl external]
        R2[KHÔNG giữ tx mở<br/>khi gọi model inference]
        R3[KHÔNG giữ tx mở<br/>khi generate PDF]
        R4[Backtest write<br/>= batch insert nhỏ]
    end

    Rules --> Outcome[Giảm 'database is locked' errors]
```

## MSW dev mock boundary (g05 §5)

```mermaid
flowchart LR
    Dev[Frontend dev<br/>NODE_ENV=development] --> Boot[MswBootstrap component]
    Boot --> Worker["public/mockServiceWorker.js<br/>(npx msw init public/)"]
    Worker --> Handlers[handlers.ts]

    Handlers --> Explicit["Explicit handlers<br/>per cluster"]
    Handlers --> CatchAll["http.all('/api/*')<br/>→ 404 NOT_IMPLEMENTED<br/>+ VN message"]

    Production[Production build] --> NoMsw[MswBootstrap pass-through<br/>NEXT_PUBLIC_API_URL → real backend]
```

> Catch-all → dev thấy ngay endpoint chưa mock (toast tiếng Việt rõ ràng), thay vì silent fail. Phát hiện sớm gap mock.

## Notes

- **Cache + JobLock + Error envelope** là 3 concern chạy ngang qua mọi service. Đổi 1 trong 3 = ảnh hưởng toàn hệ thống.
- **MVP scope cứng**: 1 lệnh refresh per ngày, 1 screening tại 1 thời điểm. Beta multi-user sẽ phải nâng cấp:
  - JobLock → Redis distributed lock hoặc job queue (Celery/RQ).
  - Cache granularity → ticker-level.
  - Refresh job status → persistent table thay in-memory registry.
- **Logging**: structured JSON ghi vào `backend/logs/app.log` (xem [g05 §2](../tad/g05-cross-cutting.md)). Mỗi log entry kèm `run_id` + `module` để trace cross-service.
