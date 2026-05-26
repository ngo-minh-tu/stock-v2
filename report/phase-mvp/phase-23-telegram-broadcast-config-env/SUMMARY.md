# Phase 23 — Telegram Run-Summary Broadcast + Config-Layer Pytest

**Ngày:** 2026-05-21
**Mục tiêu thực hiện:** đóng Track 2 Telegram completeness (PLAN.md §6.2) — wire `broadcast_run_summary()` vào `screening_service` finalize hook hoàn thiện SRS f14 UC-14-01 + TAD c07 §1; add config-layer pytest verify pydantic-settings multi-file precedence (Phase 22 §6 backlog). Sau Phase 23, mọi run COMPLETED đều push tin nhắn Top N MUA qua Telegram bot nếu user bật trong Settings.
**Trạng thái:** COMPLETED 2026-05-21

## 1. Việc đã làm

- **Telegram broadcast wiring** (TAD c07 §1 + SRS f14 UC-14-01):
  - Refactor `telegram_service` extract `_post_message(*, chat_id, token, text)` shared helper — single point of truth cho Bot API call + URL/token scrub (Phase 20 fix). Cả `send_test_message` + `broadcast_run_summary` đều gọi qua đó.
  - Thêm `broadcast_run_summary(db, run_id)` compose message theo f14 template:
    ```
    🔍 VN RE AI Screener — Run {YYYY-MM-DD HH:MM}

    📊 Kết quả: {buy} MUA | {hold} GIỮ | {sell} BÁN

    🏆 Top {N} MUA:
    1. {ticker} — Score {int} — ▲{upside}% — {signal}
    ...

    ⚠️ Cảnh báo: {warning_count} mã có risk flags

    ⚡ Xem chi tiết: {frontend_origin}
    ```
  - Distinct `skipped` flag để phân biệt:
    - `telegram_enabled=false` → `skipped=True`, silent (AC-14-01).
    - `enabled=true + creds rỗng` → `skipped=False, sent=False, error="Telegram chưa cấu hình…"` (surface as warning).
    - Run-not-found → `skipped=True` (defensive, không expect xảy ra trong production).
- **Screening finalize hook reorder** (`screening_service.run_screening`):
  - Sequence mới: `bulk_insert(results) → broadcast_run_summary() → warnings_json + mark_completed`.
  - Lý do reorder: top-N message format đọc từ `screening_results` (cần persisted) → outcome `telegram_error` feed vào `warnings_json` để FE thấy `TELEGRAM_FAILED` badge + final status `COMPLETED_WITH_WARNINGS`.
  - Thêm `_finalize_telegram_broadcast(run_id)` wrapper: open SessionLocal riêng (boundary I/O), last-resort try/except — Telegram NEVER blocks run finalize.
- **Persist outcome** vào `screening_runs.telegram_sent` + `telegram_error`:
  - Thêm `screening_repo.update_telegram_status(db, run_id, *, sent, error)` — caller commit, KHÔNG self-commit.
  - Cột đã tồn tại từ Phase 5 (TAD g03 Table 5) nhưng chưa ai write trước Phase 23.
- **Config-layer pytest** (`tests/unit/test_config_env_chain.py`):
  - 10 test verify `SettingsConfigDict(env_file=(".env", ".env.telegram"))` chain — later file overrides earlier.
  - Verify `os.environ` cao nhất precedence (secret manager / `--env-file` injection beats files).
  - Verify `get_settings()` `@lru_cache` semantics — same instance đến `cache_clear()`; mutation invisible without clear.
  - Verify `extra='ignore'` (unknown keys không raise).
  - Regression guard nếu `env_file` revert thành single string.
  - Tests isolated qua `tmp_path` + `monkeypatch.chdir` — KHÔNG touch dev's real `.env`/`.env.telegram`.
- **Real verify**: 9 unit + 3 integration test cover all 5 outcome paths (skipped × 2, misconfig, success, failure → TELEGRAM_FAILED + COMPLETED_WITH_WARNINGS). Token KHÔNG leak trong error message (URL scrub verified ở `_post_message`).

## 2. File đã thêm

- `mvp/phases/phase-23-telegram-broadcast-config-env/SUMMARY.md` — audit trail 8-section.
- `mvp/phases/phase-23-telegram-broadcast-config-env/REVIEW.md` — self-critical review.
- `mvp/code/tests/unit/test_telegram_broadcast.py` — 9 unit test cho `broadcast_run_summary` + `_post_message` scrub.
- `mvp/code/tests/unit/test_config_env_chain.py` — 10 unit test cho `Settings` env chain + `lru_cache`.
- `mvp/code/tests/integration/test_run_telegram_broadcast.py` — 3 integration test wiring (disabled-skip, enabled-success, enabled-failure).
- `report/phase-mvp/phase-23-telegram-broadcast-config-env/SUMMARY.md` — file này.

