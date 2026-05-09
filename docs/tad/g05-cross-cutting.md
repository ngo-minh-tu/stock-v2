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
- **v1.3 (2026-05-09, cluster 2 reconciliation):** ❌ REMOVED §4 placeholder pointer-to-c09 → ✅ REPLACED bằng full provider stack expanded 4 → 7 layers (cluster 2 thêm 3 contexts: Toast, MockOutcome, Run). Justification cho từng vị trí.

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

## 4. Frontend Provider Stack (7 layers)

> [v1.3] Mở rộng từ 4 → 7 layers ở cluster 2. Outer → inner:

```tsx
<ToastProvider>             {/* [v1.3] toast viewport — Run/Auth gọi useToast */}
  <MockOutcomeProvider>     {/* [v1.3] dev-only outcome toggle, persist localStorage */}
    <MswBootstrap>          {/* dev only: gate child render until MSW ready */}
      <LocaleProvider>      {/* next-intl wrapper, đọc localStorage.locale */}
        <ThemeProvider>     {/* data-theme attr management, đọc localStorage.theme */}
          <AuthProvider>    {/* token state, đọc localStorage.token */}
            <RunProvider>   {/* [v1.3] activeRunId + lastCompletedRunId + polling */}
              {children}
            </RunProvider>
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </MswBootstrap>
  </MockOutcomeProvider>
</ToastProvider>
```

**Order rationale:**

| Layer | Tại sao ở vị trí này |
|---|---|
| ToastProvider | Outermost: RunProvider + AuthProvider call `useToast()` để show success/error toast → phải tồn tại trước cả 2 |
| MockOutcomeProvider | Outer than Auth: dev tester có thể toggle outcome trước khi login |
| MswBootstrap | Outer than network-callers (Auth, Run): MSW phải start trước mọi `apiFetch` |
| LocaleProvider | Outer than Theme: theme switcher hiển thị label theo locale (Sáng/Tối vs Light/Dark) |
| ThemeProvider | Outer than Auth: toàn app (kể cả `/login`) có theme đúng |
| AuthProvider | Outer than Run: RunProvider check token validity trước khi gọi `/api/run` |
| RunProvider | Innermost: hooks/components mọi page (`useRun`) gọi context |

**ProtectedRoute** wrap riêng Next.js group `(app)`, không wrap toàn app (login page nằm ngoài). Xem [c08 §3](c08-auth.md).

**Cluster 1 vs cluster 2:**
- Cluster 1: 4 layers (Msw → Locale → Theme → Auth)
- Cluster 2: +3 layers (Toast outer, MockOutcome outer than Msw, Run innermost)
- Cluster 6 dự kiến: +1 ShareProvider cho `/share/[token]` public route — sẽ port khi reconcile cluster 6

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
