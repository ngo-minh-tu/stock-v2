# Phase 20 — Telegram Real-Send Verify REVIEW

**Started:** 2026-05-20  
**Completed:** 2026-05-20  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 20 xác nhận Telegram bot gửi được message thật và thiết lập convention lưu secret local. Review tập trung vào secret hygiene, test isolation khi có live credentials, và ranh giới giữa “endpoint test-send works” với “Telegram feature production-ready”.

## Findings

- **High — Summary đang commit chat_id thật và bot identifier vào tracked repo.** Phiên bản đầu của SUMMARY.md ghi numeric chat.id + tên private chat ở §4, và bot id prefix trong lệnh `git grep` ở §7. Dù không đủ để gửi message nếu thiếu secret token, đây vẫn là PII/metadata nhạy cảm và mâu thuẫn với mục tiêu public repo an toàn. **Đã fix:** redact thành `<redacted>` (verified locally) + audit grep dùng token-shape regex. *(Original line numbers L35 + L37 đã thay đổi sau khi redact.)*
- **High — `telegram_service` có thể log URL chứa bot token khi `httpx.HTTPError`.** [telegram_service.py](../../code/app/services/telegram_service.py#L45) nhúng token vào URL; [line 55](../../code/app/services/telegram_service.py#L55) log raw exception. Với `httpx.RequestError`, exception string thường chứa request URL, nên log có thể lộ token. Cần log class/message đã scrub token hoặc tự format lỗi không chứa URL.
- **Medium — `.env.telegram` luôn override `.env` khi file tồn tại.** [config.py](../../code/app/config.py#L10) load `(".env", ".env.telegram")` và file sau override file trước. Điều này tiện cho local, nhưng nếu file này bị copy lên server hoặc còn sót trong working directory, nó có thể override production env file ngoài ý muốn. Nên gate theo `APP_ENV != "production"` hoặc document mạnh hơn rằng production không có `.env.telegram` và startup/deploy check fail nếu file tồn tại trong production.
- **Medium — Test isolation chỉ vá một nhánh empty-creds.** [test_telegram.py](../../code/tests/integration/test_telegram.py#L46) clear env cho test unconfigured, nhưng không có test riêng chứng minh `.env.telegram` chain-load hoạt động, precedence env/settings đúng với cache clearing, hoặc token không bị dùng trong các test khác khi settings table rỗng. Nên thêm unit/integration test ở config layer với temp env files thay vì dựa vào live local state.
- **Low — Phase này verify `/api/telegram/test`, chưa verify run-terminal notification.** Summary đã ghi out-of-scope, nhưng tên “Telegram Real-Send Verify” dễ bị hiểu là toàn bộ Telegram integration done. TAD c07 broadcast khi screening run completed vẫn chưa wire; cần giữ marker hand-off rõ trong README/phase status.

## Đã kiểm chứng

- Đã đọc Phase 20 summary và review `config.py`, `telegram_service.py`, `api/telegram.py`, `test_telegram.py`, `.gitignore`.
- Kiểm tra ignore/tracking cho `.env.telegram`:

```bash
git check-ignore -v mvp/code/.env.telegram
# .gitignore:23:.env.*  mvp/code/.env.telegram

git ls-files mvp/code/.env.telegram
# empty
```

- Regression nhẹ hiện tại pass cùng nhóm Phase 19:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_dashboard.py tests/integration/test_telegram.py -q
# 15 tests passed
```

## Điểm làm tốt

- Không commit `.env.telegram` và dùng `.env.*` ignore là hướng đúng cho local-only secrets.
- Test `unconfigured` đã được cách ly khỏi live env vars bằng `monkeypatch` + `get_settings.cache_clear()`.
- Live send endpoint đã được verify end-to-end với phản hồi `{sent:true, error:null}` và user xác nhận nhận được message.
- Giữ settings table priority over env var đúng với TAD c07.

## Cần revisit

- Redact chat_id, bot id/prefix và mọi thông tin nhận dạng cá nhân khỏi tracked summaries trước khi public repo.
- Scrub bot token khỏi logs/exception messages trong `telegram_service`.
- Thêm production guard/documentation cho `.env.telegram` local-only.
- Thêm config-layer tests cho multi-env-file loading và precedence.
- Wire Telegram broadcast khi screening run terminal nếu muốn claim Telegram feature hoàn chỉnh.
