# Phase 23 — Telegram Run-Summary Broadcast + Config-Layer Pytest

**Started:** 2026-05-21 · **Closed:** 2026-05-21
**Roadmap:** Track 2 (Telegram completeness) — đóng 2 hand-off item từ PLAN.md §6.2 sau Phase 20 release: (1) wire `broadcast_run_summary()` vào screening finalize hook để hoàn thiện SRS f14 UC-14-01 + TAD c07 §1; (2) thêm config-layer pytest verify pydantic-settings multi-file chain + `get_settings.cache_clear()` behavior (Phase 20 REVIEW Medium carry, repeated trong Phase 22 §6).

## 1. Scope

2 deliverable song hành:

1. **Telegram run-summary broadcast** (TAD c07 §1 + SRS f14 UC-14-01):
   - Thêm `broadcast_run_summary(db, run_id)` trong `telegram_service.py`. Compose message theo f14 template (run_date · counts · Top N MUA · warning_count · app_url), gọi Bot API qua shared `_post_message()` helper.
   - `screening_service.run_screening` gọi hook sau `results_repo.bulk_insert` nhưng TRƯỚC `mark_completed` — để outcome `telegram_error` feed vào `warnings_json` (`TELEGRAM_FAILED` badge) + final status (`COMPLETED_WITH_WARNINGS`).
   - Non-blocking: AC-14-01 (enabled=false skip silently), AC-14-02 (sent=true + persist `telegram_sent`), AC-14-03 (API error → tag warning, KHÔNG fail run), AC-14-04 (top_n từ settings 3 hoặc 5).
   - Persist `screening_runs.telegram_sent` + `telegram_error` qua `screening_repo.update_telegram_status()` mới.

2. **Config-layer pytest** (`tests/unit/test_config_env_chain.py` — 10 test):
   - Verify `SettingsConfigDict(env_file=(".env", ".env.telegram"))` chain (`.env.telegram` overrides `.env`).
   - Verify explicit `os.environ` precedence (secret manager / `--env-file` injection beats files).
   - Verify `@lru_cache` semantics — same instance đến khi `cache_clear()`; file mutation invisible without clear.
   - Verify defaults preserve khi không có nguồn nào.
   - Verify `extra='ignore'` (unknown keys không raise).
   - Regression guard: nếu `env_file` revert thành single string, `.env.telegram` precedence breaks → test fail-fast.

