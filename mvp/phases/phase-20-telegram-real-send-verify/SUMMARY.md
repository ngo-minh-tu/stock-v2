# Phase 20 — Telegram Real-Send Verify

**Started:** 2026-05-20 · **Closed:** 2026-05-20
**Roadmap:** Mốc 3 step 9 (carry-over) — verify Telegram bot integration end-to-end với token + chat_id thật của user.

## 1. Scope

Verify `POST /api/telegram/test` thực sự gọi Telegram Bot API và message đến được Telegram của user. Đồng thời thiết lập **convention an toàn** để lưu Bot token / chat_id **tách hoàn toàn** khỏi tracked tree, sẵn sàng cho lúc user public repo.

Out of scope: Telegram broadcast trên screening run terminal (TAD c07 §3 — chưa wire trong MVP), production deploy (Docker + reverse proxy).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 20-01 | TAD c07 §1.1 prescribe "settings table priority over env var" — đã implement Phase 8. Nhưng config chỉ load 1 file `.env`, không có lane riêng cho secrets. | `app/config.py` | Mở rộng `SettingsConfigDict(env_file=(".env", ".env.telegram"))` — load 2 file, file sau override file trước. Local-only secret file gitignored. |
| 20-02 | `tests/integration/test_telegram.py::test_unconfigured_returns_sent_false` giả định env vars trống. Sau khi Phase 20 chain-load `.env.telegram`, env có credentials real → test leak vào live API. | `tests/integration/test_telegram.py` | Thêm `monkeypatch.setenv(...,"")` + `get_settings.cache_clear()` trong test để force trạng thái empty-creds. |
| 20-03 | Chưa có chat_id của user khi token được cấp; spec không nói rõ workflow lấy chat_id. | (workflow) | Bot user nhắn `/start` → backend operator gọi `https://api.telegram.org/bot<TOKEN>/getUpdates` lấy `message.chat.id` → write vào `.env.telegram`. Document trong §5. |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `mvp/code/.env.telegram` ⚠️ **gitignored, không commit** | Local-only secret: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`. Match pattern `.env.*` trong root `.gitignore` (line 23). |
| `mvp/code/app/config.py` | `SettingsConfigDict` chuyển từ `env_file=".env"` sang tuple `(".env", ".env.telegram")`. Pydantic-settings tự skip file không tồn tại — production có thể không có `.env.telegram` (dùng env vars qua Docker `--env-file` hoặc systemd `EnvironmentFile=`). |
| `mvp/code/tests/integration/test_telegram.py` | `test_unconfigured_returns_sent_false` thêm `monkeypatch.setenv` + `cache_clear` để tách hẳn khỏi creds dev local. |

**KHÔNG có deliverables document/commit nào chứa giá trị token / chat_id.**

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| Bot token verified valid qua `getMe` | ✅ | `curl https://api.telegram.org/bot<TOKEN>/getMe` → `ok:true`, bot username `@<redacted>` (verified locally). |
| Chat ID resolved | ✅ | `curl .../getUpdates` sau khi user `/start` → `chat.id = <redacted>` (verified locally; numeric id + display name lưu duy nhất trong `.env.telegram`). |
| `.env.telegram` gitignored — `git check-ignore` trả về match | ✅ | `.gitignore:23:.env.*` matches. `git ls-files` không tracked. |
| Token + bot identifiers KHÔNG xuất hiện trong any tracked file | ✅ | Token-shape grep `git grep -E "[0-9]{8,12}:[A-Za-z0-9_-]{30,}"` → empty. SUMMARY.md, PLAN.md, memory tránh ghi bot_id/chat_id thật. |
| `POST /api/telegram/test` returns `{sent:true, error:null}` | ✅ | Auth Bearer + body `{}` → response `{"success":true,"data":{"sent":true,"error":null}}`. |
| Message arrives ở Telegram user device | ✅ | User confirm 2026-05-20: "có nhận được". |
| Backend pytest 257/257 vẫn pass sau env chain-load | ✅ | `uv run pytest -q` → 257 dots. |
| Ruff sạch | ✅ | `uv run ruff check app tests` → All checks passed. |

## 5. Quyết định khoá trong phase này

- **Bot secret file = `mvp/code/.env.telegram`**, gitignored qua `.env.*` pattern. Cách public repo: không bị lộ token vì file không bao giờ trong index.
- **Pydantic-settings multi-file chain**: `env_file=(".env", ".env.telegram")` — file sau override file trước. Production có thể không tạo file riêng (pass env vars qua container / systemd) — pydantic-settings tự skip file không tồn tại, không lỗi.
- **Chat ID discovery workflow**:
  1. Cấp Bot token cho operator (Phase 20: user cấp Tuấn).
  2. User mở Telegram → tìm bot username → `/start`.
  3. Operator gọi `curl https://api.telegram.org/bot<TOKEN>/getUpdates` → parse `result[].message.chat.id`.
  4. Write `TELEGRAM_CHAT_ID=...` vào `.env.telegram`.
