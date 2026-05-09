---
name: SRS-16 Authentication
description: Basic Auth login với password hash, redirect Login nếu chưa đăng nhập, không lưu plaintext. Phase 2.
type: feature
module: SRS-16
prd_fr: FR-15
phase: 2
version: v1.2 LOCKED (post-prototype reconciliation)
---

# F16 — Authentication

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f15-settings.md](f15-settings.md), [f13-export-share.md](f13-export-share.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-05 password not plaintext, AC-NF-06 auth required)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Bổ sung UC-16-02 (Session token storage + ProtectedRoute) — token lưu `localStorage`, 401 anywhere → auto-logout + redirect `/login`. AC-16-05..08 mới.

## UC-16-01: Login

### Input
password (plaintext qua HTTPS)

### Process
hash(password) == stored password_hash

### Output
session token hoặc error

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-16-01 | Password đúng → redirect Dashboard |
| AC-16-02 | Password sai → error message, không tiết lộ thông tin |
| AC-16-03 | Chưa login → mọi route redirect Login |
| AC-16-04 | Password KHÔNG lưu plaintext trong DB |

## UC-16-02: Session Token Storage & Auto-Logout

### Login form

- **Single field:** ô `password` duy nhất (không có username — single-user MVP). Submit → `POST /api/auth/login` body `{password}`.
- **Success:** server trả token (JWT, expires_in 86400s = 24h). Client lưu `localStorage.token`, redirect `/` (Dashboard).
- **Failure:** error message "Sai mật khẩu" (không tiết lộ thông tin khác — AC-16-02).

### Token storage

- **Location:** `localStorage.token` (KHÔNG cookie). Lý do: single-user MVP, không cần SSR session, không cần cross-domain.
- **Header:** mọi request protected gửi `Authorization: Bearer {token}` (auto-injected bởi `apiFetch` wrapper — xem TAD g02 §5).

### Auto-logout

| AC ID | Criteria |
|---|---|
| AC-16-05 | Token sống ≤ 24h (theo JWT exp); sau 24h request trả 401 → client clear `localStorage.token` + redirect `/login` |
| AC-16-06 | Bất kỳ response 401 nào (token expired, invalid, missing) → client tự động logout (clear token + redirect) |
| AC-16-07 | User click logout icon ở header → clear `localStorage.token` + redirect `/login`; back button không khôi phục session |
| AC-16-08 | Route guard `ProtectedRoute` wrap toàn bộ app group `(app)`: nếu không có token trong localStorage → redirect `/login` ngay (client-side, không SSR) |

### Mock auth (cluster 1 prototype only)

Trong prototype MSW mock, token sinh dạng `MOCK_JWT_PREFIX + Date.now()` (không validate password thực). MVP backend phải replace bằng JWT thực với bcrypt password hash (xem TAD c08).
