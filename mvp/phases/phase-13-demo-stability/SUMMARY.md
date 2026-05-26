# Phase 13 — Demo Stability / DB Isolation

**Status:** COMPLETED 2026-05-18  
**Spec ref:** Mốc 1 từ tư vấn production hardening; Phase 12 hand-off [SUMMARY.md §6](../phase-12-production-data-qa/SUMMARY.md).  
**Report:** [report/phase-mvp/phase-13-demo-stability/SUMMARY.md](../../../report/phase-mvp/phase-13-demo-stability/SUMMARY.md)

## 1. Scope

Tách state test khỏi state demo để chạy pytest không làm trống dữ liệu demo local.

Trong scope:

- Pytest dùng DB riêng `./data/test-screener.db`.
- Demo local dùng DB riêng `./data/demo-screener.db`.
- Demo seed tạo dữ liệu đủ cho dashboard/results/top MUA/stock detail.
- Cập nhật README và report links theo cấu trúc report folder mới.

Out of scope:

- Migrate vnstock API.
- Ingest BCTC thật.
- Playwright smoke.
- Production deploy/security checklist.

## 2. Pre-code audit / drift

| # | Drift / issue | Resolution |
|---|---|---|
| 1 | Integration tests dùng chung dev DB, fixture cleanup có thể xoá `stock_prices`, `financial_reports`, `screening_*` | ✅ Chuyển pytest sang `./data/test-screener.db`; xoá DB test ở đầu session |
| 2 | Local demo DB sau khi chạy test có thể không còn run/results để FE hiển thị | ✅ Thêm `app.db.demo_seed` tạo `run_demo_latest` hoàn tất |
| 3 | Report root bắt đầu có nhiều file lẻ | ✅ Gom reports theo folder: `cluster-prompts/`, `mvp-build/`, `phase-mvp/<phase>/` |
| 4 | Report và phase docs có vai trò khác nhau | ✅ `report/phase-mvp/...` giữ dạng nhật ký thực hiện; `mvp/phases/...` giữ audit trail theo format phase |

## 3. Deliverables

### Mới tạo

| Path | Nội dung |
|---|---|
| [app/db/demo_seed.py](../../code/app/db/demo_seed.py) | Tạo demo DB synthetic + run hoàn tất |
| [env.demo.example](../../code/env.demo.example) | Env mẫu cho local demo |
| [tests/integration/test_db_isolation.py](../../code/tests/integration/test_db_isolation.py) | Regression test cho DB isolation |
| [report/README.md](../../../report/README.md) | Quy ước tổ chức report |
| [report/phase-mvp/phase-13-demo-stability/SUMMARY.md](../../../report/phase-mvp/phase-13-demo-stability/SUMMARY.md) | Nhật ký thực hiện Phase 13 |

### Sửa

| Path | Nội dung |
|---|---|
| [tests/conftest.py](../../code/tests/conftest.py) | Set `APP_ENV=test`, `DB_PATH=./data/test-screener.db`, guard non-test DB |
| [tests/integration/test_seed.py](../../code/tests/integration/test_seed.py) | Cập nhật docstring test DB riêng |
| [README.md](../../../README.md) | Quick start demo dùng `env.demo.example` + `demo_seed` |
| [mvp/README.md](../../README.md) | Thêm DB modes, demo setup, test isolation note |
| [frontend/README.md](../../../frontend/README.md) | Ghi chú backend demo seed có sẵn `run_demo_latest` |
| [report/mvp-build/SUMMARY.md](../../../report/mvp-build/SUMMARY.md) | Thêm Phase 13 và report folder note |

### Di chuyển report

| Old | New |
|---|---|
| `report/mvp-build-summary.md` | `report/mvp-build/SUMMARY.md` |
| `report/phase-12-implementation-report.md` | `report/phase-mvp/phase-12-production-data-qa/IMPLEMENTATION.md` |
| `report/phase-12-production-data-qa/` | `report/phase-mvp/phase-12-production-data-qa/` |
| `report/phase-13-demo-stability/` | `report/phase-mvp/phase-13-demo-stability/` |

## 4. Exit criteria

| Check | Result |
|---|---|
| Demo seed creates a completed run | PASS — `run_demo_latest` status `COMPLETED` |
| Demo has result rows | PASS — 81 screening results |
| Demo has Top MUA data | PASS — 21 `MUA` rows with demo thresholds |
| Pytest isolation targeted tests | PASS — 7/7 |
| Ruff | PASS |
| Full backend pytest | PASS — 251/251 |
| Frontend build | PASS — 15 app pages |

## 5. Locked decisions

| Mục | Giá trị | Lý do |
|---|---|---|
| Test DB path | `./data/test-screener.db` | Không chạm demo/product DB |
| Demo DB path | `./data/demo-screener.db` | Tách khỏi pytest và production-like DB |
| Demo run id | `run_demo_latest` | Stable cho QA/demo |
| Demo thresholds | buy `55`, hold `45` | Đảm bảo Top MUA có dữ liệu demo |
| Report grouping | `report/phase-mvp/<phase>/` | Phase 12/13 cùng nhóm sau MVP |

## 6. Verification commands

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
APP_ENV=demo DB_PATH=./data/demo-screener.db uv run python -m app.db.demo_seed
uv run pytest tests/integration/test_db_isolation.py tests/integration/test_seed.py -q
uv run ruff check app/ tests/
uv run pytest -q
cd /Users/ngominhtu/Projects/stock-v2/frontend
npm run build
```

## 7. Hand-off

Phase 13 đã đóng phần Mốc 1. Mốc tiếp theo: production-data ingestion hardening (vnstock API migration, partial/resumable refresh, full refresh QA).
