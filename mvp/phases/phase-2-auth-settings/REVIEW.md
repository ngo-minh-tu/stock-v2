# Phase 2 — Auth + Settings REVIEW

**Done:** ~2026-05-10 (~2h, estimate 0.5d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: 4 traps nhỏ nhưng dễ miss — JWT serialize, password change return token, effective-state validation, Pydantic Settings.

## Surprises / non-obvious

- **JWT `sub=str("1")` not int**: python-jose serialize/deserialize chỉ accept string trong `sub` claim. Phải `str(user.id)` khi encode + `int()` khi decode. Quên = `db.get(UserProfile, "1")` fail silently (return None).
- **Password change return new token**: cluster 6 / TAD g02 §9.5 chốt `PUT /auth/password` vừa change pass vừa return fresh JWT để FE re-login implicit. Single endpoint, single round-trip — KHÔNG yêu cầu FE call /login lại.
- **Effective-state validation đặc biệt cho settings**: SRS f15 UC-15-07. Single-field PUT (e.g. chỉ `language`) phải merge current+patch → check cross-field trên **MERGED** state, không phải patch alone. Nếu chỉ check patch → telegram_enabled stays true + thiếu chat_id mới gây spurious 400. Pattern: `merged = {**current, **{k: v for k, v in patch.items() if v is not None}}; validate(merged)`.
- **Pydantic Settings `extra="ignore"`**: từ `.env` có thêm field không define trong class → bỏ qua thay vì throw. Quan trọng vì shared .env có nhiều biến cho cả backend + frontend.

## Key decisions (why)

- **`version` bump per PUT**: dùng cho cluster 5 RunSummary `settings_version` field. Audit trail — biết screening run với settings version nào.
- **`telegram_enabled=true + empty fields → ERR-15-02`**: cross-field validation trên merged state. Phase 8 `telegram/test` endpoint KHÔNG enforce check này — settings save mới enforce. Lý do: test send là probe action, có thể chạy trước khi save settings.
- **`restore_settings` fixture snapshot 16 fields**: tests mutate must restore vì DB shared. Phase 7 thêm portfolio dùng `clean_portfolio` instead (wipe + restore empty — đơn giản hơn).

## To revisit

- Multi-user RBAC: out of MVP scope. JWT decode chỉ check `user_id` exists trong DB, không role/permissions.
- Password reset email flow: out of MVP. Single-user nên không cần.
- Session invalidation on password change: hiện chỉ issue token mới, old token still valid đến hết TTL. Phase 11 nếu cần security audit.
