# Phase 8 — Backtest + Export + Share + Telegram

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** wire 10 endpoint cho 4 surface integration — Backtest (4) + Export PDF (1) + Share Link (4) + Telegram test (1); chốt mock heuristic + dual-mode PDF + public share route + httpx Bot API.
**Trạng thái:** COMPLETED 2026-05-10

## 1. Việc đã làm

- Pre-code drift audit 10 mục:
  - Backtest heuristic (SRS f12 AC-12-23) — MUA: return>0, GIU: -7..+12, BAN: return<0. PRD §4.5 strict post-MVP.
  - `total_count = scored_count latest run` (TAD g02 §8.6) — `start_backtest()` require `latest_completed()` non-None; ERR-12-03 nếu chưa có.
  - `backtest_runs` schema không có `progress_percent` → status response chỉ `{status, started_at, completed_at}`.
  - Share URL store relative `/share/{token}` (TAD c06 §4) — FE prepend `origin` runtime.
  - PDF dual-mode `weasyprint` (default) + `html_mock` fallback; WeasyPrint lazy import; auto-fallback on render error.
  - PDF font stack `Inter, Helvetica, sans-serif` — Docker font review post-Phase 9.
  - Telegram credentials priority settings table > env var (TAD c07 §1.1).
  - Telegram error envelope `{success: true, data: {sent, error}}` — `success: true` always.
  - Share `GET /{token}` PUBLIC route — KHÔNG có `CurrentUser` dep.
  - Backtest job_lock collision: cùng singleton với screening, `active_type='backtest'`.
- Backtest 4 endpoints (`/api/backtest`):
  - POST `/` 202 `{backtest_id, status: PENDING}` — BG state machine PENDING → RUNNING → RUNNING → COMPLETED|FAILED, 0.3s × 4 = 1.2s total.
  - GET `/{id}/status` polling 1.5s (TAD g02 §8.5).
  - GET `/{id}` BacktestMetrics (accuracy, price_error, ROI, alpha, roi_curve 9-26 weekly ISO label `{iso_year}-W{iso_week:02d}`).
  - GET `/{id}/results` per-ticker sort `price_error_pct DESC`.
- Export 1 endpoint `GET /api/export/pdf/{run_id}` — `Content-Type: application/pdf` + `Content-Disposition: attachment; filename="run-{id}.pdf"`. Template Vietnamese (Cover + Tổng quan + Top 10 MUA + Red Flags 20 + Disclaimer + Footer).
- Share 4 endpoints:
  - POST `/api/share` 201 `{token, run_id, url, created_at, expires_at}` (uuid v4 + 7-day TTL default, range 1-365).
  - GET `/api/share` list active non-expired sort newest.
  - GET `/api/share/{token}` **PUBLIC no-auth** — SharedViewResponse `{summary, dashboard, top_mua}`; 404 invalid/expired ERR-13-02.
  - DELETE `/api/share/{token}` 200+envelope `{token, deleted: true}`.
- Telegram 1 endpoint `POST /api/telegram/test` — real httpx Bot API, timeout 5s, map errors sang `{sent: false, error: ...}`.
- 5 repository/schema/service mới + 4 router.
- 4 file integration test, +34 cases: 13 backtest + 5 export + 10 share + 6 telegram.
- Constants thêm: `BACKTEST_HOLD_RETURN_MIN=-7.0`, `BACKTEST_HOLD_RETURN_MAX=12.0`, `BACKTEST_MOCK_STEP_DELAY_S=0.3`, `SHARE_DEFAULT_EXPIRES_DAYS=7`.

## 2. File đã thêm

- `mvp/code/app/repositories/backtest_repo.py`, `share_repo.py`
- `mvp/code/app/schemas/backtest.py`, `share.py`, `telegram.py`
- `mvp/code/app/services/backtest_service.py`, `export_service.py`, `share_service.py`, `telegram_service.py`
- `mvp/code/app/api/backtest.py`, `export.py`, `share.py`, `telegram.py`
- `mvp/code/tests/integration/test_backtest.py`, `test_export.py`, `test_share.py`, `test_telegram.py`

## 3. File đã sửa

- `mvp/code/app/api/__init__.py` — register 4 router (backtest, export, share, telegram).
- `mvp/code/app/constants/error_codes.py` — thêm ERR-12-02/03, ERR-13-01/02, ERR-14-01/02.
- `mvp/code/app/constants/thresholds.py` — thêm 5 backtest + share constants.

