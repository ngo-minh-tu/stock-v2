---
title: 06 — Feature Pipeline & Engines
source: TAD c01 (engines), c02 (features), c03 (entry), c04 (sentiment), c05 (dashboard)
---

# 06 — Feature Pipeline & Engines

Pipeline screening: cache → 4 vòng lọc → feature eng → 4 engines (Score/Price/Entry/Risk) → save. Chi tiết SRS: [f01-core-screening-pipeline](../srs/), [f02-feature-engineering](../srs/), [f03-entry-point-logic](../srs/).

## End-to-end pipeline

```mermaid
flowchart LR
    Start(["POST /api/run<br/>202 PENDING"]) --> Cache{"cache fresh?<br/>g04"}
    Cache -- stale --> Warn1[set<br/>data_from_cache=true<br/>→ COMPLETED_WITH_WARNINGS]
    Cache -- fresh --> R1
    Warn1 --> R1

    subgraph Filters["4 vòng lọc — filter_service"]
        direction LR
        R1[Round 1<br/>Whitelist ~81 mã<br/>BĐS sector] --> R2[Round 2<br/>Fundamentals<br/>P/E, D/E, OCF, etc.]
        R2 --> R3[Round 3<br/>Technical<br/>volume, returns]
        R3 --> R4[Round 4<br/>Data quality<br/>missing → INSUFFICIENT_DATA]
    end

    R4 -- excluded --> ExcDB[("excluded_stocks<br/>per round")]
    R4 -- passed --> Feat

    subgraph FeatEng["Feature engineering — c02"]
        direction TB
        Feat[feature_service<br/>compute 38 features × N tickers]
        Feat --> Norm["Normalization Spec<br/>F01-F16 fundamentals<br/>T01-T09 technical<br/>M01-M05 macro<br/>R01-R05 real estate<br/>S01-S03 sentiment"]
    end

    Norm --> Engines

    subgraph Engines["Engines — c01"]
        direction TB
        Score["Scoring<br/>baseline weighted normalize<br/>→ ai_score 0-100<br/>→ MUA/GIỮ/BÁN<br/>→ confidence_raw"]
        Price["Price<br/>baseline → target_3m<br/>→ upside_pct"]
        Entry["EntryPoint<br/>deterministic<br/>SRS-03 priority order<br/>→ signal + S/R"]
        Risk["Risk<br/>stop_loss<br/>+ allocation<br/>+ warning_badges<br/>+ confidence_penalty"]
    end

    Score --> Aggregate
    Price --> Aggregate
    Entry --> Aggregate
    Risk --> Aggregate

    Aggregate["Aggregate per ticker<br/>+ reasons (≤5, GUARD-02)<br/>+ radar 5 dims"] --> SaveDB[("screening_results")]

    SaveDB --> CheckWarn{any warnings?}
    CheckWarn -- yes --> CW[COMPLETED_WITH_WARNINGS]
    CheckWarn -- no --> C[COMPLETED]

    CW --> TG{telegram_enabled?}
    C --> TG
    TG -- yes --> TGSend[Telegram send<br/>non-blocking<br/>c07]
    TG -- no --> Done
    TGSend --> Done(["Terminal — broadcast<br/>lastCompletedRunId"])
```

## 38 features — normalization (c02 §2)

```mermaid
flowchart LR
    subgraph Fund["Fundamental — F01-F16"]
        F1["F01 P/E (lower)"]
        F2["F02 P/B (lower)"]
        F3["F03 ROE (higher)"]
        F4["F04 ROA (higher)"]
        F5["F05 EPS (higher)"]
        F6["F06 D/E (lower)"]
        F7["F07 Net Margin"]
        F8["F08 Rev Growth"]
        F9["F09 Profit Growth"]
        F10["F10 OCF (higher)"]
        F11["F11 Current Ratio"]
        F12["F12 Advances YoY"]
        F13["F13 OCF/NI"]
        F14["F14 Inv/TA (lower)"]
        F15["F15 Inv Turnover"]
        F16["F16 Inv vs Rev growth"]
    end

    subgraph Tech["Technical — T01-T09"]
        T1["T01 MA Trend Score"]
        T2["T02 EMA Momentum"]
        T3["T03 RSI (neutral 50)"]
        T4["T04 MACD Hist"]
        T5["T05 Bollinger Pos (neutral)"]
        T6["T06 Avg Vol 20D"]
        T7["T07 Return 1M"]
        T8["T08 Return 3M"]
        T9["T09 Return 6M"]
    end

    subgraph Macro["Macro — M01-M05"]
        M1["M01 Interest Rate (lower)"]
        M2["M02 Credit Growth"]
        M3["M03 CPI (lower)"]
        M4["M04 FDI"]
        M5["M05 VN-Index"]
    end

    subgraph RE["Real Estate — R01-R05"]
        R1["R01 Land Bank"]
        R2["R02 Projects"]
        R3["R03 NAV"]
        R4["R04 NAV Discount"]
        R5["R05 Legal Risk (lower)"]
    end

    subgraph Sent["Sentiment — S01-S03"]
        S1["S01 Sentiment score"]
        S2["S02 News count"]
        S3["S03 Insider Net"]
    end

    Norm["clamp((value - bad)/(good - bad)*100, 0, 100)<br/>+ 'lower_better' inversion"] --> ScoreOut[ai_score 0-100<br/>weighted by group]
    Fund --> Norm
    Tech --> Norm
    Macro --> Norm
    RE --> Norm
    Sent --> Norm
```

