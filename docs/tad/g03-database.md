---
id: g03
title: Database Schema — 16 Tables (SQLite, migration-ready)
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§8)
---

# g03 — Database Schema (16 Tables)

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> [v1.1 MUST-FIX 4] Sửa từ 15 → 16 tables. Thêm backtest_results + share_links.

---

## Table 1: stocks
```sql
CREATE TABLE stocks (
    ticker TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    exchange TEXT NOT NULL,
    sector TEXT,
    status TEXT DEFAULT 'ACTIVE',
    newly_listed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_stocks_status ON stocks(status);
```

## Table 2: stock_prices
```sql
CREATE TABLE stock_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL REFERENCES stocks(ticker),
    date DATE NOT NULL,
    open REAL, high REAL, low REAL, close REAL,
    volume INTEGER,
    ceiling REAL, floor REAL, reference REAL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_prices_ticker_date ON stock_prices(ticker, date);
CREATE INDEX idx_prices_date ON stock_prices(date);
```

## Table 3: financial_reports
```sql
CREATE TABLE financial_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL REFERENCES stocks(ticker),
    period TEXT NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL,
    revenue REAL, net_income REAL, total_assets REAL,
    total_equity REAL, total_debt REAL,
    current_assets REAL, current_liabilities REAL,
    inventory REAL, cogs REAL,
    operating_cash_flow REAL, eps REAL, bvps REAL,
    advances REAL,
    shares_outstanding INTEGER,
    audit_opinion TEXT,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_fin_ticker_period ON financial_reports(ticker, period);
```

## Table 4: macro_data
```sql
CREATE TABLE macro_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    indicator TEXT NOT NULL,
    period TEXT NOT NULL,
    value REAL NOT NULL,
    source TEXT,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_macro_indicator_period ON macro_data(indicator, period);
```

## Table 5: screening_runs
```sql
CREATE TABLE screening_runs (
    run_id TEXT PRIMARY KEY,
    run_at TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    model_version TEXT NOT NULL,
    settings_version INTEGER NOT NULL,
    total_capital REAL DEFAULT 0,
    thresholds_json TEXT,
    data_from_cache BOOLEAN DEFAULT FALSE,
    total_input INTEGER,
    after_round_1 INTEGER, after_round_2 INTEGER,
    after_round_3 INTEGER, after_round_4 INTEGER,
    scored_count INTEGER,
    buy_count INTEGER, hold_count INTEGER, sell_count INTEGER,
    warnings_json TEXT,
    telegram_sent BOOLEAN DEFAULT FALSE,
    telegram_error TEXT,
    run_error TEXT,                     -- Error message when status=FAILED, NULL otherwise
    duration_seconds REAL,
    current_step TEXT,
    progress_percent INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_runs_run_at ON screening_runs(run_at DESC);
```

## Table 6: screening_results
```sql
CREATE TABLE screening_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES screening_runs(run_id),
    ticker TEXT NOT NULL REFERENCES stocks(ticker),
    ai_score REAL, recommendation TEXT,
    confidence_raw REAL, confidence_penalty INTEGER, confidence REAL,
    target_price_3m REAL, current_price REAL, upside_pct REAL,
    entry_signal TEXT, entry_reason_code TEXT,
    support_zone REAL, resistance_zone REAL,
    stop_loss_price REAL,
    allocation_amount REAL, allocation_weight REAL,
    warning_badges_json TEXT,
    reasons_json TEXT,
    feature_values_json TEXT,
    feature_availability INTEGER,
    radar_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_results_run_ticker ON screening_results(run_id, ticker);
CREATE INDEX idx_results_run ON screening_results(run_id);
```

## Table 7: excluded_stocks
```sql
CREATE TABLE excluded_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES screening_runs(run_id),
    ticker TEXT NOT NULL,
    excluded_round INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reason_code TEXT NOT NULL
);
CREATE INDEX idx_excluded_run ON excluded_stocks(run_id);
```

## Table 8: news_articles
```sql
CREATE TABLE news_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    published_at TIMESTAMP,
    content_snippet TEXT,
    related_tickers_json TEXT,
    sentiment_label TEXT,
    sentiment_score REAL,
    sentiment_reason TEXT,
    crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_source ON news_articles(source);
```

## Table 9: user_profile
```sql
CREATE TABLE user_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT, email TEXT,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Table 10: portfolio
```sql
CREATE TABLE portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL REFERENCES stocks(ticker),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    buy_price REAL NOT NULL CHECK(buy_price > 0),
    buy_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_portfolio_ticker ON portfolio(ticker);
```

## Table 11: transactions (Post-MVP, schema reserved)
```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL, action TEXT NOT NULL,
    quantity INTEGER NOT NULL, price REAL NOT NULL,
    date DATE NOT NULL, based_on_run_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Table 12: settings
```sql
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    buy_threshold INTEGER DEFAULT 75,
    hold_min_threshold INTEGER DEFAULT 45,
    default_capital REAL DEFAULT 0,
    source_cafef BOOLEAN DEFAULT TRUE,
    source_vnexpress BOOLEAN DEFAULT TRUE,
    source_vietstock BOOLEAN DEFAULT TRUE,
    source_batdongsan BOOLEAN DEFAULT TRUE,
    source_thanhnien BOOLEAN DEFAULT TRUE,
    telegram_enabled BOOLEAN DEFAULT FALSE,
    telegram_chat_id TEXT DEFAULT '',
    telegram_token TEXT DEFAULT '',
    telegram_top_n INTEGER DEFAULT 3,
    theme TEXT DEFAULT 'CLASSIC',
    classic_mode TEXT DEFAULT 'DARK',
    language TEXT DEFAULT 'VIE',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Table 13: backtest_runs
```sql
CREATE TABLE backtest_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TIMESTAMP, completed_at TIMESTAMP,
    status TEXT DEFAULT 'RUNNING',
    period_from DATE, period_to DATE,
    recommendation_accuracy REAL,
    price_error_mean REAL,
    portfolio_roi REAL,
    vnindex_roi REAL,
    alpha REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Table 14: backtest_results [v1.1 NEW]
```sql
CREATE TABLE backtest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backtest_id INTEGER NOT NULL REFERENCES backtest_runs(id),
    ticker TEXT NOT NULL,
    predicted_recommendation TEXT,
    actual_return_3m REAL,
    predicted_price REAL,
    actual_price REAL,
    price_error_pct REAL,
    recommendation_correct BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_bt_results_backtest ON backtest_results(backtest_id);
```

## Table 15: share_links [v1.1 NEW]
```sql
CREATE TABLE share_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    run_id TEXT NOT NULL REFERENCES screening_runs(run_id),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_share_token ON share_links(token);
```

## Table 16: cache_metadata
```sql
CREATE TABLE cache_metadata (
    source TEXT PRIMARY KEY,
    last_refreshed_at TIMESTAMP,
    ttl_hours INTEGER NOT NULL,
    status TEXT DEFAULT 'FRESH'
);
```

**Total: 16 tables.**
