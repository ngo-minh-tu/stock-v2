# Phase 2 — Auth + Settings

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 0.5d / ~2h
**Spec ref:** [PLAN.md §3 row 2](../../PLAN.md), [SRS f16](../../../docs/srs/f16-authentication.md), [SRS f15](../../../docs/srs/f15-settings.md), [SRS g01](../../../docs/srs/g01-global-errors-and-validation.md)

## 1. Scope

- **POST /api/auth/login** — single password (no username, single-user MVP) → JWT 24h
- **PUT /api/auth/password** — verify current → bcrypt hash new → re-issue JWT (FE update localStorage)
- **GET /api/settings** — full state (no password_hash); requires Bearer token
- **PUT /api/settings** — partial patch + effective-state validation (UC-15-07); auto bump `version`
- JWT middleware via FastAPI dependency (`get_current_user`)
- Server-side mirror of `validateSettingsPatch` covering 6 cross-field rules (TAD g02 §5 + SRS f15 UC-15-07)

## 2. Pre-code spec audit (drift report)

Đọc PRD/SRS (skip lúc viết PLAN) + reconcile với deliverable:

| # | Drift | Resolution |
|---|---|---|
| 1 | SRS f16: login body **chỉ `{password}`** (no username) | LoginRequest 1 field |
| 2 | SRS f15 UC-15-06 + TAD g02 §9.5: PUT /auth/password **trả `{token}` mới** | `change_password()` re-issue JWT; FE skip AuthContext setter |
| 3 | SRS f15 UC-15-07: server **effective-state validation** (merge current+patch trước khi check cross-field) | `services/settings_service.validate_patch` build merged dict trước khi raise |
| 4 | SRS f15 UC-15-07 codes ERR-15-01 (threshold) + ERR-15-02 (telegram); thêm ERR-15-03..06 cho enum/top_n | Đã add vào `constants/error_codes.py` |
| 5 | SRS f16 AC-16-02: error message generic "Sai mật khẩu", **không tiết lộ "user not found"** | `auth_service.login` raise ERR-AUTH-INVALID-CREDENTIALS với 1 message duy nhất cho mọi case |

## 3. Deliverables

Tất cả path relative tới `mvp/code/`.

### Core
| Path | Nội dung |
|---|---|
| `app/core/jwt.py` | `issue_token(user_id)` + `decode_token(token)` HS256, payload `{sub, iat, exp, jti}`. `jti` ensure mỗi token unique (workaround issue/decode trong cùng giây) |
| `app/dependencies.py` | `get_current_user` Bearer parse → decode JWT → load `UserProfile` từ DB; trả `AppError 401 ERR-AUTH-UNAUTHORIZED` cho 3 case (no header, invalid token, user not found). Type aliases `DbSession`, `CurrentUser` |

### Repositories
| Path | Nội dung |
|---|---|
| `app/repositories/__init__.py` | Package marker |
| `app/repositories/user_repo.py` | `get_user(db)` + `set_password_hash(db, hash)` (single-user id=1) |
| `app/repositories/settings_repo.py` | `get_settings_row(db)` + `apply_patch(db, dict)` — auto bump `version`, refresh row |

### Schemas
| Path | Nội dung |
|---|---|
| `app/schemas/__init__.py` | Package marker |
| `app/schemas/envelope.py` | `ApiSuccess[T]` + `ApiError` (Pydantic, document OpenAPI shape) |
| `app/schemas/auth.py` | `LoginRequest`/`Response`, `PasswordChangeRequest` (alias `new` ↔ `new_password`)/`Response` |
| `app/schemas/settings.py` | `SettingsResponse` (from_attributes ORM mode, **không có password_hash**), `SettingsPatch` (all-optional) |

### Services
| Path | Nội dung |
|---|---|
| `app/services/__init__.py` | Package marker |
| `app/services/auth_service.py` | `login()` — verify pw → issue JWT (generic error per AC-16-02). `change_password()` — verify current → enforce length≥8 → hash + flush + re-issue |
| `app/services/settings_service.py` | `get_current()` + `validate_patch()` (effective-state) + `apply_patch()`. 6 validation gates: threshold range, threshold cross-field, telegram empty (×2 chat/token), top_n in {3,5}, theme/classic_mode/language enum |

### API Routers
| Path | Nội dung |
|---|---|
| `app/api/auth.py` | POST /auth/login (no auth required) + PUT /auth/password (Bearer required, đổi password user hiện tại) |
| `app/api/settings.py` | GET /settings + PUT /settings (cả hai Bearer required) |
| `app/api/__init__.py` | Register `auth`, `settings` routers vào root `/api` |

### Constants
| Path | Đã thêm |
|---|---|
| `app/constants/error_codes.py` | ERR-15-01..06 (threshold/telegram_empty/top_n/theme/language/classic_mode) |

