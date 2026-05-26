# Phase 14 — Production Data Hardening

**Status:** COMPLETED 2026-05-19  
**Spec ref:** Mốc 2 từ production hardening roadmap; Phase 12 hand-off [SUMMARY.md §6](../phase-12-production-data-qa/SUMMARY.md).  
**Report:** [report/phase-mvp/phase-14-production-data-hardening/SUMMARY.md](../../../report/phase-mvp/phase-14-production-data-hardening/SUMMARY.md)

> Cập nhật 2026-05-19: tồn đọng BCTC thật trong hand-off phase này đã được xử lý ở [Phase 15 — Financial Data Ingestion](../phase-15-financial-ingestion/SUMMARY.md).

## 1. Scope

Bắt đầu harden ingestion path cho dữ liệu production, tập trung trước vào price refresh.

Trong scope:

- Price refresh giữ partial success rows.
- Refresh status có thống kê định lượng.
- Resume lại ticker lỗi/rỗng gần nhất.
- Refresh subset tickers.
- Migrate price client khỏi API vnstock cũ.
- Tuân thủ TAD source-level cache: subset/resume không được làm cache giá thành `FRESH`.
- Tuân thủ SQLite transaction rule: không giữ DB transaction khi gọi external crawler.

Out of scope phase này:

- BCTC thật.
- Full 81-ticker refresh thật.
- Playwright smoke.
- Production deploy.

## 2. Pre-code audit / drift

| # | Drift / issue | Resolution |
|---|---|---|
| 1 | `run_refresh_prices()` commit cuối job; nếu job crash giữa chừng có thể mất rows đã fetch | ✅ Commit sau từng ticker thành công |
| 2 | Refresh status chỉ có message text, không có success/fail/empty stats | ✅ Thêm `stats` vào job metadata và API response |
| 3 | Không có cơ chế retry nhóm ticker lỗi | ✅ Thêm `resume_failed` dựa trên failed/empty tickers gần nhất |
| 4 | `VnstockClient.fetch_prices()` dùng API cũ `Vnstock().stock(...)` | ✅ Chuyển sang `vnstock.api.quote.Quote` |
| 5 | TAD g04 chốt cache MVP là source-level, không phải ticker-level; subset/resume không thể đại diện toàn bộ `VNSTOCK_PRICES` | ✅ Thêm `full_universe`; chỉ full-universe success 100% mới mark cache `FRESH`, còn partial/subset/resume mark `PARTIAL` |
| 6 | TAD g07 chốt không giữ DB transaction khi crawl external source | ✅ Tách read ticker list, external fetch và DB upsert thành các session ngắn cho cả `/refresh/prices` và `/refresh/all` |

## 3. Deliverables

| Path | Nội dung |
|---|---|
| [job_lock.py](../../code/app/job_lock.py) | Job registry thêm `stats` |
| [api/refresh.py](../../code/app/api/refresh.py) | `POST /refresh/prices` nhận body tùy chọn; status trả `stats` |
| [schemas/refresh.py](../../code/app/schemas/refresh.py) | Thêm `RefreshPricesRequest`; status schema thêm `stats` |
| [services/refresh_service.py](../../code/app/services/refresh_service.py) | Partial commit, stats, resume failed/empty tickers, `full_universe`, cache `PARTIAL/FRESH`, session ngắn khi DB read/write |
| [crawlers/vnstock_client.py](../../code/app/crawlers/vnstock_client.py) | Dùng `vnstock.api.quote.Quote` |
| [tests/integration/test_refresh.py](../../code/tests/integration/test_refresh.py) | Test partial stats, resume, cache `PARTIAL/FRESH` |
| [tests/unit/test_vnstock_client.py](../../code/tests/unit/test_vnstock_client.py) | Mock import path mới `vnstock.api.quote` |

## 4. Exit criteria

| Check | Result |
|---|---|
| `Quote.history` import/signature inspected | PASS |
| Targeted refresh/cache/vnstock/job_lock tests | PASS — 37/37 |
| Ruff | PASS |
| Full backend pytest | PASS — 253/253 |
| Frontend build | PASS — 15 app pages |

## 5. Locked decisions

| Mục | Giá trị | Lý do |
|---|---|---|
| Partial success status | `COMPLETED` + `stats.failed/empty` | Giữ enum refresh cũ, tránh FE break |
| Retry scope | last failed + empty tickers in memory | Không thêm DB migration trong bước đầu Mốc 2 |
| Cache status | `FRESH` chỉ khi refresh toàn bộ universe thành công 100%; `PARTIAL` cho partial/subset/resume có rows thành công | Khớp TAD g04 source-level cache và giữ `cache_manager.is_usable()` đúng cho screening |
| Subset refresh | `tickers` body optional, luôn `full_universe=false` | Hỗ trợ QA từng nhóm nhỏ trước full 81 ticker mà không giả lập source cache là fresh |
| vnstock source | `DataSource.VCI` | Giữ tương đương source cũ `"VCI"` |
| DB session boundary | Không giữ session quanh `client.fetch_prices()` | Khớp TAD g07 transaction rule |

## 6. Verification commands

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv run python -c "from vnstock.api.quote import Quote; import inspect; print(inspect.signature(Quote.history))"
uv run pytest tests/unit/test_vnstock_client.py tests/unit/test_job_lock.py tests/integration/test_refresh.py -q
uv run pytest tests/integration/test_refresh.py tests/unit/test_cache_manager.py tests/unit/test_vnstock_client.py tests/unit/test_job_lock.py -q
uv run ruff check app/ tests/
uv run pytest -q
uv run pytest --collect-only -q
cd /Users/ngominhtu/Projects/stock-v2/frontend
npm run build
```

## 7. Hand-off

Phase 14 đã đóng phần code hardening đầu tiên của Mốc 2. Tồn đọng thay `fetch_financials()` stub đã chuyển sang Phase 15 và hoàn tất. Tồn đọng còn lại là chạy refresh thật theo subset hoặc full 81 ticker với quota/API key rõ ràng.