## 3. File đã sửa

- `mvp/code/app/services/telegram_service.py` — thêm `_post_message` shared helper + `broadcast_run_summary` + `_build_run_summary_message` + `_count_warnings`.
- `mvp/code/app/services/screening_service.py` — reorder finalize hook, gọi `_finalize_telegram_broadcast` giữa bulk_insert và mark_completed.
- `mvp/code/app/repositories/screening_repo.py` — thêm `update_telegram_status(db, run_id, *, sent, error)`.
- `plan/PLAN.md` — phase 23 row, Status (Phase 0-23 / 288 tests), §6.2 mark Telegram completeness done, §7 next-steps re-numbered.
- `README.md` + `mvp/README.md` — phase ledger + status + intentional-defers.

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Targeted regression Phase 23
uv run pytest tests/unit/test_telegram_broadcast.py tests/unit/test_config_env_chain.py tests/integration/test_run_telegram_broadcast.py -v
# 22 passed (9 unit broadcast + 10 unit config + 3 integration)

# Full BE regression
uv run pytest -q
# 288/288 passed (266 cũ + 22 mới)

# Lint
uv run ruff check app tests
# All checks passed
```

## 5. Kết quả

- **Test:**
  - Targeted Phase 23: 22/22 pass.
  - Full backend: 288/288 pass (266 cũ + 22 mới).
  - Ruff: All checks passed.
- **Broadcast outcome paths (verified end-to-end qua integration test):**
  | Trạng thái | telegram_sent | telegram_error | warnings_json | final status |
  |---|---|---|---|---|
  | `telegram_enabled=false` | False | None | KHÔNG chứa TELEGRAM_FAILED | COMPLETED |
  | enabled=true + Bot API ok | True | None | KHÔNG chứa TELEGRAM_FAILED | COMPLETED |
  | enabled=true + Bot API 401/timeout | False | "Unauthorized" / "Telegram API timeout" | chứa TELEGRAM_FAILED | COMPLETED_WITH_WARNINGS |
- **Acceptance Criteria SRS f14:**
  - ✅ AC-14-01: `telegram_enabled=false` → không gửi, không lỗi (integration test verify httpx.post never called).
  - ✅ AC-14-02: Bot API ok → `telegram_sent=true`, message text khớp f14 template (header + counts + Top + warnings + URL).
  - ✅ AC-14-03: API lỗi → `telegram_sent=false`, `telegram_error` populated, run vẫn terminal (KHÔNG fail).
  - ✅ AC-14-04: `top_n` từ Settings (3 hoặc 5) — verify qua unit test.
- **Config chain verify** (`get_settings()` thực sự load đúng layered):
  ```
  .env: TELEGRAM_BOT_TOKEN=base
  .env.telegram: TELEGRAM_BOT_TOKEN=secret_layer
  → Settings().telegram_bot_token == "secret_layer" ✓
  ```
- **URL/Token scrub** verified:
  - `httpx.TimeoutException` → error="Telegram API timeout" (no URL).
  - `httpx.HTTPError` với URL chứa SECRET_TOKEN → error chỉ chứa class name "FakeHTTPError", không có token.

## 6. Tồn đọng

- **Production run rerun để verify end-to-end với real bot**: Phase 23 wiring chỉ trigger khi user POST /api/run mới. Existing runs trên prod-screener.db KHÔNG có telegram_sent updated. Operator chạy 1 manual run sau khi prod DB refresh (Phase 25 §25.3) để verify Telegram nhận message thật.
- **Settings UI toggle bật/tắt broadcast** chưa có — Phase 28 (optional, sau khi trader feedback).
- **Backtest broadcast** không wire (TAD c07 §1 nói "manual run only") — giữ nguyên.
- **FAILED run không broadcast** — chỉ COMPLETED branch gọi finalize hook. Đúng theo spec.
- **HoldingFormModal TODAY hard-code** (Phase 19 REVIEW Low) — chưa fix. Carry sang Phase 25 UX polish.
- **FE Next 16 critical upgrade** — chưa làm. Đây là **BLOCKING ngrok hand-off**, sẽ là Phase 24 ngay sau Phase 23.
- **`telegram_top_n` validation** đã có ở settings_service (ERR-15-03 enum {3, 5}), broadcast không re-validate — acceptable risk (admin chỉ có 1 user MVP).
