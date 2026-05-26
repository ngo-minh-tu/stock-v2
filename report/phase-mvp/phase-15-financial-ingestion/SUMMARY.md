# Phase 15 — Financial Data Ingestion

**Ngày:** 2026-05-19  
**Mục tiêu thực hiện:** triển khai Mốc 3 bằng cách thay `fetch_financials()` stub bằng ingestion BCTC thật và ghi vào `financial_reports`.  
**Trạng thái:** COMPLETED 2026-05-19

## 1. Việc đã làm

- Khôi phục thay đổi dependency frontend do tab mới tạo ra trước khi triển khai mốc 3:
  - `frontend/package.json`
  - `frontend/package-lock.json`
- Đọc lại SRS/TAD/phase hand-off liên quan trước khi sửa:
  - `docs/srs/f02-feature-engineering.md`
  - `docs/tad/g03-database.md`
  - `docs/tad/g04-cache.md`
  - `docs/tad/g07-deployment.md`
  - `mvp/phases/phase-14-production-data-hardening/SUMMARY.md`
  - `mvp/phases/phase-14-production-data-hardening/REVIEW.md`
- Kiểm tra local `vnstock 4.0.2` và xác nhận có `vnstock.api.financial.Finance`.
- Thay `VnstockClient.fetch_financials()` stub bằng implementation gọi:
  - `Finance(...).income_statement(period="quarter")`
  - `Finance(...).balance_sheet(period="quarter")`
  - `Finance(...).cash_flow(period="quarter")`
  - `Finance(...).ratio(period="quarter")` nếu lấy được
- Thêm parser để chuẩn hoá BCTC dạng DataFrame về row theo kỳ báo cáo, khớp schema `financial_reports`.
- Thêm alias mapping cho các field tài chính SRS/TAD yêu cầu: revenue, net income, assets, equity, debt, current assets/liabilities, inventory, COGS, OCF, EPS, BVPS, advances, shares outstanding, audit opinion.
- Thêm `financial_repo.bulk_upsert()` theo unique key `(ticker, period)`.
- Sửa `run_refresh_all()` để upsert BCTC thật thay vì chỉ gọi stub.
- Thêm `_FinancialRefreshStats` vào refresh status.
- Sửa cache `vnstock_financial`: chỉ `FRESH` khi full universe thành công toàn bộ; nếu có dữ liệu nhưng còn lỗi/rỗng thì `PARTIAL`.
- Giữ nguyên quy tắc TAD g07: không giữ DB session khi gọi vnstock external source.
- Bổ sung test không network cho vnstock financial wrapper và refresh all upsert BCTC.

## 2. File đã sửa

- `mvp/code/app/crawlers/vnstock_client.py`
- `mvp/code/app/repositories/financial_repo.py`
- `mvp/code/app/services/refresh_service.py`
- `mvp/code/tests/unit/test_vnstock_client.py`
- `mvp/code/tests/integration/test_refresh.py`
- `README.md`
- `mvp/README.md`
- `plan/PLAN.md`
- `report/README.md`
- `report/mvp-build/SUMMARY.md`
- `mvp/phases/phase-14-production-data-hardening/SUMMARY.md`
- `mvp/phases/phase-14-production-data-hardening/REVIEW.md`

## 3. File đã thêm

- `mvp/phases/phase-15-financial-ingestion/SUMMARY.md`
- `mvp/phases/phase-15-financial-ingestion/REVIEW.md`
- `report/phase-mvp/phase-15-financial-ingestion/SUMMARY.md`

## 4. Lệnh đã chạy

```bash
git checkout -- frontend/package.json frontend/package-lock.json
uv run python -c "from vnstock.api.financial import Finance; import inspect; print(inspect.signature(Finance))"
uv run ruff check app/crawlers/vnstock_client.py app/repositories/financial_repo.py app/services/refresh_service.py tests/unit/test_vnstock_client.py tests/integration/test_refresh.py
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py
uv run pytest -q
```

## 5. Kết quả

- `frontend/package.json` và `frontend/package-lock.json` đã được khôi phục về trạng thái bàn giao sau Mốc 2.
- Targeted tests cho vnstock financial wrapper và refresh pass.
- Ruff pass trên các file đã chạm.
- Full backend pytest pass — 256/256.

## 6. Tồn đọng

- Chưa chạy production refresh thật vì cần network/quota/API key; user đã yêu cầu hạn chế chạy ngoài sandbox.
- Chưa thêm endpoint riêng `/refresh/financials`; hiện BCTC thật chạy trong `/refresh/all` theo TAD hiện tại.
- Cần chạy subset thật 1-3 mã ở bước sau để xác nhận alias mapping trên dữ liệu live.
