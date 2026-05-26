# Phase 14 — Production Data Hardening

**Ngày:** 2026-05-18 đến 2026-05-19  
**Mục tiêu thực hiện:** bắt đầu Mốc 2, harden price refresh để giữ partial data, có stats, resume failed/empty tickers và migrate price client khỏi API vnstock cũ.  
**Trạng thái:** COMPLETED 2026-05-19

> Cập nhật 2026-05-19: tồn đọng `fetch_financials()` stub ở mục 6 đã được xử lý trong `report/phase-mvp/phase-15-financial-ingestion/SUMMARY.md`.

## 1. Việc đã làm

- Thêm `stats` vào job metadata trong `job_lock`.
- `GET /api/refresh/{id}/status` trả thêm `stats`.
- `POST /api/refresh/prices` nhận body tùy chọn:
  - `{"resume_failed": true}`
  - `{"tickers": ["VHM", "VIC"]}`
- `run_refresh_prices()` commit từng ticker thành công để giữ partial data.
- Sửa `run_refresh_prices()` để không giữ DB session/transaction trong lúc gọi vnstock; chỉ mở session ngắn khi đọc danh sách ticker và khi upsert rows.
- Sửa `run_refresh_all()` cùng nguyên tắc: phần price/financial fetch không nằm trong DB session, cache price dùng cùng logic `FRESH/PARTIAL`.
- Lưu ticker lỗi/rỗng gần nhất để retry bằng `resume_failed`.
- Thêm `full_universe` vào stats để phân biệt refresh toàn bộ universe với subset/resume.
- Sửa cache giá theo TAD source-level: chỉ refresh toàn bộ universe thành công 100% mới mark `vnstock_price` là `FRESH`; partial/subset/resume có dữ liệu thành công chỉ mark `PARTIAL`.
- Chuyển `VnstockClient.fetch_prices()` từ API cũ `Vnstock().stock(...)` sang `vnstock.api.quote.Quote`.
- Cập nhật tests cho partial stats, resume, source-level cache `PARTIAL/FRESH`.
- Cập nhật `mvp/README.md` phần vnstock troubleshooting và số lượng test.
- Cập nhật `report/mvp-build/SUMMARY.md` theo số lượng test mới.
- Đọc/đối chiếu lại các quyết định liên quan trong SRS/TAD/architecture/phase docs:
  - `docs/tad/g01-runtime.md`
  - `docs/tad/g02-api.md`
  - `docs/tad/g04-cache.md`
  - `docs/tad/g07-deployment.md`
  - `docs/system-architecture/07-cache-cross-cutting.md`
  - `mvp/phases/phase-3-refresh-layer/SUMMARY.md`
  - `mvp/phases/phase-5-screening-orchestrator/SUMMARY.md`

## 2. File đã sửa

- `mvp/code/app/job_lock.py`
- `mvp/code/app/api/refresh.py`
- `mvp/code/app/schemas/refresh.py`
- `mvp/code/app/services/refresh_service.py`
- `mvp/code/app/crawlers/vnstock_client.py`
- `mvp/code/tests/integration/test_refresh.py`
- `mvp/code/tests/unit/test_vnstock_client.py`
- `mvp/README.md`
- `report/mvp-build/SUMMARY.md`

## 3. File đã thêm

- `report/phase-mvp/phase-14-production-data-hardening/SUMMARY.md`
- `mvp/phases/phase-14-production-data-hardening/SUMMARY.md`
- `mvp/phases/phase-14-production-data-hardening/REVIEW.md`

## 4. Lệnh đã chạy

```bash
uv run python -c "from vnstock.api.quote import Quote; import inspect; print(inspect.signature(Quote.history))"
uv run pytest tests/unit/test_vnstock_client.py tests/unit/test_job_lock.py tests/integration/test_refresh.py -q
uv run pytest tests/integration/test_refresh.py tests/unit/test_cache_manager.py tests/unit/test_vnstock_client.py tests/unit/test_job_lock.py -q
uv run ruff check app/ tests/
uv run pytest -q
uv run pytest --collect-only -q
cd frontend && npm run build
```

## 5. Kết quả

- Xác nhận local vnstock 4.0.2 có `vnstock.api.quote.Quote`.
- Xác nhận `Quote.history(symbol,start,end,interval)` dùng được ở mức signature/import.
- Targeted tests pass 37/37 cho refresh/cache/vnstock/job_lock.
- Ruff pass.
- Full backend pytest pass — 253/253.
- Collect-only xác nhận 161 integration tests + 92 unit tests = 253 tests.
- Frontend build pass — generated 15 app pages.

## 6. Tồn đọng

- Chưa chạy full 81-ticker refresh thật vì cần quyết định quota/API key và thời gian chạy.
- `fetch_financials()` stub đã được thay bằng BCTC thật ở Phase 15; chưa chạy production refresh thật vì cần network/quota/API key.
