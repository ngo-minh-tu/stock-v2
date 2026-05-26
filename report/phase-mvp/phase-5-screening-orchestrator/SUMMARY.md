# Phase 5 — Screening Orchestrator

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** wire 5 endpoint `/run` + `/runs/*` + DELETE, background driver orchestrate filter → feature → score → price → entry → risk → bulk insert; chốt state machine 7-state TAD g01 §2.1; seed minimal macro.
**Trạng thái:** COMPLETED 2026-05-10

## 1. Việc đã làm

- Pre-code drift audit 3 drift Phase 1-4:
  - macro_data empty → thêm `seed_macro()` + `MACRO_DEFAULTS` 5 indicator × 2026Q2 (interest 5%, credit 12%, CPI 3.5%, FDI 4B USD, VN-Index 1300).
  - ERR-01-* thiếu → thêm 3 constants `ERR_SCREENING_NO_DATA/_EMPTY_RESULTS/_ENGINE_CRASH`.
  - Decimal/float coercion bug `feature_service._safe_div`: SQLAlchemy `Numeric` → Decimal, fail khi pass vào `_normalize`. Fix cast `float(num) / float(den)` + None nếu den_f == 0.
- POST /api/run (202): validate body → create `screening_runs` PENDING → `job_lock.try_acquire(run_id, "screening")` 409 conflict → `BackgroundTasks.add_task(run_screening)`.
- GET /api/runs/{id}/status: real-time status + progress + live duration cho active runs (FE poll 2s).
- GET /api/runs/{id}: full summary (4-round counts + scored/buy/hold/sell + warnings + duration).
- GET /api/runs?limit&offset: paginated RunSummary 12 fields cluster-5 (avg_score, warnings_count, model_version, duration_seconds, settings_version).
- DELETE /api/runs/{id}: 200+envelope, cascade app-level xoá children.
- Background driver `run_screening(run_id, total_capital, skip_allocation)`: state machine PENDING (5%) → CHECKING_DATA (5%) → SCREENING (15%) → SCORING (30-95%) → terminal (100%). `MODEL_VERSION = "baseline_v2"` hardcode.
- Helpers: `_data_from_cache` (TRUE nếu vnstock_price OR financial STALE — AC-01-06), `_score_one`, `_apply_allocation` (TRƯỚC bulk_insert tránh 2 round-trip), `_summarize_warnings`, `_final_status`.
- 3 repository mới: `screening_repo` (create_run/get/update_status/update_counts/mark_completed/list_paginated/delete_run/latest_n_run_ids), `results_repo` (bulk_insert mappings + list_by_run + get_by_run_ticker + delete_by_run), `excluded_repo` (bulk_insert + list/delete).
- 7 schema Pydantic v2 trong `run.py`: RunRequest (extra=ignore — tolerant prototype `outcome` field), RunAcceptedResponse, RunStatusResponse (extra=forbid), RunSummary 12-field, RunListResponse, RunFullSummary, RunDeletedResponse, ScreeningResultRow.
- `nav_discount_pct = features["R04"] * 100` chuyển decimal → percent cho EntryInput. `technical_features_available` đếm 8 raw indicators.
- 1 file integration test, +15 cases: 4 auth + lifecycle + concurrent 409 + cascade DELETE + allocation invariants + skip_allocation + 404 trên 3 endpoint + paginated.
- Synthetic-data fixture `screening_data` insert 4Q financials + 200 daily prices cho 81 mã ACTIVE.

## 2. File đã thêm

- `mvp/code/app/repositories/screening_repo.py`, `results_repo.py`, `excluded_repo.py`
- `mvp/code/app/schemas/run.py`
- `mvp/code/app/services/screening_service.py`
- `mvp/code/app/api/screening.py`
- `mvp/code/tests/integration/test_run_lifecycle.py`

## 3. File đã sửa

