# Phase 8 — Backtest + Export + Share + Telegram REVIEW

**Done:** ~2026-05-10 (~3h, estimate 1.5d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: mock heuristic acceptable trade-off, no progress column, WeasyPrint lazy import + auto-fallback, public route bypass auth, telegram envelope nghịch lý.

## Surprises / non-obvious

- **Backtest mock heuristic chứ KHÔNG strict per PRD §4.5**: SRS f12 AC-12-23 + cluster-5-summary chốt prototype heuristic (MUA: return>0; GIU: -7..+12; BAN: return<0). PRD §4.5 strict per-ticker VN-Index reference = post-MVP. Phase 8 follow heuristic — KHÔNG track per-ticker VN-Index. Document drift rõ trong service docstring.
- **Backtest universe = scored_count latest run (NOT 81)**: TAD g02 §8.6 explicit. `start_backtest()` requires `screening_repo.latest_completed(db)` non-None — ERR-12-03 nếu chưa có run.
- **No `progress_percent` column trong `backtest_runs`**: schema phase 1 không có. Phase 8 status response chỉ `{status, started_at, completed_at}`. Phase 9 FE downgrade percent bar → spinner. Trade-off acceptable cho 1.2s BG.
- **`time.sleep` trong BG task** (KHÔNG asyncio.sleep): `BackgroundTasks` chạy sync threadpool. 0.3s × 4 = 1.2s state machine PENDING → RUNNING → RUNNING → COMPLETED. FE polling 1.5s tick → 4-5 ticks smooth.
- **`target_price_3m` /1000 guard**: Phase 5 stores raw VND in DB. Backtest mock đọc → `if predicted_raw > 1000 else as-is`. Phòng trường hợp seed data đã là ngàn đồng.
- **PDF WeasyPrint lazy import + auto-fallback html_mock**: heavy import (Cairo/Pango bindings) — import inside function. WeasyPrint render fail (font missing, libpango error) → log warning + fall back to HTML mock. Frontend KHÔNG đổi (Content-Type stable cả 2 mode).
- **WeasyPrint Vietnamese font**: Phase 8 dùng `Inter, Helvetica, sans-serif`. Diacritics có thể render thay-thế-glyph trên Linux không có Inter. Phase 9+ Dockerfile cần `apt-get install fonts-noto-cjk fonts-noto-core` HOẶC embed `.ttf` trong `/app/fonts/`.
- **Share `url` field relative `/share/{token}`** — TAD c06 §4 production guidance. FE prepend `window.location.origin` runtime. Cluster 6 mock spec ghi `https://app.example/share/{token}` — Phase 8 deviate vì runtime mới biết origin. Document drift trong Phase 8 §2 #4.
- **Public route GET /share/{token}** bypass auth: endpoint KHÔNG có `CurrentUser` dep trong [api/share.py](../../code/app/api/share.py) `get_shared_view`. Other 3 endpoints (POST/GET-list/DELETE) require auth. Mixed per-route deps — pattern dễ miss khi đọc router code.
- **Telegram envelope `success: true` even khi `sent: false`**: TAD c07 §4 + g02 §9.4. App-level error trong `data.error`. HTTP 200 always (trừ 401 auth). Frontend handle qua `data.sent` flag, KHÔNG `success: false`. Nghịch lý ban đầu — nhưng đúng pattern: HTTP success ≠ business success.
- **Telegram creds priority settings > env var**: TAD c07 §1.1. `_resolve_credentials()` read settings table first; env var fallback chỉ khi settings empty. Test verify URL build with settings token.
- **Backtest job_lock collision**: Phase 5 screening dùng singleton `job_lock`. Phase 8 backtest cùng lock với `active_type='backtest'`. 2 backtest concurrent → 2nd FAIL. Acceptable per TAD g05 §1 "1 heavy job/time".

## Key decisions (why)

- **ROI curve length** `max(9, min(26, days // 7))`: TAD g02 §8.6 "9-26 weekly points".
- **ISO week label** `f"{iso_year}-W{iso_week:02d}"`: cluster-5-summary mock pattern. Cross-year edge case (ISO year ≠ calendar year ở cuối tháng 12) acceptable cho FE rendering.
- **Share TTL default 7 days**, range 1-365 via `expires_in_days`. Constant `SHARE_DEFAULT_EXPIRES_DAYS=7`.
- **Share expired check `expires_at <= now()` → 404 ERR-13-02**: TAD c06 §5.3 prototype check pattern.
- **DELETE response `{token, deleted: true}` 200+envelope**: match Phase 5/6/7 pattern + TAD §8.1.
- **`run_backtest` exception handler broad**: catch `Exception` rồi mark FAILED + release lock. KHÔNG re-raise (BG task không có caller listening). Document drift Phase 9+ logging review.

## To revisit

- **WeasyPrint Vietnamese fonts**: Phase 10+ Docker test. Nếu PDF diacritics broken → switch `EXPORT_PDF_MODE=html_mock` env var.
- **Backtest strict PRD §4.5**: per-ticker VN-Index reference = post-MVP wiring trong backtest_service.
- **Backtest progress percent**: thêm DB column `progress_percent` cho BacktestRun nếu UX cần. Trade-off vs simplicity.
- **`screening_data` fixture KHÔNG cleanup `BacktestRun/BacktestResult`**: residual rows accumulate qua test runs. Backtest tests dùng numeric id, không collide. Phase 9+ extend cleanup defensive.
- **Telegram auto-send post-run (UC-14-01)**: Phase 8 KHÔNG wire vào `screening_service.run_screening` Step 13. Manual /telegram/test only. Post-MVP.
- **Share `created_at` không emit trong GET /share/{token}**: FE Phase 9 SharedView dùng `expires_at` countdown only. Cluster 6 prototype show `created_at` cũng — backend không trả. Phase 9 SharedView omit.
