# Phase 3 — Refresh Layer

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 1.5d / ~2h
**Spec ref:** [PLAN.md §3 row 3](../../PLAN.md), [TAD g01](../../../docs/tad/g01-runtime.md), [TAD g04](../../../docs/tad/g04-cache.md), [TAD g05](../../../docs/tad/g05-cross-cutting.md), [SRS f01](../../../docs/srs/f01-core-screening-pipeline.md)

> Cập nhật 2026-05-19: ghi chú `fetch_financials()` là stub chỉ đúng tại thời điểm Phase 3. Phase 15 đã thay bằng ingestion BCTC thật qua `vnstock.api.financial.Finance` và upsert `financial_reports`.

## 1. Scope

- **Job lock singleton** (TAD g05 §1) — single heavy job rule, in-memory registry
- **vnstock client wrapper** (TAD g04 §3) — rate limit 0.5s, lazy import, raise `VnstockUnavailable`
- **Cache freshness gate** (TAD g04 §2) — `is_stale(db, source) → bool` + `mark_refreshed()`
- **3 endpoints:** POST /api/refresh/all (202), POST /api/refresh/prices (202), GET /api/refresh/{id}/status
- **Background driver** — refresh_service.run_refresh_prices/all chạy trên FastAPI BackgroundTasks (threadpool); update progress mỗi 5 ticker; tự release lock cuối job
- **Repositories:** `cache_repo` (upsert), `price_repo` (bulk_upsert ON CONFLICT), `stock_repo` (list_active)
- **Schemas:** RefreshAcceptedResponse, RefreshStatusResponse

## 2. Pre-code spec audit (drift report)

3 drift phát hiện trong audit, fix ngay trong Phase 3:

| # | Drift | File trước | Resolution |
|---|---|---|---|
| 1 | **RunStatus enum sai values trong Phase 1**: tôi viết `{PENDING, RUNNING, PROCESSING, COMPLETED, FAILED, PARTIAL, CANCELLED}` nhưng TAD g01 §2.1 canonical là `{PENDING, CHECKING_DATA, SCREENING, SCORING, COMPLETED, COMPLETED_WITH_WARNINGS, FAILED}` | `app/constants/enums.py` | ❌ REMOVE 4 enum values cũ; ✅ REPLACE bằng 7 canonical states. Thêm `RUN_TERMINAL_STATES` frozenset + `RefreshStatus` enum riêng (4 trạng thái cho refresh). Cột `screening_runs.status` là String → fix non-breaking. |
| 2 | **Cache TTL Phase 1 đoán sai**: financials 72h, macro 24/168h, news 2h. TAD g04 §1: financials 720h (30d), macro 720h, news 6h | `app/constants/sources.py` | Sync TTL hours về spec; `seed_cache_metadata` upgrade thành **upsert** (idempotent: insert missing + sync ttl_hours từ config). Cache rows count 5 → 9 (thêm vnstock_price + vnstock_financial + macro_sbv + macro_gso). |
| 3 | **Job lock library**: tôi định dùng `asyncio.Lock`. TAD g05 §1 chỉ định `threading.Lock` | `app/job_lock.py` | Code theo TAD — `threading.Lock` match FastAPI BackgroundTasks chạy sync trên threadpool |

Test Phase 1 `test_seed.py` cập nhật assertion `cache_metadata == 9` (thay 5).

## 3. Deliverables

Tất cả path relative tới `mvp/code/`.

### Mới tạo
| Path | Nội dung |
|---|---|
| `app/job_lock.py` | `class JobLock` thread-safe singleton — `try_acquire()`, `release()`, `update()`, `get()`, `reset()`. In-memory registry {job_id: snapshot dict}. `active_job` + `active_type` properties |
| `app/crawlers/__init__.py` | Package marker |
| `app/crawlers/vnstock_client.py` | `VnstockClient.fetch_prices()` (lazy import vnstock + module-level `_RateGate` thread-safe 0.5s) + `fetch_financials()` (stub Phase 4+); `VnstockUnavailable` exception |
| `app/crawlers/cache_manager.py` | `is_stale()` đọc cache_metadata + compute timedelta vs `ttl_hours`; `mark_refreshed()` upsert; SQLite naive→aware UTC promotion |
| `app/repositories/cache_repo.py` | `get(db, source)` + `upsert_refresh(db, source, refreshed_at, status)` |
| `app/repositories/price_repo.py` | `bulk_upsert(db, rows)` SQLite ON CONFLICT (ticker, date) UPDATE — chỉ insert valid rows |
| `app/repositories/stock_repo.py` | `list_active_tickers(db)` + `list_all_stocks(db)` |
| `app/schemas/refresh.py` | `RefreshAcceptedResponse`, `RefreshStatusResponse` (extra="forbid") |
| `app/services/refresh_service.py` | `run_refresh_prices(job_id)` + `run_refresh_all(job_id)` background driver; progress update mỗi 5 ticker; mark COMPLETED/FAILED + cache_manager.mark_refreshed; **`_client_factory` test hook** cho monkeypatch |
| `app/api/refresh.py` | 3 endpoints + `_new_refresh_id()` UUID12 + 409 conflict path |