- `mvp/code/app/db/seed.py` — thêm `MACRO_DEFAULTS` + `seed_macro(db)` upsert + wire vào `run()`.
- `mvp/code/app/constants/error_codes.py` — thêm ERR_SCREENING_NO_DATA / _EMPTY_RESULTS / _ENGINE_CRASH.
- `mvp/code/app/api/__init__.py` — register `screening.router`.
- `mvp/code/app/services/feature_service.py` — `_safe_div` cast `float(num) / float(den)`.
- `mvp/code/tests/integration/test_seed.py` — assert `MacroData == 5`.

## 4. Lệnh đã chạy

```bash
cd mvp/code
uv run pytest                                          # 133/133
uv run pytest tests/integration/test_run_lifecycle.py -v   # 15 phase 5
uv run ruff check app tests                            # clean

# Smoke
uv run uvicorn app.main:app --port 8000
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl -sS -X POST http://127.0.0.1:8000/api/run \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"total_capital":500000000}'
curl -sS http://127.0.0.1:8000/api/runs/run_xxx/status -H "Authorization: Bearer $TOKEN"
curl -sS -X POST http://127.0.0.1:8000/api/run -H "Authorization: Bearer $TOKEN" -d '{"total_capital":0}'
# → 409 ERR-JOB-CONFLICT
```

## 5. Kết quả

- Pytest: PASS — 133/133 (Phase 0-4: 118, Phase 5 mới: 15).
- Ruff: PASS.
- End-to-end POST /run trên 81 mã → COMPLETED in ~1.3s; `total_input == 81 == after_round_1 + excluded_round_1`; `buy + hold + sell == scored_count` (AC-01-10).
- Concurrent POST /run khi lock acquired → 409 ERR-JOB-CONFLICT.
- `sum(allocation_amount) == total_capital ±1đ` (AC-09-04). Non-MUA → NULL.
- DELETE /runs/{id} cascade verified — không ảnh hưởng run khác.
- `seed_macro` idempotent: re-run không dup; M01-M05 đều có row 2026Q2.

## 6. Tồn đọng

- **TestClient await BG semantics:** test check terminal trực tiếp, không polling. Production uvicorn truly async.
- **Macro values stub** 2026Q2 hardcode → group score `macro` constant qua runs. Acceptable MVP; production cần SBV/GSO crawler.
- **MODEL_VERSION = "baseline_v2"** literal hardcode. Bump khi swap engine sau Phase 4.
- **`avg_score` compute trong GET /runs query results** → O(N×M); limit ≤ 10 OK. Phase 6+ optimize bằng aggregate query.
- **Concurrent screen + refresh tương tác:** cùng `job_lock`; UX cluster 2 toast tiếng Việt.
- **Sector medians chưa wire:** `FeatureService(sector_medians={})` empty. Phase 6+ aggregate hoặc hardcode defaults (Phase 4 đã có R01=1000, R02=4, R03=25K).
- **`_score_one` defensive None return** cho race condition (concurrent refresh wipe data) — test không cover.
- **`screening_runs.run_at` naive datetime SQLite** — `/status` promote UTC khi compute live duration.
- **Server restart ghost jobs:** PROCESSING > timeout không tự FAILED. TAD g05 chưa wire.

### Post-phase fix 2026-05-16 — `_data_from_cache()` chuyển sang `is_usable()`

- Bug: Phase 9 mark financial cache `status="STUB"` nhưng `_data_from_cache()` dùng `is_stale()` thuần TTL → trả False cho STUB-within-TTL → run không bật warning DATA_FROM_CACHE.
- Fix: đổi `not is_usable(...)` (helper Phase 3 §9). Cả 2 nguồn price + financial route qua usable gate. Thêm `test_get_run_status_includes_warnings_field` guard FE contract khỏi field `warnings` bị remove silently.
- Files: `screening_service.py` +6 LOC; `test_run_lifecycle.py` +21 LOC.
