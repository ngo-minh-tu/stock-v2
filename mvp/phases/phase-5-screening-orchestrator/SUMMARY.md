# Phase 5 — Screening Orchestrator

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 1d / ~2.5h
**Spec ref:** [PLAN.md §3 row 5](../../PLAN.md), [SRS f01](../../../docs/srs/f01-core-screening-pipeline.md), [TAD g01 §2](../../../docs/tad/g01-runtime.md), [TAD g02 §1+§8.4](../../../docs/tad/g02-api.md), [Phase 4 hand-off](../phase-4-engines-features-risk/SUMMARY.md)

## 1. Scope

- **POST /api/run** (202) — Validate body → create `screening_runs` row PENDING → `job_lock.try_acquire(run_id, "screening")` 409 conflict → `BackgroundTasks.add_task(screening_service.run_screening)`.
- **GET /api/runs/{run_id}/status** — Real-time status từ DB (status, progress_percent, current_step, started_at, completed_at, duration_seconds live cho active runs, run_error). Frontend poll mỗi 2s.
- **GET /api/runs/{run_id}** — Full summary (4-round counts + scored/buy/hold/sell + warnings + duration).
- **GET /api/runs?limit&offset** — Paginated list dạng `RunSummary` cluster-5 expanded (12 fields gồm avg_score, warnings_count, model_version, duration_seconds, settings_version).
- **DELETE /api/runs/{run_id}** — 200+envelope, cascade xoá children (screening_results, excluded_stocks).
- **Background driver `screening_service.run_screening()`** — orchestrate filter → feature → score → price → entry → risk → bulk insert + atomic status updates (PENDING → CHECKING_DATA → SCREENING → SCORING → terminal).
- **Repositories:** `screening_repo` (create_run, update_status, update_counts, mark_completed, list_paginated, delete_run), `results_repo` (bulk_insert + list + delete cascade), `excluded_repo` (bulk_insert + delete cascade).
- **Schemas Pydantic v2:** RunRequest, RunAcceptedResponse, RunStatusResponse, RunSummary (12 fields), RunListResponse, RunFullSummary, RunDeletedResponse, ScreeningResultRow.
- **Macro seed (5 indicators)** — bù vào db/seed.py defaults M01-M05 cho 2026Q2 (interest 5%, credit 12%, CPI 3.5%, FDI 4B USD, VN-Index 1300).

## 2. Pre-code spec audit (drift report)

3 drift Phase 1-4 phát hiện trong audit, fix ngay trong Phase 5 (theo memory rule "every cluster phải sạch lần đầu"):

| # | Drift | File trước | Resolution |
|---|---|---|---|
| 1 | **macro_data table empty từ Phase 1**: Phase 4 `feature_service.compute(macro=...)` cần dict {M01..M05}. Caller production sẽ load qua `macro_repo.all_latest()`, nhưng Phase 1 không seed → engine đọc dict rỗng → M01-M05 features missing → INSUFFICIENT_DATA cho mọi mã | `app/db/seed.py` | ✅ THÊM `seed_macro()` + `MACRO_DEFAULTS` (5 indicators × 2026Q2) — idempotent (skip nếu existing). Wire vào `run()` runner. Test_seed.py assert `MacroData == 5`. Production sẽ refresh qua macro crawler post-MVP, MVP dùng hardcode. |
| 2 | **ERR-01-* error codes thiếu**: SRS f01 §Error States định nghĩa ERR-01-01 (vnstock + no cache → FAILED), ERR-01-02 (0 mã pass 4 rounds), ERR-01-03 (engine crash → fallback). Phase 1 error_codes.py không có | `app/constants/error_codes.py` | ✅ THÊM 3 constants: `ERR_SCREENING_NO_DATA`, `ERR_SCREENING_EMPTY_RESULTS`, `ERR_SCREENING_ENGINE_CRASH`. Phase 5 chưa raise (engines đã có baseline fallback từ Phase 4) — reserved cho Phase 6+ wire vnstock real. |
| 3 | **Decimal/float coercion bug trong feature_service**: SQLAlchemy Numeric column trả `Decimal`, nhưng `_safe_div(num, den)` Phase 4 không cast → `Decimal/Decimal = Decimal`. Khi pass Decimal vào `scoring_baseline._normalize` → `TypeError: unsupported operand type(s) for -: 'Decimal' and 'float'`. Phase 4 unit tests passed vì test fixtures dùng float trực tiếp; chỉ Phase 5 integration test (insert qua bulk_insert_mappings → SQLAlchemy materialize Decimal) trigger bug | `app/services/feature_service.py` | ✅ FIX `_safe_div` cast `float(num) / float(den)` + return None nếu den_f == 0. Side effect: tất cả 38 features đảm bảo float type. **Convention lock:** mọi Numeric column read trong feature pipeline phải float() ngay. |