### Sửa
| Path | Thay đổi |
|---|---|
| `app/constants/enums.py` | RunStatus 7 canonical states + RUN_TERMINAL_STATES + thêm `RefreshStatus` 4-state + REFRESH_TERMINAL_STATES |
| `app/constants/sources.py` | TTL hours đúng TAD g04: financials 720h, macro 720h, news 6h |
| `app/db/seed.py` | `seed_cache_metadata` upsert pattern; `build_cache_seeds` dùng `ALL_SOURCES` từ config (9 sources) thay 5 hardcoded news |
| `app/api/__init__.py` | Register refresh router |
| `tests/integration/test_seed.py` | Assert cache_metadata count = 9 (thay 5) |

### Tests mới (3 file, +20 cases)
| Path | Cases |
|---|---|
| `tests/unit/test_job_lock.py` | 8 cases: acquire idle/held, release with status/error, update progress, get unknown→None, registry preserved sau release, reset clears all |
| `tests/unit/test_cache_manager.py` | 6 cases: stale missing/no-last-refreshed, fresh within ttl, stale after ttl, fresh at explicit now, mark_refreshed updates row |
| `tests/integration/test_refresh.py` | 8 cases: 401 no auth (POST × 2 + GET status), 202 returns refresh_id (POST prices + all), GET status returns terminal sau bg, 404 unknown, **409 when locked** (manual acquire screening), GET status 401 |

## 4. Exit criteria — all PASS

- `uv run pytest` → **52/52 pass** (Phase 0-2: 30, Phase 3 mới: 22 = 8 job_lock + 6 cache_manager + 8 refresh)
- `uv run ruff check app tests` → All checks passed
- Smoke với curl thực:
  - POST /api/refresh/prices không Bearer → 401
  - POST /api/refresh/prices + Bearer → 202 `{refresh_id, status:"PENDING"}`
  - GET /api/refresh/{id}/status → envelope với type=refresh, status real-time, progress, message tiếng Việt, started_at ISO
  - GET unknown id → 404 `ERR-NOT-FOUND`
- Job lock 409 verified qua test (manual acquire screening + POST refresh → 409 + message "Đang có tác vụ chạy: screening")

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Lock primitive | `threading.Lock` | TAD g05 spec; FastAPI BackgroundTasks chạy sync function trên threadpool, không qua asyncio loop |
| Job ID format | `refresh_{uuid4_hex[:12]}` | Match prototype FE `MOCK_JWT_PREFIX + Date.now()` style; 12 char đủ unique cho single-instance |
| 5 ticker batch progress | `if (i+1) % 5 == 0` update | Tránh contention quá nhiều trên `threading.Lock`; 5 đủ smooth UI |
| Rate limit gate | Module-level `_RateGate` singleton | Mọi `VnstockClient` instance share gate → tổng calls/giây respect 0.5s rate limit |
| Vnstock import | Lazy (inside method body) | Test monkeypatch dễ; import vnstock heavy nhưng chỉ load khi thực sự refresh |
| Cache row init | `last_refreshed_at=NULL`, `status="STALE"` | Refresh service detect "chưa refresh lần nào" → fetch lần đầu thay vì giả định FRESH |
| Cache TTL source-of-truth | `app/constants/sources.py` `ALL_SOURCES` | Seed + cache_manager đều đọc cùng config → drift impossible |
| Refresh financials/news/macro | Stub trong MVP — fetch_financials() return [], news/macro skip | Phase 1 đã skip news RSS theo user choice; financials thật wire ở Phase 4-5 khi engines cần data |

## 6. Issues / drift