## Entry signal priority (c03)

```mermaid
flowchart TB
    Input(["EntryInput:<br/>ticker, score, recommendation,<br/>badges, prices, raw_indicators"]) --> Step1

    Step1{"1️⃣ feature_availability &lt; 30?"} -- yes --> Insuf[INSUFFICIENT_DATA]
    Step1 -- no --> Step2

    Step2{"2️⃣ recommendation ≠ MUA?"} -- yes --> NoEntry[NO_ENTRY]
    Step2 -- no --> Step3

    Step3{"3️⃣ ai_score ≥ 90 + confluence?"} -- yes --> BS[BUY_STRONG]
    Step3 -- no --> Step4

    Step4{"4️⃣ ai_score ≥ 75 + breakout signals?"} -- yes --> BN[BUY_NOW]
    Step4 -- no --> Step5

    Step5{"5️⃣ near resistance?"} -- yes --> WB[WAIT_FOR_BREAKOUT]
    Step5 -- no --> Step6

    Step6{"6️⃣ above support, momentum lull?"} -- yes --> WP[WAIT_FOR_PULLBACK]
    Step6 -- no --> Step7

    Step7{"7️⃣ momentum forming, no breakout?"} -- yes --> WC[WAIT_FOR_CONFIRMATION]
    Step7 -- no --> NoEntry2[NO_ENTRY fallback]

    style Step2 fill:#fee2e2
```

> **Step 2 critical** ([c03 §2](../tad/c03-entry-engine.md)): `rec ≠ MUA → NO_ENTRY` MUST enforce trước Step 3+. Cluster 2 prototype trả `WAIT_FOR_*` cho cả mã GIỮ/BÁN — vi phạm AC-03-02. Fix qua `decideEntrySignal` cluster 3.

## News & sentiment pipeline (c04)

```mermaid
flowchart LR
    subgraph Sources["5 RSS sources"]
        Cafef
        VnExpress
        Vietstock
        Batdongsan
        ThanhNien
    end

    Sources --> Crawl["news_crawler<br/>RSS first → HTML fallback<br/>skip if blocked"]
    Crawl --> Parse["Parse:<br/>title · url · source<br/>published_at · snippet<br/>related_tickers"]
    Parse --> Classify["Sentiment classifier<br/>MVP: keyword wordlist VN<br/>Phase 2: PhoBERT fine-tune"]
    Classify --> Label["POSITIVE / NEUTRAL / NEGATIVE<br/>score -1..+1"]
    Label --> Save[(news_articles)]

    Save --> APIList["GET /api/news<br/>+ source_errors envelope<br/>(200 OK + array, NOT 503)"]
    Save --> APISent["GET /api/news/sentiment/{ticker}?days=30<br/>GUARD-08: count=0 → NEUTRAL/0.0"]

    APIList --> NewsList["NewsList<br/>accumulator + IntersectionObserver<br/>+ de-dup by article_id<br/>+ resetKey hash"]
    APISent --> Widget["SentimentSummaryWidget<br/>CSS conic-gradient doughnut<br/>(NOT Recharts pie)"]
```

## Risk + reasons (c01, c05)

```mermaid
flowchart LR
    Score["ai_score<br/>+ recommendation"] --> Risk

    subgraph Risk["risk_service"]
        StopLoss["stop_loss_price<br/>= support_zone × 0.96"]
        Alloc["allocation_amount<br/>+ allocation_weight<br/>(fund of total_capital)"]
        Badges["warning_badges<br/>HIGH_LEVERAGE, HIGH_INVENTORY,<br/>NEGATIVE_OCF, OCF_NI_LOW,<br/>RECENT_AUDIT, ..."]
        Penalty["confidence_penalty<br/>= n_badges × 5pp"]
    end

    Risk --> Reasons["reasons (≤5)<br/>GUARD-02 enforce<br/>each → feature_id whitelist<br/>F0X|T0X|M0X|R0X|S0X"]

    Reasons --> Radar["radar 5 dims:<br/>fundamental · technical<br/>macro · realestate · sentiment<br/>(Stock Detail dual-series<br/>vs industry avg)"]

    Radar --> Save[("screening_results.<br/>radar_json + warning_badges_json<br/>+ reasons_json")]
```

## Notes

- **GUARD-02** (xem [SRS f06 Explainability](../srs/)): mỗi reason phải map đến **≥1 scoring feature hoặc risk flag** cụ thể. KHÔNG LLM-generate tự do. Cluster 2 enforce qua [`REASON_TEMPLATES`](../tad/g06-testing.md) (13 templates kèm `feature_id`).
- **GUARD-08** (xem [c04 §1.3](../tad/c04-news-sentiment.md)): `count=0 trong 30 ngày → NEUTRAL/0.0/empty breakdown`. Frontend render italic note thay vì error.
- **Anchor pattern (mock)**: VHM/KDH/NLG/DXG/PDR + 5 MOCK_* tickers cover 7-enum coverage entry signal trong UI demo (xem [c03 §2](../tad/c03-entry-engine.md), [g06 §3](../tad/g06-testing.md)).
- **Engine swap**: scoring + price là `ABC` — MVP `*_baseline.py`, target `*_xgboost.py` / `*_lstm.py`. Entry KHÔNG abstract — logic deterministic theo SRS-03.
