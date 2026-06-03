---
title: 04 — Runtime Flows
source: TAD g01 (runtime), g02 §8.5 (backtest), c08 (auth)
---

# 04 — Runtime Flows

Two-Flow Architecture: **Refresh** (1 lần/ngày, fetch external) vs **Screening** (đọc DB/cache, KHÔNG fetch). Chi tiết [g01 §1](../tad/g01-runtime.md).

## Run state machine — 7 states (g01 §2.1)

```mermaid
stateDiagram-v2
    [*] --> PENDING : POST /api/run<br/>202 Accepted
    PENDING --> CHECKING_DATA : background task start
    CHECKING_DATA --> SCREENING : 4 vòng lọc
    SCREENING --> SCORING : feature eng + scoring/price/entry/risk
    SCORING --> COMPLETED : success<br/>(no warnings)
    SCORING --> COMPLETED_WITH_WARNINGS : success<br/>+ stale data | TG fail | source err | imputed feats
    SCORING --> FAILED : crash / unexpected error

    CHECKING_DATA --> FAILED : exception
    SCREENING --> FAILED : exception

    COMPLETED --> [*]
    COMPLETED_WITH_WARNINGS --> [*]
    FAILED --> [*]

    note right of PENDING
      Frontend poll
      /api/runs/{id}/status
      every 2s
    end note

    note right of COMPLETED
      Terminal — RunContext fires
      lastCompletedRunId broadcast
      Pages auto-reload
    end note
```

> SRS g03 Appendix simplified view = `RUNNING / COMPLETED / FAILED`. Implementation 7 states ở trên là canonical. `RUNNING` trong SRS = `CHECKING_DATA ∪ SCREENING ∪ SCORING`.

## Refresh flow (g01 §1 Flow 1)

```mermaid
sequenceDiagram
    autonumber
    actor PO
    participant FE as Frontend
    participant API as FastAPI
    participant Lock as JobLock
    participant Reg as Job Registry<br/>(in-memory)
    participant Crawl as Crawlers
    participant DB as SQLite
    participant Ext as vnstock / RSS /<br/>World Bank + vnstock (macro)

    PO->>FE: Click "Cập nhật dữ liệu"
    FE->>API: POST /api/refresh/all
    API->>Lock: acquire("refresh_all")
    alt Lock available
        Lock-->>API: ok
        API->>Reg: register(refresh_id, PENDING)
        API-->>FE: 202 {refresh_id}
        FE->>FE: start polling 2s
        Note over API,Crawl: Background task
        API->>Crawl: fetch vnstock prices (0.5s/call)
        Crawl->>Ext: GET prices ~81 tickers
        Ext-->>Crawl: OHLCV
        Crawl->>DB: upsert stock_prices
        Crawl->>Ext: GET financials (quarterly)
        Crawl->>DB: upsert financial_reports
        Crawl->>Ext: GET macro (World Bank API M01-M04 + vnstock VN-Index M05)
        Crawl->>DB: upsert macro_data
        Crawl->>Ext: RSS crawl 5 sources
        Crawl->>Crawl: sentiment classify (keyword MVP)
        Crawl->>DB: upsert news_articles
        API->>DB: update cache_metadata.last_refreshed_at
        API->>Reg: update(refresh_id, COMPLETED)
        API->>Lock: release()
    else Lock held
        Lock-->>API: busy
        API-->>FE: 409 JOB_CONFLICT<br/>{message: "Đang có tác vụ chạy"}
        FE->>FE: toast warning (JobConflictError)
    end

    loop Poll until terminal
        FE->>API: GET /api/refresh/{id}/status
        API->>Reg: lookup
        Reg-->>API: status + progress
        API-->>FE: {status, progress_percent}
    end

    FE->>PO: "Đã cập nhật"
```

## Screening flow (g01 §1 Flow 2)

