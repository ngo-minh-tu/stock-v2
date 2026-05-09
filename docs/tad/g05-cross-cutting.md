---
id: g05
title: Cross-cutting — Concurrency Control, Logging, Error Response Standard
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§6, §20, §21); cluster 1 reconciliation 2026-05-09
version: v1.2 LOCKED (post-prototype reconciliation)
---

# g05 — Cross-cutting

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Bổ sung §4 (Frontend Provider Stack pointer → c09 §3) và §5 (MSW dev mock boundary — catch-all 404 NOT_IMPLEMENTED, prototype-only).

---

## 1. Concurrency Control

> [v1.1 FIX] Single heavy job lock — refresh và screening KHÔNG chạy đồng thời

**MVP strict rule:** Only ONE heavy job can run at any time. Heavy jobs = refresh_all, refresh_prices, refresh_news, screening_run, backtest. If any heavy job is active, new heavy job request returns 409 CONFLICT. Refresh and screening CANNOT run concurrently in MVP.

```python
# job_lock.py
import threading

class JobLock:
    def __init__(self):
        self._lock = threading.Lock()
        self._active_job: str | None = None

    def acquire(self, job_type: str) -> bool:
        with self._lock:
            if self._active_job is not None:
                return False
            self._active_job = job_type
            return True

    def release(self):
        with self._lock:
            self._active_job = None

    @property
    def active_job(self) -> str | None:
        return self._active_job

job_lock = JobLock()  # singleton
```

**API behavior khi bị lock:**
```json
409 CONFLICT
{
  "success": false,
  "error": {
    "code": "JOB_CONFLICT",
    "message": "Đang có tác vụ chạy: {active_job}. Vui lòng đợi hoàn thành."
  }
}
```

---

## 2. Logging

```python
# Structured logging
{
  "timestamp": "...",
  "level": "INFO|WARNING|ERROR",
  "module": "screening_service",
  "run_id": "run_...",
  "message": "...",
  "metrics": {}
}
```

File: `backend/logs/app.log`

---

## 3. Error Response Standard

```json
{
  "success": false,
  "error": {
    "code": "ERR-01-01",
    "message": "Human-readable message",
    "detail": "Technical detail (optional)"
  }
}
```

**409 CONFLICT** for job lock violations.
**400** for validation. **401** unauthorized. **404** not found. **500** internal.

---

## 4. Frontend Provider Stack

> [v1.2] Chốt từ cluster 1 — chi tiết tại [c09 §3](c09-theme-i18n.md)

Outer → inner: `MswBootstrap` → `LocaleProvider` → `ThemeProvider` → `AuthProvider`. ProtectedRoute wrap riêng `(app)` group, không wrap toàn app (login page nằm ngoài).

---

## 5. MSW Dev Mock Boundary

> [v1.2] Prototype-only — production frontend gọi backend FastAPI thực

**Worker location:** `frontend/public/mockServiceWorker.js` (generate bằng `npx msw init public/`).

**Bootstrap pattern (`<MswBootstrap>` component):**
- Chỉ start MSW worker ở dev (`process.env.NODE_ENV === 'development'`).
- Gate render children cho tới khi worker `start()` resolve. Lý do: nếu render trước, `apiFetch` gọi network thực → 404 từ Next.js.
- Production build: component pass-through, không bundle MSW.

**Catch-all handler:**

```ts
// frontend/src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // ... explicit handlers ...

  // Catch-all: bất kỳ /api/* nào chưa mock → 404 envelope với VN message
  http.all('/api/*', () => {
    return HttpResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Endpoint chưa được mock — cluster sau sẽ implement.',
        },
      },
      { status: 404 }
    );
  }),
];
```

**Lý do catch-all:** trong dev, nếu component gọi endpoint chưa mock, dev sẽ thấy ngay error message tiếng Việt rõ ràng (qua toast của apiFetch) thay vì silent fail hoặc cryptic CORS error. Phát hiện sớm gap mock.

**MVP migration:** xóa toàn bộ `frontend/src/mocks/` và `<MswBootstrap>`, replace bằng env var `NEXT_PUBLIC_API_BASE_URL` trỏ tới backend FastAPI. `apiFetch` không cần đổi.
