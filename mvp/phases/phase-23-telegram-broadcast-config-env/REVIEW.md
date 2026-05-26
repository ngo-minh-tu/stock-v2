# Phase 23 — Telegram Run-Summary Broadcast + Config-Layer Pytest REVIEW

**Started:** 2026-05-21
**Completed:** 2026-05-21
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 23 đóng 2 hand-off item (broadcast wiring + config-layer pytest). Câu hỏi chính: broadcast có thực sự non-blocking trong mọi failure mode chưa? Message format có ổn định khi Top N bị thiếu hoặc rows corrupt không? Config test có guard được regression khi pydantic-settings upgrade không?

## Findings

- **High — Broadcast chưa verify end-to-end với real bot sau wiring.** Phase 23 chỉ unit + integration test với mock httpx. Real `@Stock_v2_tu_3107_bot` verify Phase 20 chỉ cover `/api/telegram/test`, KHÔNG cover `broadcast_run_summary` từ screening finalize. Nếu Bot API behavior thực khác mock (vd reject text quá dài, hoặc Markdown escape Unicode emoji), broadcast sẽ silent fail trên production. Operator phải chạy 1 manual run sau Phase 25 DB refresh + kiểm Telegram thực nhận message. Quan trọng hơn nữa: message hiện chứa Unicode emoji + dấu tiếng Việt — Bot API sendMessage cần `parse_mode=null` (default) để không parse Markdown, đã verify trong code (KHÔNG set parse_mode).

- **High — Message template không guard độ dài.** [telegram_service.py:_build_run_summary_message](../../code/app/services/telegram_service.py) compose text trên ticker count + top_n. Nếu `telegram_top_n=5` và một số ticker có entry_signal dài (vd "WAIT_FOR_CONFIRMATION_DAILY_RSI_OVERSOLD" tương lai), text có thể vượt 4096-char limit của Telegram. Hiện top_n max=5 + signal hiện chỉ 6 enum value (BUY_STRONG/BUY_NOW/WAIT_FOR_BREAKOUT/WAIT_FOR_PULLBACK/WAIT_FOR_CONFIRMATION/NO_ENTRY) nên thực tế <500 char. Acceptable risk. Carry: nếu mở rộng top_n future hoặc reason_code đa-token, cần truncate.

- **High — `_finalize_telegram_broadcast` exception handler swallow tất cả, có thể mask bug thực.** [screening_service.py:_finalize_telegram_broadcast](../../code/app/services/screening_service.py) bọc broadcast trong try/except generic — nếu broadcast crash (vd DB lock, repo bug), log warning + tag `telegram_error="Telegram finalize {ExcClass}"` rồi swallow. Đảm bảo non-blocking nhưng có thể mask `screening_repo.update_telegram_status` lỗi sub-class (vd schema drift Phase post-23). Acceptable trade-off vì AC-14-03 mandate non-blocking. Mitigation: log ở level WARNING + chi tiết class name → operator có thể grep log để phát hiện pattern bất thường.

- **Medium — Top-N query đọc lại từ DB sau bulk_insert thay vì dùng in-memory `scored` list.** [telegram_service.py:broadcast_run_summary](../../code/app/services/telegram_service.py) gọi `results_repo.list_by_run(db, run_id)` để build top-N, nhưng caller (`screening_service`) đã có `scored: list[dict]` trong memory. Trade-off: extra DB round-trip ~26 rows query (negligible) đổi lấy `broadcast_run_summary(db, run_id)` self-contained API (có thể call lại từ `/api/runs/{id}/rebroadcast` endpoint nếu future cần). Acceptable. Carry nếu DB load >1s thì refactor.

- **Medium — Config-layer pytest dùng `Settings()` direct + `get_settings.cache_clear()` nhưng KHÔNG verify thread safety của lru_cache.** [test_config_env_chain.py](../../code/tests/unit/test_config_env_chain.py) test cache behavior single-thread. `lru_cache` thread-safe by default trong CPython (GIL serialize), nhưng nếu future replace bằng `cachetools.lru_cache` với explicit lock thì test không catch. Defer — pytest không chạy concurrent test trên cùng cache key, chấp nhận risk.

- **Medium — `_count_warnings` parse `warning_badges_json` per-row trong loop.** Mỗi row 1 `json.loads()` — 26 ticker → 26 parse. Negligible (~microseconds) nhưng nếu future scale lên 100+ ticker hoặc cache miss force re-query, có thể tối ưu bằng SQL `json_array_length(warning_badges_json) > 0` count aggregate. Defer.

- **Medium — `broadcast_run_summary` không retry trên Bot API rate-limit (429).** [_post_message](../../code/app/services/telegram_service.py) trả `description` từ Bot API response body — Telegram Bot API rate-limit 30 msg/sec per chat. Trong MVP single-user single-run scenario, không gặp 429. Nếu future có scheduled refresh + auto-run + broadcast, có thể spam. Carry Phase 28 (Telegram UX).

