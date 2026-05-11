# Phase 1 — DB + Constants + Seed

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 1d / ~1.5h
**Spec ref:** [PLAN.md §3 row 1](../../PLAN.md)

## 1. Scope

- 16-table SQLAlchemy ORM models (TAD g03) split thành 12 file theo entity
- Initial alembic migration `c2ca883fc104_initial_16_tables.py` autogenerate từ `Base.metadata`
- Constants module đầy đủ: 38 features (TAD c02), enums, thresholds, reason codes, error codes, sources
- DB infra: `app/db/session.py` (Base + engine + SessionLocal + get_db) + `pragmas.py` (WAL/foreign_keys/busy_timeout)
- Seed script idempotent: 81 stocks (26 real + 5 anchor + 50 fillers) + 1 settings + 1 user + 150 news (40/35/25 sentiment) + 5 cache_metadata
- Replace passlib → bcrypt direct (passlib 1.7 không tương thích bcrypt 4.x)
- 13 tests (5 unit + 8 integration) pass

## 2. Deliverables

Tất cả path relative tới `mvp/code/`.

### Constants (7 file)
| Path | Nội dung |
|---|---|
| `app/constants/__init__.py` | Package marker |
| `app/constants/enums.py` | 12 StrEnum: RunStatus 7, Recommendation, EntrySignal, NewsSource 5, SentimentLabel 3, Theme 3, ClassicMode, Language, Exchange, StockStatus, BacktestStatus, CacheStatus |
| `app/constants/features.py` | 38 `FeatureSpec` (F01-F16, T01-T09, M01-M05, R01-R05, S01-S03) — id/group/direction/good/bad. Asserts 38 unique. `FEATURE_BY_ID` + `features_in_group()` |
| `app/constants/thresholds.py` | DEFAULT_BUY_THRESHOLD=75, HOLD_MIN=45, BUY range 50-95, HOLD_MIN range 20-74, ALLOCATION_WEIGHT_MAX=0.30, etc. |
| `app/constants/reason_codes.py` | 13 entry reason codes + 10 warning badges + 7 filter exclusion codes (frozenset whitelist mỗi nhóm) |
| `app/constants/error_codes.py` | ERR-{module}-{code} convention; auth, portfolio, compare codes |
| `app/constants/sources.py` | 9 `SourceConfig` (vnstock_price/financial, macro_sbv/gso, news 5 sources) với ttl_hours |

### DB (4 file)
| Path | Nội dung |
|---|---|
| `app/db/__init__.py` | Package marker |
| `app/db/session.py` | `class Base(DeclarativeBase)`, engine với `connect_args={"check_same_thread": False}`, event listener wire pragmas mỗi connection mới, `SessionLocal` sessionmaker, `get_db()` generator dependency |
| `app/db/pragmas.py` | `apply_sqlite_pragmas()` — journal_mode=WAL, foreign_keys=ON, synchronous=NORMAL, busy_timeout từ env |
| `app/db/seed.py` | `run()` entry point; 5 idempotent seeders (stocks/settings/user/news/cache_metadata) chạy `python -m app.db.seed` |

### Models (13 file)
| Path | Tables | Notes |
|---|---|---|
| `app/models/__init__.py` | Re-export Base + 16 entities | Import order ensures metadata pickup |
| `app/models/stock.py` | Stock, StockPrice | FK ticker→stocks.ticker; unique idx (ticker, date) |
| `app/models/financial.py` | FinancialReport | unique idx (ticker, period) |
| `app/models/macro.py` | MacroData | unique idx (indicator, period) |
| `app/models/run.py` | ScreeningRun, ScreeningResult, ExcludedStock | All cluster-5 fields: model_version, settings_version, duration_seconds, run_error, current_step, progress_percent |
| `app/models/news.py` | NewsArticle | unique URL; indexes published_at + source |
| `app/models/user.py` | UserProfile | id=1 single row |
| `app/models/portfolio.py` | PortfolioHolding, Transaction | CheckConstraint qty/price > 0 |
| `app/models/settings.py` | Settings | Single row id=1; field `version` bump qua PUT |
| `app/models/backtest.py` | BacktestRun, BacktestResult | |
| `app/models/share.py` | ShareLink | unique token |
| `app/models/cache.py` | CacheMetadata | source PK |

### Core
| Path | Nội dung |
|---|---|
| `app/core/password.py` | `hash_password()` + `verify_password()` qua bcrypt direct (4.0+ API). Replace passlib stack |

### Migration
| Path | Nội dung |
|---|---|
| `alembic/env.py` | Wire `target_metadata = Base.metadata` từ `app.models` |
| `alembic/versions/c2ca883fc104_initial_16_tables.py` | Autogenerate 16 CREATE TABLE + 13 indexes |

