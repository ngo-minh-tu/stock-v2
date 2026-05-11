# Phase 3 — Refresh Layer REVIEW

**Done:** ~2026-05-10 (~4h, estimate 1.5d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: concurrency model (threading not asyncio), RunStatus 7-state refactor, cache source-level (NOT ticker-level).

## Surprises / non-obvious

- **`threading.Lock` thay `asyncio.Lock`**: FastAPI `BackgroundTasks` chạy sync function trên threadpool, KHÔNG event loop async. Lock kiểu asyncio sẽ KHÔNG bảo vệ giữa các BG tasks. Phase 3 → `threading.Lock` + `JobLock` class với `try_acquire()`. Decision này lock cho Phase 5 screening + Phase 8 backtest dùng cùng singleton.
- **JobLock singleton import pattern**: `from app.job_lock import job_lock`. Tests phải `job_lock.reset()` trong fixture autouse hoặc fail không deterministic. `screening_data` fixture đã wire.
- **In-memory job registry mất khi restart**: TAD g01 §1 chấp nhận trade-off MVP single-instance. Khởi động backend mark mọi PROCESSING > X phút thành FAILED `run_error="Server restart"` — pattern documented nhưng **NOT implemented Phase 3**. Phase 10 audit nếu cần.
- **vnstock rate limit 0.5s**: client sleep giữa requests. 81 mã × 2 data type (price+financial) = 162 calls × 0.5s = 81s sequential. Sequential pattern OK vì user run manual mỗi 1-2 tuần — không cần parallel optimization.
- **Cache source-level (NOT ticker-level)**: TAD g04 §1. `cache_metadata` table key = `data_type` only. `is_fresh(source)` đọc `last_refreshed_at`. Refresh all stocks hoặc none — quyết định per `data_type`, không per ticker. Đơn giản hơn cluster prototype suy nghĩ ban đầu.
- **TTL khác nhau lớn**: `financial=720h (30 ngày)` vì BCTC quý đăng 1 lần. `news=6h` fresh enough. Phase 1 đã đoán 24h cho tất cả — sai. Đọc TAD g04 mới biết.

## Key decisions (why)

- **`mark_completed` set progress=100 atomic**: trước đây mình tính progress=99 khi terminal → FE thấy stuck 99%. Fix: terminal mark always 100%.
- **RunStatus 7-state state machine refactor**: phase 3 đầu dùng `RUNNING/PROCESSING/PARTIAL/CANCELLED` linh tinh. Đọc TAD g01 §2.1 mới biết 7 canonical: `PENDING/CHECKING_DATA/SCREENING/SCORING/COMPLETED/COMPLETED_WITH_WARNINGS/FAILED`. Refactor toàn bộ refresh + screening.
- **`live duration_seconds` cho active runs**: GET /runs/{id}/status compute `now - run_at` khi non-terminal, dùng stored `duration_seconds` khi terminal. FE polling thấy timer tăng.

## To revisit

- vnstock real API có thể fail unpredictable — test với mock client (`_NoopClient`) cover happy path only. Phase 10 cần manual smoke với vnstock thực.
- Macro crawler stub: hardcoded constants. Production cần SBV + GSO scraper post-MVP.
- Server restart ghost jobs: pattern documented nhưng chưa code. Single-instance hiện không gặp nhưng prod multi-instance sẽ cần.