- **BackgroundTasks completion semantics trong TestClient**: TestClient await BG task TRƯỚC khi return response. Nghĩa là sau `client.post('/api/refresh/prices')`, BG task đã chạy xong → status đã terminal. Test `test_get_refresh_status_returns_terminal_after_bg_task` check `status in {COMPLETED, FAILED}` (không assert trung gian). Production behavior khác — BG chạy thực sự background, FE poll status nhiều lần.
- **Smoke test status="RUNNING" với progress=0**: real uvicorn (`uv run uvicorn`) gọi vnstock thật → BG task đang trong vòng đầu (0.5s rate limit + API latency). Verified qua snapshot status. Không phải bug.
- **Financials stub**: `fetch_financials()` log warning + return []. Phase 4 (engines) sẽ wire real implementation theo vnstock API. Refresh status vẫn COMPLETED vì stub không raise.
- **Naive datetime trong SQLite**: `cache_metadata.last_refreshed_at` lưu naive (SQLite default). `cache_manager._aware()` promote về UTC khi compute timedelta. Inconsistency trade-off chấp nhận cho SQLite.
- **JobLock.reset() là test-only**: production KHÔNG gọi reset; chỉ tests. Khai báo rõ docstring.

## 7. Test commands (reproducible)

```bash
cd mvp/code

uv run pytest                    # 52 pass
uv run ruff check app tests      # clean

# Smoke
uv run uvicorn app.main:app --port 8000   # terminal 1
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl -sS -X POST http://127.0.0.1:8000/api/refresh/prices -H "Authorization: Bearer $TOKEN"
# → 202 {"refresh_id":"refresh_xxx", "status":"PENDING"}

curl -sS http://127.0.0.1:8000/api/refresh/refresh_xxx/status -H "Authorization: Bearer $TOKEN"
# → status real-time

curl -sS http://127.0.0.1:8000/api/refresh/unknown_id/status -H "Authorization: Bearer $TOKEN"
# → 404 ERR-NOT-FOUND
```

## 8. Hand-off cho Phase 4

Phase 4 (Engines + Features + Risk) sẽ thêm:
- `app/engines/base.py` — ABC interfaces (ScoringEngine, PriceEngine, EntryEngine)
- `app/engines/scoring_baseline.py` — weighted normalize sum của 38 features (TAD c02 §2)
- `app/engines/price_baseline.py` + `entry_engine.py`
- `app/engines/scoring_xgboost.py` + `price_lstm.py` — STUB raise NotImplementedError
- `app/services/feature_service.py` — 38 feature calc + normalization
- `app/services/filter_service.py` — 4 round filter (SRS f01 step 3-6)
- `app/services/risk_service.py`
- Repositories: `financial_repo.py` (already created skeleton), `macro_repo.py`
- Tests fixture: 5 anchor tickers (VHM, KDH, NLG, DXG, PDR) golden outputs

Đã sẵn sàng:
- 81 stocks seeded (Phase 1)
- Cache infrastructure (Phase 3)
- 38 feature spec với normalization (Phase 1 constants/features.py)
- vnstock wrapper (Phase 3) — sẽ là 1 nguồn data cho refresh + screening đọc cache

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 3 sau khi phase đã đóng)*

### 2026-05-16 — Cache STUB usability gate (reviewer round 2)

**Bug:** `cache_manager.is_stale()` chỉ check `last_refreshed_at + ttl_hours`, bỏ qua
`meta.status`. `refresh_service` mark financial cache `status="STUB"` (crawler chưa
thật), nhưng TTL vẫn hợp lệ nên downstream `_data_from_cache()` ở screening trả
False → FE không bật badge DATA_FROM_CACHE → user "bị lừa fresh".

**Fix ([cache_manager.py](../../code/app/crawlers/cache_manager.py)):** Thêm `is_usable(db, source_key, *, now=None)` riêng — trả
True iff (meta exists) AND (last_refreshed_at exists) AND (status == "FRESH") AND
(TTL còn hợp lệ). Giữ nguyên `is_stale()` TTL-only để refresh job KHÔNG tự re-trigger
vô tận sau khi mark STUB (just-STUB → not FRESH → "stale" → fetch lại = infinite
loop). Downstream gate (screening, UI badges) → `is_usable()`. Refresh gate →
`is_stale()`.

**Tests:** [test_cache_manager.py](../../code/tests/unit/test_cache_manager.py) +7 cases cho `is_usable()`:
missing meta, no refreshed_at, fresh within TTL, expired TTL, STUB-within-TTL (key
regression), arbitrary non-FRESH status, explicit `now`.

**Files:** [cache_manager.py](../../code/app/crawlers/cache_manager.py) +14 LOC; [test_cache_manager.py](../../code/tests/unit/test_cache_manager.py) +60 LOC.
