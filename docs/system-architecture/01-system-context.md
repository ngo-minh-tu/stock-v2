---
title: 01 — System Context
source: TAD 00 §1 System Architecture Overview, c08, c06
---

# 01 — System Context

Boundary cao nhất: ai dùng hệ thống, hệ thống gồm gì, kết nối ra ngoài thế nào.

## Diagram

```mermaid
flowchart TB
    %% Actors
    PO(["👤 PO Ngô Minh Tú<br/>(single user, JWT)"])
    Viewer(["👤 Public viewer<br/>(read-only via /share/{token})"])

    %% Frontend
    subgraph FE["🖥️ Frontend — Next.js 14+ App Router"]
        direction TB
        AppGroup["(app) — protected routes<br/>Dashboard · Top MUA · Red Flags<br/>Stock Detail · Price Board · News<br/>Portfolio · Run History · Settings"]
        AuthRoute["(auth) /login"]
        ShareRoute["share/{token} — PUBLIC"]
    end

    %% Backend
    subgraph BE["⚙️ Backend — FastAPI"]
        direction TB
        APIRouter["API Router Layer<br/>(g02 endpoint registry)"]
        Services["Services<br/>refresh · screening · feature<br/>filter · risk · news · portfolio<br/>backtest · export · share · telegram"]
        Engines["Engines<br/>Scoring · Price · Entry · Risk"]
        Crawlers["Crawlers<br/>vnstock · news · macro"]
        JobLock{{"🔒 JobLock singleton<br/>max 1 heavy job"}}
        DB[("🗄️ SQLite<br/>16 tables<br/>WAL + busy_timeout 30s")]
        CacheMeta["Cache Manager<br/>source-level TTL<br/>(g04)"]
    end

    %% External
    subgraph Ext["🌐 External Sources"]
        direction TB
        VN["vnstock<br/>0.5s rate limit"]
        RSS["5 RSS feeds<br/>CafeF · VnExpress · Vietstock<br/>Batdongsan · ThanhNien"]
        Macro["SBV / GSO<br/>(rates, CPI, FDI, credit)"]
        TG["Telegram Bot API"]
    end

    %% Hosting
    Ngrok(["🔗 ngrok tunnel<br/>+ Basic Auth on /share/*"]):::infra

    %% Wires
    PO -- HTTPS --> AuthRoute
    PO -- HTTPS + JWT --> AppGroup
    Viewer -- HTTPS + Basic Auth --> Ngrok
    Ngrok --> ShareRoute

    AppGroup -- "REST<br/>Bearer token" --> APIRouter
    AuthRoute -- "POST /auth/login" --> APIRouter
    ShareRoute -- "GET /share/{token}<br/>(no JWT)" --> APIRouter

    APIRouter --> Services
    Services --> Engines
    Services --> Crawlers
    Services -- repositories --> DB
    Engines -- repositories --> DB
    Services --> CacheMeta
    CacheMeta --> DB

    Services -. acquire/release .-> JobLock

    Crawlers --> VN
    Crawlers --> RSS
    Crawlers --> Macro
    Services -- "non-blocking<br/>send summary" --> TG

    BE -. exposed via .-> Ngrok

    classDef infra fill:#fef3c7,stroke:#b45309,color:#78350f;
```

## Notes

- **Single user MVP:** chỉ 1 PO duy nhất login bằng password → nhận JWT 24h. Public viewer của `/share/{token}` không có session, được bảo vệ bởi ngrok Basic Auth ở production (xem [c06 §8](../tad/c06-pdf-share.md)).
- **External 4 nhóm:** vnstock (price + financials), 5 RSS news, SBV/GSO macro, Telegram outbound. Refresh chỉ chạy thủ công 1 lần/ngày — screening **không** fetch external (xem [g01 §1](../tad/g01-runtime.md)).
- **Job lock** ngăn refresh/screening/backtest chạy đồng thời — chi tiết [diagram 07](07-cache-cross-cutting.md) và [g05 §1](../tad/g05-cross-cutting.md).
