---
id: c08
title: Auth & Session — JWT, single-password login
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§18); cluster 1 reconciliation 2026-05-09
version: v1.2 LOCKED (post-prototype reconciliation)
---

# c08 — Auth & Session

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f16-authentication.md](../srs/f16-authentication.md)
>
> Related — global: [g02-api.md](g02-api.md) (`POST /auth/login`, `PUT /auth/password`; `Authorization: Bearer` header on all protected routes), [g03-database.md](g03-database.md) (`user_profile` table — bcrypt password hash), [g07-deployment.md](g07-deployment.md) (`SECRET_KEY`, `JWT_EXPIRY_HOURS`, `INITIAL_PASSWORD` env vars)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Bổ sung §3 Frontend Session Storage (localStorage + ProtectedRoute pattern) và §4 Mock auth handler (prototype-only).

---

## 1. MVP Wording

> [v1.1 MUST-FIX 6] Chốt wording

**MVP Auth = single-password login form + JWT session.** PRD gọi "Basic Auth" theo nghĩa bảo vệ đơn giản, không phải HTTP Basic Auth protocol.

---

## 2. Flow

```
POST /auth/login → body: {password} → response: {token, expires_in: 86400}
All routes: Authorization: Bearer {token}
Unauthenticated → 401 → redirect /login
Password: bcrypt hash. JWT expires 24h. Single user.
```

---

## 3. Frontend Session Storage

> [v1.2] Chốt từ cluster 1 prototype

**Storage:** `localStorage.token` (KHÔNG cookie). Lý do: single-user MVP, không có SSR session, không cần cross-domain, không cần CSRF protection. Cookie sẽ thêm complexity (SameSite, HttpOnly, Secure flags) không cần thiết cho scope MVP.

**ProtectedRoute pattern:**

```tsx
// frontend/src/components/auth/ProtectedRoute.tsx (cluster 1)
'use client';
const { token, ready } = useAuth();
useEffect(() => {
  if (ready && !token) router.replace('/login');
}, [token, ready]);
if (!ready || !token) return null;  // gate render
return <>{children}</>;
```

Wrap toàn bộ Next.js App Router group `(app)` (file `(app)/layout.tsx`). Login page nằm ngoài group, không bị gate.

**Auto-logout trên 401:** `apiFetch` wrapper (xem [g02 §5](g02-api.md)) catch response 401, clear `localStorage.token`, redirect `/login`. Không retry, không refresh token (single-user MVP, user re-login bằng password).

---

## 4. Mock Auth Handler (Prototype only)

Prototype dùng MSW handler giả lập `POST /api/auth/login`:
- Accept bất kỳ password (không validate)
- Return token = `MOCK_JWT_PREFIX + Date.now()` (định nghĩa trong [g03 §L](../srs/g03-appendix-enums-constants.md))
- expires_in = 86400

**MVP backend phải replace** bằng FastAPI endpoint thực: bcrypt verify → JWT sign với `SECRET_KEY` → return real token. Frontend code KHÔNG cần đổi (apiFetch + ProtectedRoute giữ nguyên).
