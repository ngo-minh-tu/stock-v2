# Phase 2 — Auth + Settings

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** chốt 4 endpoint `auth/login`, `auth/password`, `settings GET/PUT`; JWT bearer dependency; effective-state validation cho `validateSettingsPatch` (SRS f15 UC-15-07).
**Trạng thái:** COMPLETED 2026-05-10

## 1. Việc đã làm

- Pre-code drift audit: chốt LoginRequest 1 field (`{password}`), PUT /auth/password return `{token}` re-issue, server-side merge current+patch trước cross-field check, ERR-15-01..06 cho threshold/telegram/top_n/theme/language/classic_mode, error message generic "Sai mật khẩu" (AC-16-02).
- Viết `app/core/jwt.py` — `issue_token`/`decode_token` HS256, payload `{sub, iat, exp, jti}` (UUID4 hex để token unique trong cùng giây).
- Viết `app/dependencies.py` — `get_current_user` Bearer parse → decode → load `UserProfile`; raise 401 `ERR-AUTH-UNAUTHORIZED` cho 3 case. Type aliases `DbSession`, `CurrentUser`.
- 2 repository: `user_repo` (get_user, set_password_hash), `settings_repo` (get_settings_row, apply_patch — auto bump `version`).
- 3 schemas Pydantic v2: `envelope.py` (ApiSuccess[T] + ApiError), `auth.py` (LoginRequest/Response, PasswordChangeRequest dùng alias `new` ↔ `new_password`), `settings.py` (SettingsResponse `from_attributes` không có password_hash, SettingsPatch all-optional).
- 2 service: `auth_service` (login + change_password verify-current → hash + flush + re-issue), `settings_service` (`get_current` + `validate_patch` effective-state + `apply_patch`, 6 validation gates).
- 2 router: `app/api/auth.py` (POST login + PUT password) + `app/api/settings.py` (GET + PUT settings); register vào `app/api/__init__.py`.
- Tests integration: 7 case auth + 9 case settings + fixture `auth_token`/`auth_headers` + `restore_user_password`/`restore_settings` snapshot/restore.

## 2. File đã thêm

- `mvp/code/app/core/jwt.py`, `app/dependencies.py`
- `mvp/code/app/repositories/__init__.py`, `user_repo.py`, `settings_repo.py`
- `mvp/code/app/schemas/__init__.py`, `envelope.py`, `auth.py`, `settings.py`
- `mvp/code/app/services/__init__.py`, `auth_service.py`, `settings_service.py`
- `mvp/code/app/api/auth.py`, `app/api/settings.py`
- `mvp/code/tests/integration/conftest.py`, `test_auth.py`, `test_settings.py`

## 3. File đã sửa

- `mvp/code/app/constants/error_codes.py` — thêm ERR-15-01..06.
- `mvp/code/app/api/__init__.py` — register `auth` + `settings` router.

## 4. Lệnh đã chạy

```bash
cd mvp/code
uv run pytest                    # 30/30
uv run ruff check app tests      # clean

# Smoke curl
uv run uvicorn app.main:app --port 8000
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS http://127.0.0.1:8000/api/settings -H "Authorization: Bearer $TOKEN"
curl -sS -X PUT http://127.0.0.1:8000/api/settings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"language":"ENG"}'
```

## 5. Kết quả

- Pytest: PASS — 30/30 (Phase 0-1: 13, Phase 2 mới: 17 = 7 auth + 9 settings + 1 unit reuse).
- Ruff: PASS.
- Smoke verified: login pw đúng → 200 token; login pw sai → 401 `ERR-AUTH-INVALID-CREDENTIALS` "Sai mật khẩu"; GET /settings không Bearer → 401; có Bearer → 200 full state (không có password_hash); PUT settings buy=40 hold=50 → 400 `ERR-15-01` cross-field.
- Effective-state pattern verified: telegram_enabled=true với chat+token đầy đủ → single-field PUT `{language: ENG}` pass.

## 6. Tồn đọng

- **Test pollution risk:** `restore_user_password` + `restore_settings` chỉ cover mutation Phase 2. Phase 4+ (screening_runs, results) cần fixture similar hoặc chuyển sang isolated DB.
- **JWT secret default:** `.env.example` có `JWT_SECRET=change-me-in-prod-min-32-chars-...`. Production deploy phải override. Phase 2 không enforce strength check.
- **OpenAPI shape:** Pydantic schemas có nhưng router return raw dict qua `success()` helper — Swagger không show LoginResponse/SettingsResponse shape. Trade-off envelope uniform; post-MVP wrap qua custom response_class.
- **Multi-user RBAC:** out of MVP scope; JWT decode chỉ check user_id, không role/permissions.
- **Password reset email flow:** out of MVP single-user.
- **Session invalidation on password change:** chỉ issue token mới, old token vẫn valid đến hết TTL 24h. Phase 11 audit nếu cần.