- **Test isolation cho live creds local**: any test giả định "creds empty" phải dùng `monkeypatch.setenv("TELEGRAM_*", "")` + `get_settings.cache_clear()` trước khi assert. Tests có `_set_creds("", "")` chỉ wipe settings table; env vars vẫn intact qua pydantic.
- **Bot revocation procedure** (nếu rò rỉ): `@BotFather` → `/revoke` → chọn bot (operator biết username) → token mới → update `.env.telegram` local.

## 6. Issues / drift còn open

- **Production env management**: Khi deploy thực, không nên có file `.env.telegram` trên container (best practice = inject env vars qua container runtime / secret manager). `env.production.example` (Phase 18) đã có `TELEGRAM_BOT_TOKEN=` placeholder. Document rõ trong README rằng `.env.telegram` chỉ cho local dev.
- **Test ordering flakiness `test_compare_full_shape`**: quan sát failure khi run cùng test_telegram trong cùng session (full pytest), nhưng pass khi run alone. KHÔNG do Phase 20 — đã exist trước. Carry sang Phase 21 (test isolation cleanup).
- **Bot không tự nhắn screening run notification**: TAD c07 §3 đề cập "broadcast khi run COMPLETED" nhưng MVP chỉ wire endpoint `/api/telegram/test` (manual trigger). Phase 21+ wire `telegram_service.broadcast_run_summary(run_id)` vào screening pipeline terminal hook.
- **Token rotation rule**: chưa có policy. Nên rotate 6 tháng hoặc khi thay máy dev. Manual qua @BotFather.

## 7. Test commands (reproducible)

```bash
# Verify bot token valid (operator-side, không log token ra terminal history)
cd mvp/code && set -a && . ./.env.telegram && set +a
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -m json.tool

# Discover chat_id (after user sends /start to bot)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['message']['chat']['id'])"

# Live end-to-end test (BE must be running with .env.telegram loaded)
APP_ENV=demo DB_PATH=./data/demo-screener.db uv run uvicorn app.main:app --port 8000 &
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
curl -s -X POST http://localhost:8000/api/telegram/test \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' \
  | python3 -m json.tool
# Expect: {"success":true,"data":{"sent":true,"error":null}}; check Telegram app for arrival.

# Regression
uv run pytest -q                # 257/257 pass
uv run ruff check app tests     # All checks passed

# Audit token leak (must return empty — token-shape regex covers any Telegram bot token)
git -C $(git rev-parse --show-toplevel) grep -E "[0-9]{8,12}:[A-Za-z0-9_-]{30,}"
```

## 8. Hand-off cho Phase 21+ (post-MVP backlog)

1. **Telegram run-terminal broadcast** — wire `telegram_service.send_summary(run_id)` vào `screening_service.run_screening` finalize hook (TAD c07 §3).
2. **FE security upgrade** — Next 16.2.6 + next-intl 4.12 + postcss. Breaking. Regression cycle riêng + Playwright smoke re-verify.
3. **HoldingFormModal `TODAY` hard-coded → runtime date** (Phase 19 finding 6.4).
4. **KBS alias mapping** — `total_assets/revenue/total_liabilities` về 0 trong fallback path.
5. **Test isolation cleanup** — `test_compare_full_shape` flaky khi chạy full pytest sau test_telegram. Root cause: shared session state hoặc fixture ordering.
6. **Production deploy actuals** — Docker + provisioning + HTTPS + crontab. Tooling Phase 18 sẵn sàng.
7. **Telegram secret in production** — không dùng `.env.telegram` file trên server; inject qua Docker `--env-file` từ secret manager hoặc `EnvironmentFile=` của systemd unit.

## 9. Post-phase fixes

- **2026-05-20 — PII redaction trong tracked tree** (Codex Phase 20 review High finding):
  - SUMMARY.md §4 + §7: redact numeric `chat.id` + bot username + bot id prefix → `<redacted>` / "verified locally".
  - REVIEW.md §Findings: cập nhật chú thích numeric line đã thay đổi sau redact.
  - Audit grep chuyển từ literal bot id sang token-shape regex `[0-9]{8,12}:[A-Za-z0-9_-]{30,}` — generic + zero-leak.
- **2026-05-20 — Token-leak guard cho `telegram_service` log** (Codex Phase 20 review High finding):
  - [telegram_service.py:54](../../code/app/services/telegram_service.py#L54) — `log.warning(...)` đổi từ `%s, exc` (httpx exception str có thể include request URL chứa token) sang `%s, exc.__class__.__name__`. User-facing error đã chỉ chứa class name, server log nay cũng vậy.
- *(Reserved cho fix tiếp theo.)*