### Tests (3 file mới)
| Path | Cases |
|---|---|
| `tests/unit/test_models.py` | `test_base_metadata_has_16_tables` (set equality), `test_features_count` (38 unique + group totals 16/9/5/5/3) |
| `tests/integration/test_seed.py` | 5 case: counts (81/1/1/150/5), anchor mocks present, sentiment 40/35/25 ±5%, settings defaults, user password verify_password OK |
| `tests/integration/test_pragmas.py` | 4 case: WAL, foreign_keys=1, busy_timeout≥1000, synchronous=NORMAL |

## 3. Exit criteria — all PASS

- `uv run alembic upgrade head` → migration applied
- 16 domain tables + alembic_version trong DB (`inspect(engine).get_table_names()` = 17)
- `uv run python -m app.db.seed` → log `seed counts: {'stocks': 81, 'settings': 1, 'user': 1, 'news': 150, 'cache_metadata': 5}`
- `uv run pytest` → **13/13 pass** (2 unit + 4 health + 4 pragmas + 5 seed — actually 2+2+4+5 = 13)
- `uv run ruff check app tests` → All checks passed
- Re-run seed idempotent: log skip messages, không tạo dup
- 5 anchor mocks (MOCK_BUY_STRONG, MOCK_BUY_WARN, MOCK_HOLD, MOCK_SELL, MOCK_INSUFFICIENT) tồn tại

## 4. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Hash library | `bcrypt>=4.0` direct | passlib 1.7.4 + bcrypt 4.x crash với "password cannot be longer than 72 bytes" trong wrap-bug detection. passlib chưa release fix từ 2020 |
| Migration filename | Hash-prefixed (`c2ca883fc104_*`) | Alembic default; không rename để tránh break revision lookup |
| News seed determinism | `random.Random(seed=42)` | Đơn giản hơn port mulberry32 từ TS; vẫn deterministic |
| Newly listed marker | `NEWLY_LISTED_INDEXES = {5,17,31,46,58,73}` | Match FE convention (TAD g02 §7.1); 6 mã |
| Stock fixture port | Hardcode 26 real tickers + 5 anchors + 50 MOCK01-50 inline | TS fixture là pure data; not value re-using TS runtime |
| Connection arg | `check_same_thread=False` | FastAPI worker threads share engine; per-request session vẫn isolated |
| Pragma wiring | Event listener `connect` per connection | Đảm bảo mọi connection mới (gồm test fixtures) đều set đúng |

## 5. Issues / drift

- **passlib drop**: TAD c08 §3 spec dùng `passlib[bcrypt]`. Drift này document trong [PLAN.md](../../PLAN.md) §0 để Phase 2 (Auth) build với `bcrypt` direct. Reconcile TAD c08 sau MVP.
- **Test isolation**: tests Phase 1 chạy trên dev DB `data/screener.db` (shared). Phase 4+ engines tests cần isolated in-memory engine — chưa setup conftest fixture cho điều này. TODO Phase 4.
- **Numeric vs Float**: dùng `Numeric` cho price/score columns (SQLite store as TEXT/REAL). TAD g03 SQL viết `REAL` nhưng autogenerate dùng `Numeric` → SQLite degrade về REAL. OK; precision matches.
- **`UPDATE` trên ORM `default=`**: settings + user dùng `default=1` cho id PK; bulk insert via mapping bypass default. Set explicit `id=1` khi `db.add()`.
- **Anchor news_articles count vs FE 150**: bằng. Tone distribution ratio bám 40/35/25 ± 5% tolerance test.

## 6. Test commands (reproducible)

```bash
cd mvp/code

# Fresh DB (only when schema changes)
rm -f data/screener.db

# Migrate
uv run alembic upgrade head

# Seed
uv run python -m app.db.seed

# All tests
uv run pytest
uv run ruff check app tests
```

## 7. Hand-off cho Phase 2

Phase 2 sẽ thêm:
- `app/core/jwt.py` — encode/decode (python-jose)
- `app/api/auth.py` — POST /auth/login + PUT /auth/password
- `app/api/settings.py` — GET/PUT /settings (validateSettingsPatch mirror SRS f15)
- `app/services/auth_service.py`, `app/services/settings_service.py`
- `app/repositories/user_repo.py`, `app/repositories/settings_repo.py`
- `app/dependencies.py` — `get_current_user()` dependency từ JWT bearer
- Pydantic schemas: `app/schemas/auth.py`, `app/schemas/settings.py`, `app/schemas/envelope.py`

Đã sẵn sàng:
- `app/core/password.py` — verify_password() dùng cho login
- `app/models.UserProfile` + `Settings` ORM
- `app.constants.error_codes` — ERR-AUTH-* + ERR-VALIDATION

## 8. Post-phase fixes

*(append entry mỗi khi user request fix Phase 1 sau khi phase đã đóng)*