**Doc-only drift (KHÔNG fix code, ghi nhận để tránh nhầm):**
- TAD g02 §8.6 (BacktestResultsResponse) còn ghi `'MUA' | 'GIỮ' | 'BÁN'` với diacritics. Phase 4 đã chốt ASCII keys (`MUA`/`GIU`/`BAN`) — code follow ASCII. Phase 8 (backtest) sẽ cần align với code; doc fix khi reconcile cluster 5+ tiếp theo.

## 3. Deliverables

Tất cả path relative tới `mvp/code/`.

### Mới tạo
| Path | Nội dung |
|---|---|
| `app/repositories/screening_repo.py` | `create_run`, `get`, `update_status`, `update_counts`, `mark_completed`, `list_paginated`, `delete_run`, `latest_n_run_ids` |
| `app/repositories/results_repo.py` | `bulk_insert` (mappings), `list_by_run`, `get_by_run_ticker`, `delete_by_run` |
| `app/repositories/excluded_repo.py` | `bulk_insert`, `list_by_run`, `delete_by_run` |
| `app/schemas/run.py` | RunRequest (extra=ignore — tolerant với prototype `outcome` field), RunAcceptedResponse, RunStatusResponse (extra=forbid), RunSummary cluster-5 12 fields, RunListResponse, RunFullSummary, RunDeletedResponse, ScreeningResultRow |
| `app/services/screening_service.py` | `run_screening(run_id, total_capital, skip_allocation)` background driver; helpers `_load_settings_thresholds`, `_data_from_cache`, `_update_progress`, `_build_filter_inputs`, `_score_one`, `_apply_allocation`, `_summarize_warnings`, `_final_status`. `MODEL_VERSION = "baseline_v2"` |
| `app/api/screening.py` | 5 endpoints: POST /run, GET /runs, GET /runs/{id}, GET /runs/{id}/status, DELETE /runs/{id}. `_new_run_id()` UUID12. `_conflict()` 409 helper |

### Sửa
| Path | Thay đổi |
|---|---|
| `app/db/seed.py` | + `MACRO_DEFAULTS` (5 indicators) + `seed_macro(db)` upsert + wire vào `run()`. Import `MacroData` |
| `app/constants/error_codes.py` | + ERR_SCREENING_NO_DATA / _EMPTY_RESULTS / _ENGINE_CRASH (SRS f01 §Error States) |
| `app/api/__init__.py` | Register `screening.router` |
| `app/services/feature_service.py` | `_safe_div` cast `float(num) / float(den)` (Decimal coercion fix) |

### Tests mới (1 integration file, +15 cases)
| Path | Cases |
|---|---|
| `tests/integration/test_run_lifecycle.py` | 15 cases: 4 auth (POST + GET status + GET runs + DELETE), `test_post_run_returns_202_run_id`, `test_run_lifecycle_completes_with_results` (AC-01-03 + AC-01-10 verify), `test_run_results_have_valid_recommendations` (AC-01-09), `test_allocation_only_for_buy_recommendations` (AC-09-04 + non-MUA = NULL), `test_skip_allocation_flag`, `test_concurrent_run_returns_409`, `test_get_run_status_404`, `test_get_run_summary_404`, `test_delete_run_404`, `test_get_runs_paginated_after_run`, `test_delete_run_cascade`. Synthetic-data fixture `screening_data` insert + cleanup financials/prices cho all 81 ACTIVE tickers |
| `tests/integration/test_seed.py` | + assert `MacroData count == 5` |

## 4. Exit criteria — all PASS

