# Phase 20 — Telegram Real-Send Verify

**Ngày:** 2026-05-20
**Mục tiêu thực hiện:** verify `POST /api/telegram/test` thực sự gọi Telegram Bot API và message đến được Telegram của user; thiết lập convention an toàn lưu Bot token / chat_id tách hoàn toàn khỏi tracked tree (chuẩn bị public repo).
**Trạng thái:** COMPLETED 2026-05-20

## 1. Việc đã làm

- Pre-code drift audit 3 mục:
  - 20-01 — TAD c07 §1.1 "settings table priority over env var" đã implement Phase 8; nhưng config chỉ load 1 file `.env`, không có lane riêng cho secrets. Mở rộng `SettingsConfigDict(env_file=(".env", ".env.telegram"))` — load 2 file, file sau override. Local-only secret file gitignored qua `.env.*` pattern.
  - 20-02 — `test_telegram.py::test_unconfigured_returns_sent_false` giả định env vars trống; sau chain-load `.env.telegram`, env có credentials real → test leak. Thêm `monkeypatch.setenv(..., "")` + `get_settings.cache_clear()` để force trạng thái empty-creds.
  - 20-03 — workflow chat_id discovery chưa documented: bot user `/start` → operator gọi `getUpdates` → parse `message.chat.id` → write `.env.telegram`.
- Tạo `mvp/code/.env.telegram` (gitignored, không commit) chứa `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` local.
- Mở rộng `app/config.py` chain-load 2 file.
- Update `test_telegram.py` test isolation cho live creds local.
- Verify end-to-end:
  - Bot token valid qua `getMe` API.
  - Chat ID resolved sau user `/start`.
  - `POST /api/telegram/test` returns `{sent: true, error: null}`.
  - Message thực sự đến device Telegram của user (user confirm 2026-05-20).
- Quyết định:
  - Bot secret file = `mvp/code/.env.telegram` (gitignored).
  - Pydantic-settings multi-file chain — file sau override. Production có thể không tạo file riêng (pass env vars qua container / systemd) — pydantic-settings tự skip file không tồn tại.
  - Test isolation cho live creds local: any test giả định "creds empty" phải dùng `monkeypatch.setenv("TELEGRAM_*", "")` + `cache_clear()`.
  - Bot revocation procedure (nếu rò rỉ): `@BotFather` → `/revoke` → token mới → update `.env.telegram` local.
- **Security/PII redaction (Codex review High finding 2026-05-20):** redact numeric chat_id, bot username, bot id prefix khỏi SUMMARY/REVIEW; audit grep chuyển sang token-shape regex `[0-9]{8,12}:[A-Za-z0-9_-]{30,}` generic + zero-leak.
- **Token-leak guard cho `telegram_service` log** (Codex review High): `log.warning(...)` đổi từ `%s, exc` (httpx exception str có thể include request URL chứa token) sang `%s, exc.__class__.__name__`. Server log nay chỉ class name.

## 2. File đã thêm

- `mvp/code/.env.telegram` — **gitignored, không commit**, chứa bot username, chat_id, token đều lưu local trong file này.

## 3. File đã sửa

- `mvp/code/app/config.py` — `SettingsConfigDict` chuyển từ `env_file=".env"` sang tuple `(".env", ".env.telegram")`.
- `mvp/code/tests/integration/test_telegram.py` — `test_unconfigured_returns_sent_false` thêm `monkeypatch.setenv` + `cache_clear`.
- `mvp/code/app/services/telegram_service.py` — log token-leak guard (post-phase fix).

**KHÔNG có deliverable document/commit nào chứa giá trị token / chat_id / bot username.**

## 4. Lệnh đã chạy

```bash
# Verify bot token valid (operator-side, không log token ra terminal history)
cd mvp/code && set -a && . ./.env.telegram && set +a
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | python3 -m json.tool

# Discover chat_id (after user /start)
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['message']['chat']['id'])"

# Live end-to-end test
APP_ENV=demo DB_PATH=./data/demo-screener.db uv run uvicorn app.main:app --port 8000 &
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
curl -s -X POST http://localhost:8000/api/telegram/test \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}' \
  | python3 -m json.tool

# Regression
uv run pytest -q                # 257/257
uv run ruff check app tests     # All checks passed

# Audit token leak (must return empty)
git -C $(git rev-parse --show-toplevel) grep -E "[0-9]{8,12}:[A-Za-z0-9_-]{30,}"
```

## 5. Kết quả

- Bot token verified valid qua `getMe` (verified locally — bot username không log).
- Chat ID resolved (verified locally — numeric id chỉ lưu trong `.env.telegram`).
- `.env.telegram` gitignored: `.gitignore:23:.env.*` matches; `git ls-files` không tracked.
- Token-shape grep `git grep -E "[0-9]{8,12}:[A-Za-z0-9_-]{30,}"` → empty. SUMMARY/PLAN/memory tránh ghi bot_id/chat_id thật.
- `POST /api/telegram/test` returns `{"success": true, "data": {"sent": true, "error": null}}`.
- Message arrives ở Telegram user device — user confirm 2026-05-20: "có nhận được".
- BE pytest: PASS — 257/257 sau env chain-load.
- Ruff: PASS.

## 6. Tồn đọng

- **Production env management:** không nên có file `.env.telegram` trên container (best practice = inject env vars qua container runtime / secret manager). `env.production.example` (Phase 18) đã có `TELEGRAM_BOT_TOKEN=` placeholder. README cần document rõ `.env.telegram` chỉ cho local dev.
- **Test ordering flakiness `test_compare_full_shape`** — quan sát failure khi run cùng test_telegram trong cùng session; pass khi run alone. KHÔNG do Phase 20 — đã exist trước. Carry sang Phase 21 (test isolation cleanup).
- **Bot không tự nhắn screening run notification:** TAD c07 §3 đề cập "broadcast khi run COMPLETED"; MVP chỉ wire endpoint `/api/telegram/test` (manual trigger). Phase 21+ wire `telegram_service.broadcast_run_summary(run_id)` vào pipeline terminal hook.
- **Token rotation rule chưa có policy.** Nên rotate 6 tháng hoặc khi thay máy dev — manual qua @BotFather.
- **`.env.telegram` luôn override `.env` khi tồn tại** (REVIEW Medium): tiện local nhưng nếu file copy lên server hoặc còn sót trong working dir, override production env ngoài ý muốn. Cần gate theo `APP_ENV != "production"` hoặc startup check fail nếu file tồn tại trong production.
- **Test isolation chỉ vá empty-creds branch** (REVIEW Medium): chưa có test riêng chứng minh `.env.telegram` chain-load hoạt động, precedence env/settings đúng với cache clearing. Cần unit/integration test ở config layer với temp env files.
- **Phase này verify `/api/telegram/test`, chưa verify run-terminal notification** (REVIEW Low): tên "Telegram Real-Send Verify" dễ bị hiểu nhầm toàn bộ Telegram integration done. TAD c07 broadcast vẫn pending.

### Post-phase fix 2026-05-20 — PII redaction + token-leak guard

- **PII redaction tracked tree:** SUMMARY §4 + §7 redact numeric chat.id + bot username + bot id prefix → `<redacted>` / "verified locally". REVIEW §Findings cập nhật chú thích numeric line đã thay đổi sau redact. Audit grep chuyển từ literal bot id sang token-shape regex generic + zero-leak.
- **Token-leak guard `telegram_service` log:** `log.warning(...)` đổi từ `%s, exc` (httpx exception str có thể include request URL chứa token) sang `%s, exc.__class__.__name__`. User-facing error đã chỉ chứa class name; server log nay cũng vậy.