## 4. Lệnh đã chạy

```bash
cd mvp/code
uv run pytest tests/integration/test_backtest.py tests/integration/test_export.py \
  tests/integration/test_share.py tests/integration/test_telegram.py -v   # 34 pass
uv run pytest                                          # 232/232
uv run ruff check app tests                            # clean

# Smoke (xem SUMMARY.md gốc cho full flow)
uv run uvicorn app.main:app --port 8014 &
TOKEN=$(curl -sS -X POST http://127.0.0.1:8014/api/auth/login ... )
curl -sS -X POST http://127.0.0.1:8014/api/backtest -H "Authorization: Bearer $TOKEN" \
  -d '{"period_from":"2026-02-01","period_to":"2026-04-01"}'
curl -sS -X POST http://127.0.0.1:8014/api/telegram/test -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8014/api/share/badtoken  # PUBLIC → 404 ERR-13-02
```

## 5. Kết quả

- Pytest: PASS — 232/232 (Phase 0-7: 198, Phase 8 mới: 34). Full suite ~484s ≈ 8 phút (mỗi backtest test có BG `time.sleep(0.6s) × 2`).
- Ruff: PASS.
- 10 endpoints cover SRS f12 UC-12-03 + f13 UC-13-01..03 + f14 UC-14-02. AC-12-17/18/19/20/21/23 + AC-13-01/02/03/08/09/10/11/12/15 verified.
- Smoke verified: POST `/telegram/test` no creds → 200 envelope `{sent: false, error: 'Telegram chưa cấu hình...'}`. POST `/backtest` no baseline → 400 ERR-12-03. GET `/share/badtoken` PUBLIC → 404 ERR-13-02. GET `/export/pdf/unknown_run` → 404 ERR-NOT-FOUND.

## 6. Tồn đọng

- **Pre-existing DB pollution (carryover):** chạy full pytest lần đầu có thể `IntegrityError`. Workaround manual cleanup.
- **Full suite 484s ≈ 8 phút** — backtest BG sleep + 16K row fixture. Phase 9+ cân nhắc parallel test execution.
- **ISO week label cross-year edge case** (ISO year ≠ calendar year cuối tháng 12) — acceptable cho FE render.
- **WeasyPrint Vietnamese fonts không embed Dockerfile** — production deploy cần `apt-get install fonts-noto-cjk fonts-noto-core` hoặc embed `.ttf` `/app/fonts/`. Phase 9+ Dockerfile review TODO.
- **WeasyPrint warnings macOS** Cairo/Pango — acceptable dev; production Docker Linux OK.
- **Mock heuristic accuracy variance:** `random.Random(seed=backtest_id)` deterministic per backtest_id; test verify shape thay vì exact values.
- **`run_backtest` exception broad catch + KHÔNG re-raise** (BG task không caller listening) — Phase 9+ logging review.
- **`screening_data` fixture KHÔNG cleanup `BacktestRun/Result`** — residual rows accumulate; backtest tests dùng numeric id không collide.
- **PDF Vietnamese diacritics rendering production unverified** — switch `EXPORT_PDF_MODE=html_mock` nếu broken.
- **Backtest strict PRD §4.5** per-ticker VN-Index reference = post-MVP.
- **Backtest progress percent column** — thêm DB column nếu UX cần.
- **Telegram auto-send post-run (UC-14-01)** — Phase 8 KHÔNG wire `screening_service` Step 13. Post-MVP.

### Post-phase fix 2026-05-16 — Backtest `terminal_status` pattern

- Bug: `run_backtest()` hard-code `job_lock.release(job_key, status="COMPLETED")` trong `finally`. Hai nhánh early-return (`scored` rỗng + `row is None`) mark DB FAILED nhưng finally vẫn release lock COMPLETED → state mismatch giữa DB và job_lock.
- Fix: refactor sang `terminal_status: str = "COMPLETED"` + `error_msg: str | None` mutable. Mỗi nhánh fail set 2 biến này trước `return`; finally release một lần với giá trị đúng. Loại bỏ duplicate release.
- Tests: thêm 3 case (409 khi lock held, lock FAILED khi không scored rows, lock FAILED khi exception).
- Files: `backtest_service.py` +12 / -7 LOC; `test_backtest.py` +110 LOC.