- `uv run pytest` → **133/133 pass** (Phase 0-4: 118, Phase 5 mới: 15)
- `uv run ruff check app tests` → All checks passed
- End-to-end POST /run trên 81 mã → COMPLETED in ~1.3s; `total_input == 81 == after_round_1 + excluded_round_1`; `buy + hold + sell == scored_count` (AC-01-10).
- Concurrent POST /run khi lock đang acquired → 409 ERR-JOB-CONFLICT.
- `sum(allocation_amount) == total_capital ±1đ` (AC-09-04). Non-MUA → allocation_amount NULL.
- `skip_allocation=True` → tất cả allocation_amount NULL kể cả MUA.
- DELETE /runs/{id} cascade → `screening_runs` + `screening_results` + `excluded_stocks` của run đó bị xoá; row khác không ảnh hưởng.
- `seed_macro` idempotent: re-run không tạo dup; M01-M05 đều có row cho 2026Q2.

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Status state machine | PENDING (5%) → CHECKING_DATA (5%) → SCREENING (15%) → SCORING (30-95%) → terminal (100%) | Khớp TAD g01 §2.1 7-state. Progress percent atomic-write cả DB row + job_lock registry → /status đọc DB là source of truth |
| Background runner | FastAPI `BackgroundTasks` + `SessionLocal()` mới mỗi phase | Khớp Phase 3 refresh pattern. Không pass HTTP request session vào BG thread |
| Lock semantics | `job_lock.try_acquire(run_id, "screening")` ngay trong API handler trước khi insert DB | Tránh race: 2 request song song có thể create_run → insert dup. Lock acquire ATOMIC quyết định ai vào sau |
| `MODEL_VERSION` | `"baseline_v2"` hardcode | TAD g02 §8.4 lock version literal. XGBoost wire post-MVP sẽ bump v3+ |
| Allocation invocation | TRƯỚC bulk_insert, TRÊN scored[] in-memory | Tránh 2 round-trip DB cho update allocation. Cluster-5 prototype dùng cùng pattern |
| Avg_score compute | Lazy, mỗi GET /runs query results_repo.list_by_run + mean | Nếu cache trong screening_runs.avg_score column thì sẽ phải migration; lazy compute đủ nhanh cho /runs limit ≤ 10 |
| `feature_availability` | Số features != None trong dict (≤ 38). Phase 5 không filter mã có availability < threshold (giữ tất cả survivors qua scoring) | Phase 6+ sẽ check threshold để tag warning_badges INSUFFICIENT_FEATURES. Phase 5 keep simple: scored = số mã survivors mà `_score_one` không return None |
| `data_from_cache` | TRUE nếu vnstock_price OR vnstock_financial cache đang STALE | SRS f01 AC-01-06: stale data → COMPLETED_WITH_WARNINGS, không FAILED |
| `nav_discount_pct` cho entry engine | `bundle.features["R04"] * 100` (decimal → percent) | EntryInput field expect percent (SRS f03 Step 4 "nav_discount_pct >= 20"). Phase 4 feature giữ decimal, conversion ở orchestrator |
| `technical_features_available` | Đếm 8 raw indicators (sma20/50/200, ema12/26, bb_upper/lower, macd_signal_line) | Khớp Phase 4 EntryInput.technical_features_required = 8 |
| Cascade DELETE | App-level (results_repo + excluded_repo + screening_repo theo thứ tự) thay vì DB CASCADE | Schema TAD g03 chưa wire ON DELETE CASCADE; app-level đủ cho MVP single-instance + atomic trong 1 transaction |
| Synthetic data trong test fixture | 4Q financials + 200 daily prices cho 81 mã (16K rows) | Tạo trong fixture setup, cleanup trong teardown. Production data flow: refresh_service Phase 3 fetch vnstock thực |
| RunRequest extra=ignore | FE prototype gửi `outcome` mock field | Tolerant với cluster 2 mock outcome toggle; backend ignore an toàn. Settings/Refresh schemas dùng extra=forbid stricter |

## 6. Issues / drift

