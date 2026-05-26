# Phase 12 — Implementation Report

**Ngày thực hiện:** 2026-05-17 đến 2026-05-18  
**Mục tiêu thực hiện:** verify lại MVP, sửa drift tài liệu, chạy production-data QA lần đầu và xử lý lỗi vnstock quota/SystemExit.

## 1. Việc đã làm

- Chạy lại backend test suite.
- Chạy lại frontend production build.
- Cập nhật build summary từ trạng thái cũ “Phase 11 pending” sang trạng thái Phase 12 closed.
- Cập nhật tài liệu rate limit vnstock.
- Tạo audit files cho Phase 12 trong `mvp/phases/phase-12-production-data-qa/`.
- Chạy local runtime smoke với FastAPI + SQLite.
- Chạm `POST /api/refresh/prices` với thư viện vnstock thật.
- Sửa lỗi vnstock quota path raise `SystemExit`.

## 2. File đã thêm

- `mvp/code/tests/unit/test_vnstock_client.py`
- `mvp/phases/phase-12-production-data-qa/SUMMARY.md`
- `mvp/phases/phase-12-production-data-qa/REVIEW.md`
- `report/phase-mvp/phase-12-production-data-qa/IMPLEMENTATION.md`

## 3. File đã sửa

- `report/mvp-build/SUMMARY.md`
- `mvp/README.md`
- `mvp/code/.env.example`
- `mvp/code/app/config.py`
- `mvp/code/app/crawlers/vnstock_client.py`
- `mvp/code/app/services/refresh_service.py`
- `mvp/code/tests/integration/test_refresh.py`

## 4. Lỗi production-data đã gặp

`POST /api/refresh/prices` gọi vnstock thật và phát hiện:

- `VNSTOCK_RATE_LIMIT_S=0.5` quá nhanh so với guest quota quan sát được là 20 requests/phút.
- vnstock quota path có thể gọi `sys.exit()`, tạo `SystemExit`.
- `SystemExit` không bị bắt bởi `except Exception`, khiến background task có thể log ASGI exception và không kết thúc job sạch.
- vnstock đang log API cũ `Vnstock().stock(...)` bị deprecated.

## 5. Cách đã sửa

- Đổi default `VNSTOCK_RATE_LIMIT_S` từ `0.5` sang `6.5`.
- Cập nhật `.env.example` để giải thích guest quota.
- `VnstockClient.fetch_prices()` bắt `SystemExit` có thể recover và chuyển thành `VnstockUnavailable`.
- `refresh_service` thêm guard để background job về terminal `FAILED` và release `job_lock` khi external library abort recoverable.
- Thêm test wrapper boundary cho `SystemExit`, generic exception và `KeyboardInterrupt`.
- Thêm regression test `test_refresh_prices_recovers_when_vnstock_calls_system_exit`.

## 6. Lệnh đã chạy

```bash
cd mvp/code && uv run pytest -q
cd mvp/code && uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py -q
cd mvp/code && uv run ruff check app/ tests/
cd frontend && npm run build
cd mvp/code && uv run alembic upgrade head
cd mvp/code && uv run python -m app.db.seed
cd mvp/code && uv run uvicorn app.main:app --port 8000
```

## 7. Kết quả

- Backend full suite: PASS — 247/247 tại thời điểm Phase 12.
- Targeted wrapper/refresh tests: PASS — 12/12.
- Ruff: PASS.
- Frontend production build: PASS — 15 app pages.
- Migration: PASS.
- Seed: PASS.
- `/api/health`: PASS.
- `/api/version`: PASS.
- `/api/auth/login`: PASS.
- `POST /api/run` + status poll: PASS, kết quả `COMPLETED_WITH_WARNINGS`.
- `/api/runs/{id}/dashboard`: PASS envelope, nhưng local DB lúc đó trả 0 scored rows.
- `/api/runs/{id}/results`: PASS envelope, nhưng local DB lúc đó trả 0 rows.
- `/api/telegram/test`: PASS expected disabled response vì chưa cấu hình credentials.

## 8. Tồn đọng

- Chưa chạy full 81-ticker refresh sau khi đổi rate limit vì guest-safe delay cố ý chậm.
- Cần migrate `VnstockClient.fetch_prices()` khỏi API deprecated.
- Cần partial/resumable refresh.
- Cần verify Telegram với credentials thật.
- Cần Playwright smoke cho login → refresh/run → dashboard → results → share/export.
