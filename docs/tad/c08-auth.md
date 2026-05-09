---
id: c08
title: Auth & Session — JWT, single-password login
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§18); cluster 1 reconciliation 2026-05-09
version: v1.4 LOCKED (cluster 6 reconciliation)
---

# c08 — Auth & Session

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f16-authentication.md](../srs/f16-authentication.md), [../srs/f15-settings.md](../srs/f15-settings.md) (§UC-15-06 Password Change)
>
> Related — global: [g02-api.md](g02-api.md) (`POST /auth/login`, `PUT /auth/password`; `Authorization: Bearer` header on all protected routes), [g03-database.md](g03-database.md) (`user_profile` table — bcrypt password hash), [g07-deployment.md](g07-deployment.md) (`SECRET_KEY`, `JWT_EXPIRY_HOURS`, `INITIAL_PASSWORD` env vars)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Bổ sung §3 Frontend Session Storage (localStorage + ProtectedRoute pattern) và §4 Mock auth handler (prototype-only).
- **v1.4 (2026-05-09, cluster 6 reconciliation):** ➕ Bổ sung §5 Password Change Flow (PUT /auth/password validate + return new token + frontend localStorage update + skip AuthContext setter).

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

---

## 5. Password Change Flow (Cluster 6)

### 5.1 Frontend `<PasswordChangeForm>`

Settings page CollapsibleSection "Bảo mật" (xem [f15 §UC-15-06](../srs/f15-settings.md)):

```tsx
const [current, setCurrent] = useState('');
const [next, setNext]       = useState('');
const [confirm, setConfirm] = useState('');
const [error, setError]     = useState<string | null>(null);

async function onSubmit() {
  // 3 client-side rules
  if (!current) return setError('Vui lòng nhập mật khẩu hiện tại');
  if (next.length < 8) return setError('Mật khẩu mới phải có ít nhất 8 ký tự');
  if (next !== confirm) return setError('Mật khẩu xác nhận không khớp');

  try {
    const { token } = await apiFetch<{ token: string }>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current, new: next }),
    });
    // KHÔNG dùng AuthContext.setToken — write localStorage trực tiếp
    localStorage.setItem('token', token);
    toast.success('Đã đổi mật khẩu');
    setCurrent(''); setNext(''); setConfirm('');
  } catch (e) {
    setError(e.message);
  }
}
```

### 5.2 Why Skip `AuthContext.setToken`?

`AuthContext` (cluster 1) cung cấp `useAuth()` với `{ token, ready, login, logout }`. **KHÔNG** có `setToken` setter (chỉ login flow gán token + logout flow clear).

PasswordChangeForm cần update token sau khi đổi password — option:
1. ❌ Add `setToken` to AuthContext (thêm API mới, breaking)
2. ✅ Write localStorage trực tiếp + leave AuthContext state unchanged

**Chọn (2)** vì:
- `AuthContext.token` state đã hydrate (non-null) → user vẫn coi là authenticated → KHÔNG re-render gate logic.
- `apiFetch` reads `localStorage.token` mỗi request → token mới được dùng tự động cho subsequent calls.
- Skip API surface change → backwards-compatible.

**Trade-off:** nếu sau này có UI hiển thị `useAuth().token` (vd. badge in header) → cần wire setter. Hiện tại không có use-case → defer.

### 5.3 Server Mock Handler (Prototype)

```ts
// MSW: PUT /api/auth/password
http.put('/api/auth/password', async ({ request }) => {
  const { current, new: newPassword } = await request.json();

  // Mock: accept bất kỳ current (không validate vì mock JWT prefix)
  if (!current) return errorResponse('ERR-AUTH-01', 'Mật khẩu hiện tại bắt buộc', 400);
  if (newPassword.length < 8) return errorResponse('ERR-AUTH-02', 'Mật khẩu mới phải ≥8 ký tự', 400);

  // Generate new mock token
  const newToken = `${MOCK_JWT_PREFIX}${Date.now()}`;
  return HttpResponse.json({ success: true, data: { token: newToken } });
});
```

### 5.4 Production Backend

FastAPI endpoint:
1. Verify JWT `Authorization: Bearer` header (current session valid).
2. bcrypt verify `current` against `user_profile.password_hash`.
3. Validate `new` (≥8 chars, complexity rules nếu cần).
4. bcrypt hash `new` → write `user_profile.password_hash` + bump `updated_at`.
5. Sign new JWT → return `{token: new_jwt}`.

Frontend KHÔNG cần đổi.

### 5.5 Acceptance Criteria

| AC | Criteria |
|---|---|
| AC-c08-01 | PUT `/api/auth/password` validate current + new ≥8 chars + return new token; frontend write localStorage trực tiếp (KHÔNG qua AuthContext setter) |
| AC-c08-02 | Sau đổi password, subsequent API calls dùng token mới tự động (apiFetch reads localStorage mỗi request) |