- **TestClient await BG semantics**: Phase 3 đã ghi nhận. Sau `client.post('/api/run')`, BG task đã hoàn thành → status terminal. Test check terminal state trực tiếp, KHÔNG retry polling. Production behavior khác — `uv run uvicorn` chạy BG thật, FE poll nhiều lần.
- **Macro values stub**: M01-M05 hardcode 2026Q2. Production sẽ refresh qua SBV/GSO crawler post-MVP. Hiện tại mọi run dùng cùng 5 macro values → group score `macro` constant qua các runs. Acceptable cho MVP.
- **Model version literal**: `MODEL_VERSION = "baseline_v2"` hardcode. Khi swap engine sau Phase 4 (XGBoost), cần bump string + có thể migration cho cũ runs giữ literal. Phase 8+ revisit.
- **Avg_score compute trong GET /runs**: query results_repo.list_by_run cho mỗi run trong page → N+1 query potential. Limit ≤ 10 nên nhỏ; Phase 6+ optimize bằng aggregate query nếu cần.
- **Concurrent screen + refresh tương tác**: Phase 3 refresh + Phase 5 screening cùng dùng `job_lock` (single slot). User chạy refresh trước, screening 409. SRS f01 không define UX cho lock conflict — frontend cluster 2 hiển thị toast tiếng Việt "Đang có tác vụ chạy: refresh".
- **Sector medians chưa wire**: `FeatureService(sector_medians={})` empty dict. Phase 6+ aggregate sector medians từ `scored[]` cuối Phase 5 SCORING để feed lại next run; hoặc hardcode bảng sector → Phase 4 đã có defaults trong `feature_service.compute` (R01=1000, R02=4, R03=25K).
- **`_score_one` skip mã thiếu prices/financials**: Filter Round 4 đã catch nhưng nếu race (Phase 5 load data cũ + concurrent refresh wipe), defensive None return tránh crash. Test không cover edge case này.
- **`screening_runs.run_at` lưu naive datetime trong SQLite**: Phase 3 đã ghi nhận pattern. `/status` endpoint promote về UTC khi compute live duration. Inconsistency trade-off chấp nhận cho SQLite.

## 7. Test commands (reproducible)

```bash
cd mvp/code

uv run pytest                              # 133 pass (118 cũ + 15 Phase 5)
uv run pytest tests/integration/test_run_lifecycle.py -v   # 15 phase 5
uv run ruff check app tests                # clean

# Smoke với uvicorn thực
uv run uvicorn app.main:app --port 8000   # terminal 1
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# POST /run → 202
curl -sS -X POST http://127.0.0.1:8000/api/run \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"total_capital":500000000}'
# → {"success":true,"data":{"run_id":"run_xxx","status":"PENDING"}}

# Poll status
curl -sS http://127.0.0.1:8000/api/runs/run_xxx/status -H "Authorization: Bearer $TOKEN"
# → status real-time PENDING/CHECKING_DATA/SCREENING/SCORING/COMPLETED

# 409 conflict (gọi 2 lần liên tiếp)
curl -sS -X POST http://127.0.0.1:8000/api/run -H "Authorization: Bearer $TOKEN" -d '{"total_capital":0}'
# → 409 ERR-JOB-CONFLICT
```

⚠️ **Lưu ý**: Production smoke chỉ chạy đúng nếu `financial_reports` + `stock_prices` đã có data (refresh_service Phase 3 đã chạy thật với vnstock real). Test SQLite dev không có data thực → screening sẽ excluded round 4 toàn bộ → 0 results. Để smoke local: gọi POST /api/refresh/all trước.

## 8. Hand-off cho Phase 6

Phase 6 (Read APIs) sẽ wire:
- GET /api/runs/{id}/results — full results array (pagination optional cho 81 mã)
- GET /api/runs/{id}/dashboard — aggregate 5 KPI + 5 charts (treemap, pie, line, bar, radar)
- GET /api/runs/{id}/stocks/{ticker} — Stock Detail full schema (TAD g02 §4) + features map
- GET /api/runs/{id}/excluded — Red Flags page (cluster prompt §5 drift; thêm endpoint mới)
- GET /api/runs/{id}/compare/{run_id_b} — 4-section diff (cluster 5)
- GET /api/stocks + /api/stocks/{ticker}/prices — Price Board
- GET /api/news + /api/news/sentiment/{ticker} — News page

Đã sẵn sàng:
- Bulk results + excluded inserted với đầy đủ fields ✓
- screening_runs có total_input/after_round_1..4/scored/buy/hold/sell ✓
- model_version + settings_version + duration_seconds ✓
- warnings_json + reasons_json + feature_values_json + radar_json + warning_badges_json ✓ (Phase 6 sẽ parse JSON cho /stocks/{ticker})
- Job lock + status state machine ✓
- 5 macro indicators seeded ✓

⚠️ **Phase 6 phải audit**:
- Endpoint /excluded chưa có trong TAD g02 §1 registry → cần ADD (cluster prompt §5).
- Compare schema 4-section (TAD g02 §8.3) — Phase 6 phải implement compute_compare() backend, không depend FE-side computeCompare cluster 5 mock.
- Dashboard aggregate query có thể cần index cho /runs/{id}/results JOIN /stocks (sector groupby) — verify.

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 5 sau khi phase đã đóng)*