- **Low — `f"{upside:.1f}".rstrip("0").rstrip(".")` edge case với upside=0.0** → format thành "0" (rstrip ăn cả "0." → "0"). f14 template sẽ render `▲0% — MUA_NGAY`. Visually OK nhưng không có ▼ cho upside negative. Hiện tại stocks MUA luôn có upside>0 (filter by recommendation), nên không gặp negative. Acceptable.

- **Low — Test `test_only_buy_rows_in_top` đặt HIGH_HOLD score=99 nhưng recommendation=GIU.** Trong production data, score 99 luôn map thành MUA (buy_threshold=75). Test setup hơi giả tạo nhưng verify đúng filter logic (loại GIU dù score cao). Defer cleanup test với realistic data.

- **Low — `_build_run_summary_message` hard-code emoji 🔍/📊/🏆/⚠️/⚡.** Nếu future muốn dark-mode / accessibility / plain-text fallback, không có toggle. Hiện match SRS f14 template exactly. Defer.

- **Low — `app_url = cfg.frontend_origin.rstrip("/")` không validate URL format.** Nếu admin set `FRONTEND_ORIGIN="invalid not-a-url"`, message vẫn render text đó. Telegram client sẽ KHÔNG hyperlink, chỉ hiển thị plain text. Không crash. Acceptable.

## Đã kiểm chứng

- Đã đọc TAD c07 §1 + SRS f14 UC-14-01 (AC-14-01..04). Message template, settings dependencies, error handling spec match implementation.
- Đã đọc Phase 22 §6 backlog xác nhận 2 carry-over: (a) Telegram broadcast wire (TAD c07 §3), (b) config-layer pytest.
- Đã verify URL/token scrub via 2 unit test (`test_post_message_timeout_does_not_leak` + `test_post_message_http_error_scrubs_url`) — token KHÔNG xuất hiện trong error message lẫn log.
- Đã verify warning_count đếm đúng (1 row với non-empty array → count=1, others empty=0 → tổng 1).
- Đã verify ordering MUA score-DESC + top_n cut (DXG score 60 outside top 3, T05-T06 outside top 5).
- Đã verify GIU/BAN bị loại khỏi Top list dù score cao (HIGH_HOLD score=99 + recommendation=GIU không hiện trong text).
- Đã verify final status:
  - skipped path → COMPLETED.
  - sent=True → COMPLETED, warnings không TELEGRAM_FAILED.
  - sent=False → COMPLETED_WITH_WARNINGS, warnings chứa TELEGRAM_FAILED.
- Đã verify integration test pattern chuẩn (httpx mock + restore_settings fixture + fetch run từ separate session).
- Regression hiện tại pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

uv run pytest tests/unit/test_telegram_broadcast.py tests/unit/test_config_env_chain.py tests/integration/test_run_telegram_broadcast.py -v
# 22 tests pass

uv run pytest -q
# 288/288 passed

uv run ruff check app tests
# All checks passed
```

## Điểm làm tốt

- `_post_message` shared helper — single point of truth cho Bot API + URL/token scrub. Tránh duplicate code khi add path mới (vd `/api/telegram/test-broadcast` future).
- `skipped` flag distinct với `sent=False/error=None` — phân biệt rõ silent skip (AC-14-01) vs misconfig warning (operator cần thấy).
- Reorder finalize hook hợp lý: bulk_insert TRƯỚC broadcast (cần top-N từ DB) TRƯỚC mark_completed (cần warnings_json bao gồm TELEGRAM_FAILED). Trace đúng spec AC-14-03 mapping vào COMPLETED_WITH_WARNINGS.
- Separate SessionLocal cho broadcast — boundary I/O tách khỏi DB transaction, tránh giữ open transaction qua network call ~3s timeout.
- Config-layer pytest cover 10 path bao gồm regression guard cho `env_file` tuple — nếu future ai revert thành single string, test fail fast.
- Tests isolated via `tmp_path` + `monkeypatch.chdir` — không touch real `.env` files. Tuân thủ Phase 20 secret hygiene.
- 9 unit + 3 integration cover đủ outcome paths với mock httpx — không cần real Bot API (giữ pytest deterministic).

## Cần revisit

- **Real bot verify trong Phase 25 pre-hand-off**: sau khi prod DB refresh + 1 manual `/api/run`, kiểm Telegram thực nhận message. Format text + emoji render OK trên mobile + desktop client.
- **F11 OCF distribution shift** sau full refresh — Phase 21+22 fix unit, scoring có thể shift; verify Top N qua broadcast trông hợp lý không.
- **Top-N message length guard**: nếu future top_n > 5 hoặc signal token dài, thêm truncate logic vào `_build_run_summary_message`.
- **Bot API 429 rate-limit handler** trong `_post_message` — Phase 28 (Telegram UX).
- **Optional: cache top-N rows từ `scored` in-memory** thay vì re-query DB — chỉ nếu DB load >1s.
- **Optional: settings UI toggle bật/tắt broadcast** — Phase 28 hoặc Phase 25.5 nếu trader feedback.
- **Range sanity check trong feature_service** (Phase 22 REVIEW High carry) — Phase 25 §25.4.
