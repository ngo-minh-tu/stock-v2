---
id: c08
title: Auth & Session — JWT, single-password login
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§18)
---

# c08 — Auth & Session

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f16-authentication.md](../srs/f16-authentication.md)
>
> Related — global: [g02-api.md](g02-api.md) (`POST /auth/login`, `PUT /auth/password`; `Authorization: Bearer` header on all protected routes), [g03-database.md](g03-database.md) (`user_profile` table — bcrypt password hash), [g07-deployment.md](g07-deployment.md) (`SECRET_KEY`, `JWT_EXPIRY_HOURS`, `INITIAL_PASSWORD` env vars)

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
