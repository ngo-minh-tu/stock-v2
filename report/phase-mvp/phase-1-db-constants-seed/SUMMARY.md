# Phase 1 — DB + Constants + Seed

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** dựng 16-table SQLAlchemy ORM (TAD g03), module `constants/` đầy đủ (38 features + enum + thresholds + reason codes), seed idempotent cho 81 stocks + 150 news + 5 macro cache.
**Trạng thái:** COMPLETED 2026-05-10

## 1. Việc đã làm

- Dựng `app/db/session.py` (Base + engine + SessionLocal + `get_db`) và `pragmas.py` (WAL, foreign_keys, busy_timeout, synchronous=NORMAL) qua event listener `connect`.
- Tạo 12 file model cho 16 bảng (Stock/StockPrice, FinancialReport, MacroData, ScreeningRun/Result/ExcludedStock, NewsArticle, UserProfile, PortfolioHolding/Transaction, Settings, BacktestRun/Result, ShareLink, CacheMetadata).
- Viết module `app/constants/` 7 file: enums (12 StrEnum), 38 `FeatureSpec` (F01-F16/T01-T09/M01-M05/R01-R05/S01-S03) với asserts unique + helpers, thresholds, reason_codes, error_codes, sources với `ttl_hours`.
- Sinh migration alembic ban đầu `c2ca883fc104_initial_16_tables.py` autogenerate từ `Base.metadata` (16 CREATE TABLE + 13 indexes).
- Viết seed script idempotent `app/db/seed.py` với 5 seeder con (stocks 81 = 26 real + 5 anchor + 50 MOCK01-50, settings, user, news 150 sentiment 40/35/25, cache_metadata).
- Thay passlib → bcrypt direct trong `app/core/password.py` (passlib 1.7.4 crash với bcrypt 4.x).
- Viết 13 tests: 2 unit (model count, feature count) + 4 health + 4 pragmas + 5 seed.

## 2. File đã thêm

- `mvp/code/app/db/session.py`, `app/db/pragmas.py`, `app/db/seed.py`
- `mvp/code/app/constants/__init__.py`, `enums.py`, `features.py`, `thresholds.py`, `reason_codes.py`, `error_codes.py`, `sources.py`
- `mvp/code/app/models/__init__.py` + 12 file model entity (stock/financial/macro/run/news/user/portfolio/settings/backtest/share/cache)
- `mvp/code/app/core/password.py`
- `mvp/code/alembic/versions/c2ca883fc104_initial_16_tables.py`
- `mvp/code/tests/unit/test_models.py`
- `mvp/code/tests/integration/test_seed.py`, `test_pragmas.py`

## 3. File đã sửa

- `mvp/code/alembic/env.py` — wire `target_metadata = Base.metadata`.

## 4. Lệnh đã chạy

```bash
cd mvp/code
rm -f data/screener.db
uv run alembic upgrade head
uv run python -m app.db.seed
uv run pytest
uv run ruff check app tests
```

## 5. Kết quả

- `inspect(engine).get_table_names()` = 17 (16 domain + alembic_version).
- Seed log: `seed counts: {stocks: 81, settings: 1, user: 1, news: 150, cache_metadata: 5}`.
- Re-run seed idempotent — skip messages, không dup.
- 5 anchor mocks tồn tại: `MOCK_BUY_STRONG`, `MOCK_BUY_WARN`, `MOCK_HOLD`, `MOCK_SELL`, `MOCK_INSUFFICIENT`.
- Pytest: PASS — 13/13.
- Ruff: PASS.

## 6. Tồn đọng

- **passlib drift:** TAD c08 §3 spec dùng `passlib[bcrypt]`; Phase 1 đã chuyển sang `bcrypt` direct. Phase 2 build auth dựa pattern mới; TAD c08 cần reconcile post-MVP.
- **Constants drift cần Phase 3-4 fix:** Phase 1 đoán sai 5+ enum/constants vì spec scattered (RunStatus 7 canonical, EntrySignal 7 canonical, Recommendation ASCII, WARNING_BADGES 4, ENTRY_REASON_CODES 15, FILTER_EXCLUSION_CODES 6, CONFIDENCE_PENALTY cap 20). Đã ghi vào REVIEW.md, fix dần qua Phase 3 + Phase 4.
- **Cache TTL drift:** Phase 1 đoán vnstock_price/financial = 24h; TAD g04 §1 chốt price=4h, financial=720h, macro=720h, news=6h. Phase 3 sửa.
- **Test isolation:** tests Phase 1 chạy trên dev DB `data/screener.db` shared. Engines tests (Phase 4+) cần isolated in-memory engine fixture.
- **`Transaction` table reserved** (model có, không endpoint dùng) — post-MVP.
- **Stocks whitelist 81 mã hardcode:** production cần CRUD endpoint nếu add mã mới.