### Tests
| Path | Cases |
|---|---|
| `tests/integration/conftest.py` | Session fixture autouse `_ensure_seeded`; `auth_token`/`auth_headers`; `restore_user_password` + `restore_settings` snapshot/restore tránh test pollution |
| `tests/integration/test_auth.py` | 7 cases: login success/wrong/missing 422, change password requires auth + wrong current + short new + success re-issue (verify new token works + old password no longer logs in) |
| `tests/integration/test_settings.py` | 9 cases: GET requires auth + returns full state (no password_hash) + version present, PUT requires auth + single-field bumps version + threshold violation + threshold range + telegram empty + effective-state pass + invalid theme + invalid top_n |

## 4. Exit criteria — all PASS

- `uv run pytest` → **30/30 pass** (Phase 0-1: 13, Phase 2 mới: 17 = 7 auth + 9 settings + 1 unit/seed reuse)
- `uv run ruff check app tests` → All checks passed
- Smoke với curl thực:
  - POST /auth/login pw đúng → `{success:true, data:{token:"eyJ..."}}`
  - POST /auth/login pw sai → 401 `ERR-AUTH-INVALID-CREDENTIALS` + message "Sai mật khẩu"
  - GET /settings không Bearer → 401 `ERR-AUTH-UNAUTHORIZED`
  - GET /settings + Bearer → 200 full state, **password_hash không xuất hiện**
  - PUT /settings buy=40, hold=50 → 400 `ERR-15-01` cross-field
- Effective-state pattern verified: telegram_enabled=true với chat+token đầy đủ → single-field PUT `{language: ENG}` pass (không spurious fail)

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Login schema | `{password}` only | SRS f16 single-user MVP |
| JWT claims | `sub, iat, exp, jti` | `jti` UUID4 hex để token unique cùng giây |
| Password change response | `{token}` (re-issue JWT) | SRS f15 UC-15-06 + TAD g02 §9.5; FE update localStorage trực tiếp, không qua AuthContext setter |
| Validation pattern | Effective-state merge trước cross-field check | SRS f15 UC-15-07 — single-field PUT phải pass, validate dựa current+patch |
| Error response | `AppError(code, message, http_status, detail)` | Centralized envelope; mọi 4xx/5xx đều `{success:false, error:{code,message,detail?}}` |
| Test isolation | conftest fixture snapshot/restore user.password_hash + settings row | Tests share dev DB; mutations rollback thủ công sau test |
| `new` keyword | Pydantic field `new_password` với `alias="new"` + `populate_by_name=True` | Spec body dùng `new`; Python keyword conflict |

## 6. Issues / drift

- **Test pollution risk**: `restore_user_password` + `restore_settings` fixture cover Phase 2 mutations. Phase 4+ (screening_runs, results) cần fixture similar hoặc chuyển sang isolated DB pattern.
- **JWT secret default**: `.env.example` có `JWT_SECRET=change-me-in-prod-min-32-chars-...`. Production deploy phải override qua env. Phase 2 không enforce strength check; chỉ document.
- **passlib drift đã reconcile**: Phase 1 thay passlib → bcrypt direct; Phase 2 dùng `app.core.password.{hash_password, verify_password}` thẳng, không touch passlib.
- **TAD c08 §3** spec wording "JWT MVP với bcrypt" matches; chỉ drift là passlib library choice (đã document Phase 1 §5).
- **OpenAPI docs**: Pydantic schemas có nhưng router return raw dict (qua `success()` helper). OpenAPI chỉ show body type là `dict` — không hiển thị `LoginResponse`/`SettingsResponse` shape ở Swagger. Trade-off: envelope wrapping uniform. Phase post-MVP có thể wrap qua custom response_class nếu cần Swagger thân thiện hơn.

## 7. Test commands (reproducible)

```bash
cd mvp/code

uv run pytest                       # 30 pass
uv run ruff check app tests         # clean

# Smoke
uv run uvicorn app.main:app --port 8000   # terminal 1
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS http://127.0.0.1:8000/api/settings -H "Authorization: Bearer $TOKEN"
curl -sS -X PUT http://127.0.0.1:8000/api/settings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"language":"ENG"}'
```

## 8. Hand-off cho Phase 3

Phase 3 (Refresh layer) sẽ thêm:
- `app/crawlers/vnstock_client.py` — rate-limited (0.5s) wrapper
- `app/crawlers/cache_manager.py` — source-level TTL gate
- `app/services/refresh_service.py` — async background driver
- `app/api/refresh.py` — POST /refresh/{all,prices} (202) + GET /refresh/{id}/status
- `app/job_lock.py` — in-mem registry + asyncio.Lock cho heavy job
- Repositories: `price_repo`, `financial_repo`, `cache_repo`

Đã sẵn sàng:
- DB models (StockPrice, FinancialReport, MacroData, CacheMetadata)
- 81 stocks seeded
- Auth dependency (get_current_user) cho POST /refresh

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 2 sau khi phase đã đóng)*
