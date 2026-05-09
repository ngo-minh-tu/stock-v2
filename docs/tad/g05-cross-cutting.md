---
id: g05
title: Cross-cutting — Concurrency Control, Logging, Error Response Standard
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§6, §20, §21)
---

# g05 — Cross-cutting

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

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