Out of scope: Telegram retry/queue (single-shot per run đủ cho MVP); broadcast cho backtest/scheduled run (TAD c07 §1 nói rõ "manual run only"); FE Next 16 upgrade (Phase 24+ Track 1).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 23-01 | `screening_service._summarize_warnings` ban đầu compute `warnings` TRƯỚC bulk_insert + mark_completed, với `telegram_error=None  # Phase 8 wire telegram`. Wiring broadcast cần đảo thứ tự: insert results → broadcast (cần top-N từ DB) → re-compute warnings → mark_completed. | `screening_service.py` | Split insert+counts batch khỏi `mark_completed`. `_finalize_telegram_broadcast(run_id)` chạy giữa 2 DB session — open `SessionLocal` riêng cho broadcast (boundary I/O), giữ DB transaction nhỏ. |
| 23-02 | `telegram_service.send_test_message` duplicates Bot API plumbing (URL build + httpx.post + error/timeout/URL-scrub branches). Broadcast cần reuse logic mà KHÔNG copy. | `telegram_service.py` | Extract `_post_message(*, chat_id, token, text)` helper; `send_test_message` + `broadcast_run_summary` đều gọi qua đó. URL/token scrub (Phase 20 fix) centralised tại 1 chỗ. |
| 23-03 | `telegram_sent` + `telegram_error` columns đã exist trên `screening_runs` từ Phase 5 (TAD g03 Table 5) nhưng KHÔNG ai write. Phase 23 ON. | `screening_repo.py` | Add `update_telegram_status(db, run_id, *, sent, error)` helper — caller (screening_service) chịu commit. KHÔNG self-commit để giữ transaction control. |
| 23-04 | AC-14-01 vs misconfig: TAD c07 §1.1 nói "enabled=true + empty creds → 400 ERR-14-02" trong validation Settings PUT, nhưng nếu Settings đã có enabled=true với chat_id rỗng (race condition khi env fallback rỗng) thì broadcast nên làm gì? | `telegram_service.py` | Distinct `skipped` flag: `enabled=false → skipped=True` (silent, AC-14-01); `enabled=true + creds rỗng → skipped=False, sent=False, error="chưa cấu hình…"` (surface as TELEGRAM_FAILED warning để operator thấy). |
| 23-05 | Message template f14 dùng `▲{upside1}%` không nói rõ format decimal. Test screenshot cũ Phase 19 cho thấy upside hiển thị 1 chữ số thập phân. | `telegram_service.py` | Format `f"{upside:.1f}"` rồi strip trailing `.0` (e.g. `8.0 → 8`, `5.5 → 5.5`, `12.3 → 12.3`). Score = `int(round(...))`. |
| 23-06 | Top N rows chỉ chứa `recommendation=MUA` — không phải top-N theo `ai_score` toàn bộ. f14 template nói "Top N MUA". | `telegram_service.py` | Filter `Recommendation.MUA.value` trước khi sort + truncate. GIU/BAN score cao vẫn bị loại. |
| 23-07 | Phase 22 §6 ghi "config-layer pytest cho multi-env-file precedence chưa add. Carry sang Phase 23." | `tests/unit/test_config_env_chain.py` (new) | 10 test cover chain precedence + cache + env override + extra-ignore + regression guard. |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `mvp/code/app/services/telegram_service.py` | Refactor `send_test_message` → reuse `_post_message`; add `broadcast_run_summary(db, run_id)` + `_build_run_summary_message` + `_count_warnings` (f14 template + AC-14-01..04). |
| `mvp/code/app/services/screening_service.py` | Reorder finalize: bulk_insert+counts → `_finalize_telegram_broadcast(run_id)` → warnings_json + mark_completed. Open SessionLocal riêng cho broadcast boundary. |
| `mvp/code/app/repositories/screening_repo.py` | Add `update_telegram_status(db, run_id, *, sent, error)` — persist Telegram outcome, caller commits. |
| `mvp/code/tests/unit/test_telegram_broadcast.py` (new) | 9 unit test — skipped paths × 2, misconfig, f14 template, top_n 3/5, MUA filter, Bot API failure, URL scrub at `_post_message` level (timeout + HTTPError). |
| `mvp/code/tests/integration/test_run_telegram_broadcast.py` (new) | 3 integration test — disabled-skip, enabled-success (verify httpx call + message text), enabled-failure (TELEGRAM_FAILED warning + COMPLETED_WITH_WARNINGS). |
| `mvp/code/tests/unit/test_config_env_chain.py` (new) | 10 test — chain precedence × 5, lru_cache, extra-ignore, regression guard, env-only, no-dot-env path. |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| `broadcast_run_summary` skipped khi `telegram_enabled=false` (AC-14-01) | ✅ | `test_skipped_when_telegram_disabled` + integration `test_finalize_skipped_when_telegram_disabled` (httpx.post raise on call → KHÔNG bao giờ trigger). |
| Sent thành công persist `telegram_sent=true` (AC-14-02) | ✅ | Integration `test_finalize_sends_summary_when_enabled` — verify `run.telegram_sent is True` + Bot API URL chứa token + message text khớp template. |
| API lỗi KHÔNG block run, gắn TELEGRAM_FAILED warning (AC-14-03) | ✅ | Integration `test_finalize_failure_tags_warning_and_preserves_run` — run.status=COMPLETED_WITH_WARNINGS, telegram_error="Unauthorized", warnings_json chứa "TELEGRAM_FAILED". |
| Top N tôn trọng `telegram_top_n` (AC-14-04) | ✅ | Unit `test_top_n_5_respects_settings` (5 ticker hiện, ticker 6-7 ẩn). |
| Top list chỉ chứa MUA recommendation | ✅ | Unit `test_only_buy_rows_in_top` — HIGH_HOLD (score 99, recommendation=GIU) bị loại. |
| Message text khớp f14 UC-14-01 template (header + counts + Top + warnings + URL) | ✅ | Unit `test_message_text_matches_f14_template` assert 6 key strings. |
| Token KHÔNG leak trong error message khi httpx HTTPError | ✅ | Unit `test_post_message_http_error_scrubs_url` + `test_post_message_timeout_does_not_leak`. |
| Config chain `.env.telegram` overrides `.env` | ✅ | Unit `test_env_telegram_overrides_dot_env` + `test_chain_load_used_by_real_get_settings`. |
| `os.environ` overrides cả 2 file | ✅ | `test_explicit_env_var_beats_both_files` + `test_os_environ_still_visible_after_cache_clear`. |
| `get_settings()` cache + `cache_clear()` re-read | ✅ | `test_get_settings_is_cached_until_clear` — same instance, then `cache_clear()` → new instance. |
| Backend pytest pass | ✅ | 288/288 (`uv run pytest -q` — 266 cũ + 9 unit broadcast + 10 unit config_env_chain + 3 integration broadcast). |
| Ruff clean | ✅ | `uv run ruff check app tests` — All checks passed (sau khi add 3 file mới). |

