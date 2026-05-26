# Phase 13 — Demo Stability / DB Isolation

**Ngày:** 2026-05-18  
**Mục tiêu thực hiện:** triển khai Mốc 1 để tách DB test khỏi DB demo và tạo dữ liệu demo ổn định.  
**Trạng thái:** COMPLETED 2026-05-18

## 1. Việc đã làm

- Chuyển pytest sang DB riêng `./data/test-screener.db`.
- Thêm guard để pytest không chạy nhầm trên `screener.db`, `demo-screener.db`, hoặc DB không có chữ `test` trong tên file.
- Thêm script tạo demo DB riêng `./data/demo-screener.db`.
- Tạo demo run cố định `run_demo_latest`.
- Thêm env mẫu cho demo local.
- Gom report Phase 12 và Phase 13 vào `report/phase-mvp/`.
- Thêm quy ước tổ chức report trong `report/README.md`.

## 2. File đã thêm

- `mvp/code/app/db/demo_seed.py`
- `mvp/code/env.demo.example`
- `mvp/code/tests/integration/test_db_isolation.py`
- `mvp/phases/phase-13-demo-stability/SUMMARY.md`
- `mvp/phases/phase-13-demo-stability/REVIEW.md`
- `report/README.md`
- `report/phase-mvp/phase-13-demo-stability/SUMMARY.md`

## 3. File đã sửa

- `README.md`
- `frontend/README.md`
- `mvp/README.md`
- `mvp/code/tests/conftest.py`
- `mvp/code/tests/integration/test_seed.py`
- `report/mvp-build/SUMMARY.md`

## 4. File đã di chuyển

- `report/mvp-build-summary.md` → `report/mvp-build/SUMMARY.md`
- `report/phase-12-implementation-report.md` → `report/phase-mvp/phase-12-production-data-qa/IMPLEMENTATION.md`
- `report/phase-12-production-data-qa/` → `report/phase-mvp/phase-12-production-data-qa/`
- `report/phase-13-demo-stability/` → `report/phase-mvp/phase-13-demo-stability/`

User đã di chuyển trước đó:

- `report/cluster-{1..6}-summary.md` → `report/cluster-prompts/cluster-{1..6}-summary.md`

## 5. Lệnh đã chạy

```bash
APP_ENV=demo DB_PATH=./data/demo-screener.db uv run python -m app.db.demo_seed
uv run pytest tests/integration/test_db_isolation.py tests/integration/test_seed.py -q
uv run ruff check app/ tests/
uv run pytest -q
cd ../../frontend && npm run build
```

## 6. Kết quả

Demo seed:

- `run_id`: `run_demo_latest`
- `run_status`: `COMPLETED`
- `screening_results`: 81
- `buy_count`: 21
- `financial_reports`: 324
- `stock_prices`: 17.820

Targeted tests:

- `tests/integration/test_db_isolation.py`
- `tests/integration/test_seed.py`
- Kết quả: PASS 7/7

Lint:

- `uv run ruff check app/ tests/`
- Kết quả: PASS

Full backend test:

- `uv run pytest -q`
- Kết quả: PASS — 251/251

Frontend build:

- `cd frontend && npm run build`
- Kết quả: PASS — generated 15 app pages

Demo DB sau full pytest:

- `stock_prices`: 17.820
- `financial_reports`: 324
- `screening_results`: 81
- `buy_results`: 21

## 7. Tồn đọng

- Chưa triển khai Playwright smoke; thuộc phase sau.
- Chưa xử lý vnstock/BCTC production ingestion; thuộc Mốc 2.
