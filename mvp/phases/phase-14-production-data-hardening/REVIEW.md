# Phase 14 — Production Data Hardening REVIEW

**Started:** 2026-05-18  
**Completed:** 2026-05-19  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

> Cập nhật 2026-05-19: mục "Thay `fetch_financials()` stub bằng ingestion BCTC thật" đã hoàn tất ở [Phase 15](../phase-15-financial-ingestion/SUMMARY.md).

Retrospective focus: Phase 14 bắt đầu Mốc 2 bằng phần ít rủi ro nhất: làm refresh observable và retryable trước khi chạy full production data thật.

## Surprises / non-obvious

- **vnstock 4.0.2 đã có `vnstock.api.quote.Quote`**: có thể migrate khỏi API cũ mà chưa cần upgrade package ngay.
- **`Quote.history` vẫn có thể raise `SystemExit` qua thư viện ngoài**: wrapper vẫn giữ boundary `except (Exception, SystemExit)` để bảo vệ background job.
- **Partial success không nên đổi enum ngay**: thêm `COMPLETED_WITH_WARNINGS` cho refresh có thể kéo theo FE/schema churn. Phase này giữ `COMPLETED` và expose chi tiết qua `stats`.
- **Resume in-memory là đủ cho bước đầu**: refresh job registry hiện cũng in-memory. Persist refresh job/ticker status sẽ là phase lớn hơn nếu cần chạy production lâu dài.
- **Source-level cache làm thay đổi ý nghĩa subset/resume**: subset hoặc resume có thể thành công 100% trong phạm vi nhỏ, nhưng vẫn không đại diện cho toàn bộ `VNSTOCK_PRICES`; vì vậy cache phải là `PARTIAL`, không phải `FRESH`.
- **DB session boundary quan trọng hơn commit từng ticker**: commit từng ticker giữ partial rows, nhưng nếu vẫn giữ session trong lúc gọi vnstock thì vi phạm TAD g07 và tăng rủi ro SQLite lock. Phase này tách external fetch khỏi DB session.
- **Full test count tăng lên**: Phase 14 thêm integration tests cho partial stats, resume và cache source-level.

## Key decisions

- Commit từng ticker thành công để giữ dữ liệu nếu các ticker sau fail.
- `stats.failed_tickers` và `stats.empty_tickers` là nguồn cho `resume_failed`.
- `stats.full_universe` phân biệt full refresh với subset/resume.
- `tickers` body optional cho phép QA subset như `["VHM","VIC"]`, nhưng subset luôn mark cache `PARTIAL`.
- Cache `vnstock_price` chỉ mark `FRESH` khi full-universe refresh thành công toàn bộ, không failed, không empty.
- Dùng `DataSource.VCI` để giữ cùng source với code cũ.

## To revisit

- Persist refresh job/ticker status nếu cần resume sau process restart.
- Thêm table riêng cho refresh history nếu production refresh mất nhiều phút.
- Chạy subset refresh thật trước khi full 81 ticker.
- Chạy subset production thật sau Phase 15 để xác nhận BCTC live trên 1-3 mã.
