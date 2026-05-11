---
title: 02 — Backend Layers
source: TAD 00 §3 Project Structure, g01, g02, g03, g05
---

# 02 — Backend Layers

Layer pattern bắt buộc: **API Router → Service → Repository → SQLAlchemy → SQLite**. KHÔNG query SQL trực tiếp trong Services ([TAD 00 §3](../tad/00-tad-system-overview.md)).

## Layered architecture

```mermaid
flowchart TB
    subgraph API["1️⃣ API Router Layer  —  app/api/"]
        direction LR
        a_auth[auth.py]
        a_refresh[refresh.py]
        a_screening[screening.py]
        a_dashboard[dashboard.py]
        a_stocks[stocks.py]
        a_portfolio[portfolio.py]
        a_news[news.py]
        a_backtest[backtest.py]
        a_export[export.py]
        a_share[share.py]
        a_telegram[telegram.py]
        a_settings[settings.py]
    end

    subgraph Service["2️⃣ Service Layer  —  app/services/"]
        direction LR
        s_refresh[refresh_service]
        s_screening[screening_service]
        s_feature[feature_service]
        s_filter[filter_service]
        s_risk[risk_service]
        s_news[news_service]
        s_portfolio[portfolio_service]
        s_backtest[backtest_service]
        s_export[export_service]
        s_share[share_service]
        s_telegram[telegram_service]
    end

    subgraph Engine["3️⃣ Engines  —  app/engines/"]
        direction LR
        e_score[scoring_baseline → xgboost]
        e_price[price_baseline → lstm]
        e_entry[entry_engine<br/>deterministic]
        e_base[base.py<br/>abstract interfaces]
    end

    subgraph Crawl["3️⃣ Crawlers  —  app/crawlers/"]
        direction LR
        c_vn[vnstock_client<br/>0.5s rate limit]
        c_news[news_crawler<br/>RSS → HTML fallback]
        c_macro[macro_crawler<br/>SBV / GSO]
        c_cache[cache_manager<br/>source-level TTL]
    end

    subgraph Repo["4️⃣ Repository Layer  —  app/repositories/"]
        direction LR
        r_stock[stock_repo]
        r_price[price_repo]
        r_fin[financial_repo]
        r_screen[screening_repo]
        r_news[news_repo]
        r_pf[portfolio_repo]
        r_set[settings_repo]
        r_cache[cache_repo]
    end

    subgraph Persistence["5️⃣ Persistence"]
        direction LR
        sqla[("SQLAlchemy 2.0<br/>async ORM")]
        sqlite[("SQLite<br/>WAL + foreign_keys=ON<br/>busy_timeout=30s")]
    end

    %% Cross-cutting
    JobLock{{"🔒 JobLock singleton<br/>g05 §1<br/>refresh ∪ screening ∪ backtest = 1"}}
    Logger[["📝 Structured logger<br/>g05 §2 — backend/logs/app.log"]]
    Errors[["❗ Error envelope<br/>g05 §3 — {success, data} | {success, error}"]]
    JobReg[("In-memory<br/>refresh/screening<br/>job registry")]

    API --> Service
    Service --> Engine
    Service --> Crawl
    Service --> Repo
    Engine --> Repo
    Repo --> sqla --> sqlite

    Service -. acquire/release .-> JobLock
    s_refresh -. status .-> JobReg
    s_screening -. status .-> JobReg

    API -. wraps response .-> Errors
    Service -. logs .-> Logger
    Engine -. logs .-> Logger
    Crawl -. logs .-> Logger
```

## Engine interfaces (c01)

```mermaid
classDiagram
    class ScoringEngine {
        <<abstract>>
        +score(features) ScoringResult
    }
    class PriceEngine {
        <<abstract>>
        +predict(ticker, prices, features) PriceResult
    }
    class EntryPointEngine {
        +evaluate(input) EntryResult
    }

    class ScoringResult {
        +ai_score float
        +recommendation MUA|GIỮ|BÁN
        +confidence_raw float
        +reasons List~Reason~
    }
    class PriceResult {
        +target_price_3m float
        +target_date str
        +upside_pct float
    }
    class EntryResult {
        +signal EntrySignal
        +support_zone float
        +resistance_zone float
        +reason_code str
        +raw_indicators_used List
    }

    ScoringEngine <|-- ScoringBaseline
    ScoringEngine <|-- ScoringXGBoost
    PriceEngine <|-- PriceBaseline
    PriceEngine <|-- PriceLSTM

    ScoringBaseline ..> ScoringResult
    ScoringXGBoost ..> ScoringResult
    PriceBaseline ..> PriceResult
    PriceLSTM ..> PriceResult
    EntryPointEngine ..> EntryResult
```

## Notes

- Layer rule cứng: **API → Service → Repository**. Không skip — tránh logic kinh doanh leak vào router hoặc SQL leak vào service.
- **Engines** là module pluggable: MVP dùng `*_baseline.py`, target swap sang `*_xgboost.py` / `*_lstm.py` mà KHÔNG đổi UI/API contract (xem [c01 §2](../tad/c01-engines.md)).
- **EntryPointEngine** không abstract — logic deterministic theo SRS-03 priority order (xem [c03](../tad/c03-entry-engine.md)).
- **JobLock** + **In-memory job registry** giữ trạng thái refresh/screening đang chạy. Restart backend = mất status (acceptable cho MVP, không persist vào table).