```mermaid
sequenceDiagram
    autonumber
    actor PO
    participant FE as Frontend
    participant API as FastAPI
    participant Lock as JobLock
    participant Svc as screening_service
    participant Filter as filter_service
    participant Feat as feature_service
    participant Engines as Engines<br/>(Score/Price/Entry/Risk)
    participant DB as SQLite

    PO->>FE: Click "Chạy"
    FE->>API: POST /api/run<br/>{thresholds, settings_version}
    API->>API: validate input
    API->>DB: empty? → 400 "Vui lòng Cập nhật dữ liệu"
    API->>Lock: acquire("screening_run")
    alt Lock free
        Lock-->>API: ok
        API->>DB: INSERT screening_runs (PENDING)
        API-->>FE: 202 {run_id, status: PENDING}
        FE->>FE: setActiveRunId + start usePolling 2s

        Note over API,Engines: Background task
        Svc->>DB: status=CHECKING_DATA, progress=10%
        Svc->>Filter: 4 vòng lọc<br/>(whitelist → fundamentals → technical → data quality)
        Filter->>DB: insert excluded_stocks per round
        Svc->>DB: status=SCREENING, progress=40%
        Svc->>Feat: compute 38 features × N tickers
        Feat->>DB: SELECT prices/financials/macro
        Feat-->>Svc: features dict
        Svc->>DB: status=SCORING, progress=75%

        loop Per ticker
            Svc->>Engines: scoring.score(features)
            Svc->>Engines: price.predict(prices, features)
            Svc->>Engines: entry.evaluate(input)
            Svc->>Engines: risk.compute(stop_loss, allocation, badges)
            Svc->>DB: insert screening_results
        end

        alt Has warnings (stale / TG fail / imputed / source err)
            Svc->>DB: status=COMPLETED_WITH_WARNINGS
        else Clean
            Svc->>DB: status=COMPLETED
        end
        opt Telegram enabled
            Svc->>Svc: send summary (non-blocking)
        end
        API->>Lock: release()
    else Lock held
        API-->>FE: 409 JOB_CONFLICT
    end

    loop Poll until terminal (terminal = COMPLETED ∪ COMPLETED_WITH_WARNINGS ∪ FAILED)
        FE->>API: GET /api/runs/{id}/status
        API-->>FE: {status, progress_percent, current_step, message, warnings}
    end

    FE->>FE: RunContext.lastCompletedRunId = run_id<br/>fire toast (3s success / 4s failed)<br/>broadcast

    par Dashboard reload
        FE->>API: GET /api/runs/{id}/dashboard
    and Results reload
        FE->>API: GET /api/runs/{id}/results
    end
    API-->>FE: aggregate + results array
    FE->>PO: render Dashboard / Top MUA / Red Flags
```

## Backtest 2-stage polling (g02 §8.5)

```mermaid
sequenceDiagram
    autonumber
    participant FE
    participant API

    FE->>API: POST /api/backtest<br/>{period_from, period_to}
    API-->>FE: 202 {backtest_id, status: PENDING}

    Note over FE,API: Stage 1 — poll status @ 1.5s<br/>(NOT 2s — backtest only 8.5s total)
    loop Until terminal
        FE->>API: GET /api/backtest/{id}/status
        API-->>FE: {status, progress}<br/>PENDING → RUNNING(5%) → RUNNING(25%) → RUNNING(55%) → RUNNING(80%) → COMPLETED
    end

    Note over FE,API: Stage 2 — fetch on terminal (single-fire)
    par
        FE->>API: GET /api/backtest/{id}<br/>(metrics)
        API-->>FE: {recommendation_accuracy, alpha, roi_curve, ...}
    and
        FE->>API: GET /api/backtest/{id}/results<br/>(per-ticker)
        API-->>FE: {results[]: predicted vs actual}
    end
    FE->>FE: render BacktestDashboard
```

## RunContext mount-once hydration (g01 §4.5)

```mermaid
sequenceDiagram
    autonumber
    participant Page as Stock Detail page<br/>(deep-link no run_id)
    participant Run as RunProvider
    participant API

    Page->>Run: mount
    Run->>API: GET /api/runs?limit=1
    Note right of Run: 3-branch consumer pattern:<br/>!runId && !runsHydrated → Spinner<br/>!runId && runsHydrated → NoRunMessage<br/>runId → fetch detail
    API-->>Run: {items: [latestRun]}
    alt latest is terminal
        Run->>Run: setLastCompletedRunId(prev ?? latest.run_id)<br/>functional updater
    end
    Run->>Run: setRunsHydrated(true)
    Run-->>Page: {lastCompletedRunId, runsHydrated}
    Page->>API: GET /api/runs/{id}/stocks/{ticker}
```

## Notes

- **Job lock** scope: refresh ∪ screening ∪ backtest = **chỉ 1** chạy đồng thời. Vi phạm → 409 + `JobConflictError` ở FE (xem [g05 §1](../tad/g05-cross-cutting.md)).
- **Polling interval**: screening = 2000ms; backtest = 1500ms (chỉ 8.5s total → 2s tick chỉ 4 lần, jump rời rạc); refresh = 2000ms.
- **`cancelledRef` pattern**: `usePolling` dùng `useRef` (KHÔNG `useState`) để chống late-fire sau unmount (xem [g01 §4.1](../tad/g01-runtime.md)).
- **Functional setState ở dismiss timer**: chống race khi user start run mới trước khi timer fire — captured runId vs current state (xem [g01 §4.4](../tad/g01-runtime.md)).
