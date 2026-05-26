# Phase 3 — Refresh Layer

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** dựng job lock singleton, vnstock client rate-limit, cache freshness gate source-level (TAD g04), 3 endpoint refresh + background driver.
**Trạng thái:** COMPLETED 2026-05-10 (cập nhật 2026-05-19: `fetch_financials()` stub Phase 3 đã được Phase 15 thay bằng ingestion BCTC thật)

## 1. Việc đã làm

- Pre-code drift audit phát hiện 3 drift Phase 1 → fix ngay:
  - RunStatus enum: 7 canonical states (TAD g01 §2.1) thay 7 cũ sai.
  - Cache TTL: financial=720h, macro=720h, news=6h (TAD g04 §1) thay 24h Phase 1.
  - Job lock: `threading.Lock` (TAD g05 §1) — FastAPI BackgroundTasks chạy sync trên threadpool, không qua asyncio loop.
- Viết `app/job_lock.py` — `JobLock` thread-safe singleton với `try_acquire/release/update/get/reset`, in-mem registry `{job_id: snapshot}`.
- Viết `app/crawlers/vnstock_client.py` — `VnstockClient.fetch_prices` (lazy import + module-level `_RateGate` 0.5s) + `fetch_financials` stub; raise `VnstockUnavailable`.
- Viết `app/crawlers/cache_manager.py` — `is_stale(db, source)` compute timedelta vs `ttl_hours`, `mark_refreshed()` upsert, SQLite naive→aware UTC promotion.
- 3 repository: `cache_repo` (get + upsert), `price_repo` (`bulk_upsert` SQLite ON CONFLICT), `stock_repo` (list_active_tickers + list_all_stocks).
- 2 schema: `RefreshAcceptedResponse`, `RefreshStatusResponse` (extra=forbid).
- `app/services/refresh_service.py` — `run_refresh_prices/all` background driver chạy trên BackgroundTasks; progress update mỗi 5 ticker; mark COMPLETED/FAILED + cache `mark_refreshed`. `_client_factory` test hook cho monkeypatch.
- `app/api/refresh.py` — POST /refresh/all + /refresh/prices (202), GET /refresh/{id}/status; UUID12 + 409 conflict.
- Update `app/db/seed.py` — `seed_cache_metadata` upsert pattern dùng `ALL_SOURCES`; cache rows 5 → 9.
- 3 file tests, +22 cases: 8 job_lock + 6 cache_manager + 8 refresh integration.

## 2. File đã thêm

- `mvp/code/app/job_lock.py`
- `mvp/code/app/crawlers/__init__.py`, `vnstock_client.py`, `cache_manager.py`
- `mvp/code/app/repositories/cache_repo.py`, `price_repo.py`, `stock_repo.py`
- `mvp/code/app/schemas/refresh.py`
- `mvp/code/app/services/refresh_service.py`
- `mvp/code/app/api/refresh.py`
- `mvp/code/tests/unit/test_job_lock.py`, `test_cache_manager.py`
- `mvp/code/tests/integration/test_refresh.py`

## 3. File đã sửa

- `mvp/code/app/constants/enums.py` — RunStatus 7 canonical + RUN_TERMINAL_STATES + `RefreshStatus` 4-state.
- `mvp/code/app/constants/sources.py` — TTL đúng TAD g04 (financial=720h, macro=720h, news=6h).
- `mvp/code/app/db/seed.py` — upsert cache_metadata + `build_cache_seeds` dùng `ALL_SOURCES` (9 sources).
- `mvp/code/app/api/__init__.py` — register refresh router.
- `mvp/code/tests/integration/test_seed.py` — assert `cache_metadata == 9`.

## 4. Lệnh đã chạy

```bash
cd mvp/code
uv run pytest                    # 52/52
uv run ruff check app tests      # clean

# Smoke
uv run uvicorn app.main:app --port 8000
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS -X POST http://127.0.0.1:8000/api/refresh/prices -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8000/api/refresh/refresh_xxx/status -H "Authorization: Bearer $TOKEN"
```

## 5. Kết quả

- Pytest: PASS — 52/52 (Phase 0-2: 30, Phase 3 mới: 22).
- Ruff: PASS.
- Smoke verified: POST /refresh/prices không Bearer → 401; có Bearer → 202 `{refresh_id, status: PENDING}`. GET /refresh/{id}/status → envelope với type=refresh, status/progress/message tiếng Việt. Unknown id → 404 ERR-NOT-FOUND.
- Job lock 409 verified qua test: manual acquire screening → POST refresh → 409 + message "Đang có tác vụ chạy: screening".

## 6. Tồn đọng

- **TestClient BG semantics:** sau `client.post('/refresh/prices')`, BG task đã chạy xong → status đã terminal. Production behavior khác (FE poll nhiều lần). Test_get_refresh_status check `status in {COMPLETED, FAILED}` không assert trung gian.
- **Financials stub:** `fetch_financials()` return `[]` + log warning. Real wire ở Phase 4-5 khi engines cần data. Phase 15 đã thay stub bằng ingestion thật.
- **Naive datetime trong SQLite:** `cache_metadata.last_refreshed_at` lưu naive; `cache_manager._aware()` promote UTC khi compute timedelta. Trade-off SQLite.
- **`JobLock.reset()` test-only:** production KHÔNG gọi.
- **Server restart ghost jobs:** in-mem registry mất khi restart. Pattern documented (TAD g01 §1) nhưng chưa code mark PROCESSING > X phút thành FAILED. Phase 10 audit.
- **Macro crawler stub:** hardcoded constants M01-M05; production cần SBV/GSO scraper post-MVP.

### Post-phase fix 2026-05-16 — Cache STUB usability gate

- Bug: `is_stale()` chỉ check TTL, bỏ qua `status`. Phase 9 mark financial `status="STUB"` nhưng TTL hợp lệ → screening không bật badge DATA_FROM_CACHE.
- Fix: thêm `is_usable(db, source_key)` riêng — True iff meta + last_refreshed_at + status==FRESH + TTL còn hạn. Giữ `is_stale()` TTL-only để refresh không re-trigger vô tận. Downstream gate dùng `is_usable()`; refresh gate dùng `is_stale()`.
- Tests: `test_cache_manager.py` +7 cases. Files: `cache_manager.py` +14 LOC, test +60 LOC.
