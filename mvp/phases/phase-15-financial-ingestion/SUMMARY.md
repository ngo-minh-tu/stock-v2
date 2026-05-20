# Phase 15 — Financial Data Ingestion

**Status:** COMPLETED 2026-05-19  
**Spec ref:** Phần còn lại của Mốc 2 (BCTC ingestion) từ hand-off Phase 14; SRS [f02-feature-engineering.md](../../../docs/srs/f02-feature-engineering.md), TAD [g03-database.md](../../../docs/tad/g03-database.md), [g04-cache.md](../../../docs/tad/g04-cache.md), [g07-deployment.md](../../../docs/tad/g07-deployment.md).  
**Report:** [report/phase-mvp/phase-15-financial-ingestion/SUMMARY.md](../../../report/phase-mvp/phase-15-financial-ingestion/SUMMARY.md)

## 1. Scope

Phần còn lại của Mốc 2 — triển khai ingestion BCTC thật vào `financial_reports`, thay stub `fetch_financials()` còn lại sau Phase 14. Mốc 3 (release hardening: Playwright/security/Telegram/PDF) chưa bắt đầu.

Trong scope:

- Kết nối `vnstock.api.financial.Finance` cho BCTC quý từ nguồn VCI.
- Chuẩn hoá DataFrame tài chính kiểu `item_id + kỳ báo cáo` về schema TAD `financial_reports`.
- Upsert BCTC theo unique key `(ticker, period)`.
- `POST /api/refresh/all` ghi BCTC thật và có stats riêng cho `financials`.
- Cache `vnstock_financial` theo TAD g04: `FRESH` chỉ khi full universe thành công 100%, `PARTIAL` nếu có dữ liệu nhưng chưa đầy đủ.
- Không giữ DB session khi gọi vnstock external source.
- Test không network cho wrapper, upsert và refresh all.

Out of scope phase này:

- Chạy refresh thật full 81 mã ngoài sandbox.
- Thêm endpoint riêng `/refresh/financials`.
- Persist refresh history/ticker status sau process restart.

## 2. Pre-code audit / drift

| # | Drift / issue | Resolution |
|---|---|---|
| 1 | `fetch_financials()` vẫn là stub, trả `[]` | ✅ Thay bằng `vnstock.api.financial.Finance` |
| 2 | `financial_repo` chưa có bulk upsert | ✅ Thêm `bulk_upsert()` theo `(ticker, period)` |
| 3 | `run_refresh_all()` chỉ gọi financial stub và mark cache `STUB` | ✅ Upsert rows thật, stats riêng, cache `FRESH/PARTIAL` |
| 4 | BCTC vnstock trả shape không cố định | ✅ Parser hỗ trợ dạng item/period và dạng row/period, map alias về schema TAD |
| 5 | TAD g04 là source-level cache | ✅ Chỉ full-universe success 100% mới mark `vnstock_financial=FRESH` |
| 6 | TAD g07 cấm giữ DB transaction khi crawl external | ✅ External fetch nằm ngoài DB session; upsert dùng session ngắn |

## 3. Deliverables

| Path | Nội dung |
|---|---|
| [crawlers/vnstock_client.py](../../code/app/crawlers/vnstock_client.py) | `fetch_financials()` thật, parser BCTC quý, alias mapping sang fields TAD |
| [repositories/financial_repo.py](../../code/app/repositories/financial_repo.py) | `bulk_upsert()` theo `(ticker, period)` |
| [services/refresh_service.py](../../code/app/services/refresh_service.py) | `_FinancialRefreshStats`, upsert BCTC trong `/refresh/all`, cache financial `FRESH/PARTIAL` |
| [tests/unit/test_vnstock_client.py](../../code/tests/unit/test_vnstock_client.py) | Test mock Finance DataFrame và SystemExit boundary |
| [tests/integration/test_refresh.py](../../code/tests/integration/test_refresh.py) | Test refresh all upsert BCTC và mark financial cache `FRESH` |

## 4. Exit criteria

| Check | Result |
|---|---|
| `vnstock.api.financial.Finance` import/signature inspected | PASS |
| Targeted financial/refresh tests | PASS — `tests/unit/test_vnstock_client.py` + `tests/integration/test_refresh.py` |
| Ruff touched files | PASS |
| Full backend pytest | PASS — 256/256 |

## 5. Locked decisions

| Mục | Giá trị | Lý do |
|---|---|---|
| Financial source | `Finance(source="vci", period="quarter")` | Khớp nguồn VCI đang dùng cho prices và API local vnstock 4.0.2 |
| Refresh entrypoint | Chỉ nối vào `/refresh/all` | TAD g02 hiện có `/refresh/all` và `/refresh/prices`; không mở API mới khi chưa cần |
| Cache status | `FRESH` chỉ khi financial full universe thành công 100%; `PARTIAL` nếu có success nhưng còn failed/empty | Khớp TAD g04 source-level cache |
| DB boundary | External fetch ngoài DB session, upsert session ngắn | Khớp TAD g07 SQLite transaction rule |
| Parser strategy | Defensive alias mapping, không hardcode duy nhất một tên cột | vnstock VCI/KBS có thể trả nhiều biến thể schema |

## 6. Verification commands

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv run python -c "from vnstock.api.financial import Finance; import inspect; print(inspect.signature(Finance))"
uv run ruff check app/crawlers/vnstock_client.py app/repositories/financial_repo.py app/services/refresh_service.py tests/unit/test_vnstock_client.py tests/integration/test_refresh.py
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py
uv run pytest -q
```

## 7. Hand-off

Phase 15 đã bỏ stub BCTC trong code path refresh all. Bước tiếp theo nên là chạy production refresh thật theo subset nhỏ trong sandbox/default trước, chỉ xin chạy ngoài sandbox nếu cần network/quota/API key, rồi mới cân nhắc full 81 mã.