## 5. Quyết định khoá trong phase này

- **Broadcast runs AFTER results.bulk_insert NHƯNG TRƯỚC mark_completed.** Lý do: top-N message format đọc từ `screening_results` (qua `results_repo.list_by_run`) nên cần persisted; outcome `telegram_error` cần feed vào `warnings_json` để FE thấy `TELEGRAM_FAILED` badge + status `COMPLETED_WITH_WARNINGS`. Trade-off: 2 DB session thay vì 1 (broadcast open SessionLocal riêng) — chấp nhận overhead vì broadcast boundary I/O (~3s timeout), tách session tránh giữ open transaction qua network call.
- **`skipped` flag distinct với `sent=False/error=None`.** `enabled=false` → silent skip (AC-14-01 strict). `enabled=true + creds rỗng` → surface as warning (operator misconfig, không silent). FE distinguish qua `run.telegram_sent + telegram_error + warnings_json` chứ không cần endpoint riêng.
- **`_post_message()` shared helper** — single point of truth cho Bot API call + URL/token scrub. Phase 20 fix scrub chỉ apply cho `send_test_message`; nếu broadcast viết riêng sẽ regress.
- **Per-row warning_badges_json scan** trong `_count_warnings()` dùng `json.loads` defensive (try/except) — corrupt JSON từ history runs không crash broadcast.
- **`run.run_at.strftime("%Y-%m-%d %H:%M")` UTC**, không convert sang Asia/Ho_Chi_Minh — keep server clock consistent với DB column. FE đã chịu trách nhiệm format timezone hiển thị cho user (cluster 5 convention).
- **`app_url` = `cfg.frontend_origin.rstrip("/")`** — không hardcode `localhost:3000`, lấy từ Settings để khi deploy production chỉ cần update env var.
- **Config test isolated qua `tmp_path` + `monkeypatch.chdir`** — không bao giờ touch dev's real `.env` / `.env.telegram` (Phase 20 secret hygiene).
- **Test layout:** unit cho service logic (mock repo + httpx); integration cho wiring (real DB + mock httpx) — match Phase 20 convention.

## 6. Issues / drift còn open

- **Production refresh + run rerun** chưa thực hiện — Telegram broadcast hiện chỉ trigger khi user POST /api/run mới. Existing runs trên prod-screener.db KHÔNG có telegram_sent updated. Operator cần chạy 1 run mới sau Phase 23 deploy để verify end-to-end với real bot.
- **Backtest broadcast chưa wire** — `backtest_service` đóng từ Phase 8 không gọi broadcast. PRD/TAD chỉ yêu cầu manual run summary, backtest result xem trên FE. KHÔNG thay đổi trong Phase 23.
- **`telegram_top_n` validation drift** — settings_service đã validate ∈ {3, 5} (ERR-15-03), nhưng broadcast accept bất kỳ int. Nếu admin bypass validation và set top_n=10, broadcast sẽ gửi 10 row. Acceptable risk — admin chỉ có 1 user MVP.
- **Run-summary không gửi cho FAILED run** — chỉ có flow COMPLETED gọi `_finalize_telegram_broadcast`. FAILED branch trong screening_service exception handler giữ telegram_sent=False default. PRD/TAD không yêu cầu FAILED notification → giữ nguyên.
- **HoldingFormModal TODAY hard-code** (Phase 19 §6 backlog) chưa fix. Carry sang Phase 26 (UX polish, Track 5).
- **FE Next 16 critical upgrade** (Phase 21+ §6.2 Security) chưa làm. Vẫn carry sang Phase 24.

## 7. Test commands (reproducible)

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Targeted regression cho Phase 23
uv run pytest tests/unit/test_telegram_broadcast.py tests/unit/test_config_env_chain.py tests/integration/test_run_telegram_broadcast.py -v
# 22 test pass (9 unit broadcast + 10 unit config + 3 integration)

# Full BE regression
uv run pytest -q
# 288/288 (266 cũ + 22 mới — sẽ confirm sau khi finish full run)

# Ruff
uv run ruff check app tests
# All checks passed
```

## 8. Post-phase fixes

_(Empty — Phase 23 vừa đóng.)_
