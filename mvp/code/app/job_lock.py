"""Single heavy-job lock + in-memory job registry — TAD g05 §1 + g01 §1.

**Rule:** chỉ MỘT heavy job chạy tại bất kỳ thời điểm. Heavy jobs = refresh_*, screening, backtest.
Caller `try_acquire(job_id, type)` → bool. Acquire fail → API trả 409 ERR-JOB-CONFLICT.

Registry là in-memory dict (TAD g01 §1: KHÔNG persist sang DB cho MVP). Restart process =
mất status job đang chạy (acceptable trade-off cho local single-instance).
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class JobLock:
    """Singleton — import `from app.job_lock import job_lock`.

    Thread-safe. `threading.Lock` thay vì asyncio.Lock vì FastAPI BackgroundTasks
    chạy sync function trên threadpool.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._active_job: str | None = None
        self._active_type: str | None = None
        self._registry: dict[str, dict[str, Any]] = {}

    def try_acquire(self, job_id: str, job_type: str) -> bool:
        """Atomic: check no active → set active + create registry entry. Return True nếu acquire OK."""
        with self._lock:
            if self._active_job is not None:
                return False
            self._active_job = job_id
            self._active_type = job_type
            self._registry[job_id] = {
                "job_id": job_id,
                "type": job_type,
                "status": "PENDING",
                "progress": 0,
                "message": "",
                "started_at": _now_iso(),
                "finished_at": None,
                "error": None,
            }
            return True

    def update(self, job_id: str, *, status: str | None = None, progress: int | None = None,
               message: str | None = None) -> None:
        with self._lock:
            entry = self._registry.get(job_id)
            if entry is None:
                return
            if status is not None:
                entry["status"] = status
            if progress is not None:
                entry["progress"] = progress
            if message is not None:
                entry["message"] = message

    def release(self, job_id: str, *, status: str, error: str | None = None) -> None:
        """Mark job terminal + clear active slot (nếu match)."""
        with self._lock:
            entry = self._registry.get(job_id)
            if entry is not None:
                entry["status"] = status
                entry["finished_at"] = _now_iso()
                entry["progress"] = 100 if status == "COMPLETED" else entry["progress"]
                if error is not None:
                    entry["error"] = error
            if self._active_job == job_id:
                self._active_job = None
                self._active_type = None

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            entry = self._registry.get(job_id)
            return dict(entry) if entry else None

    @property
    def active_job(self) -> str | None:
        with self._lock:
            return self._active_job

    @property
    def active_type(self) -> str | None:
        with self._lock:
            return self._active_type

    def reset(self) -> None:
        """Test-only: clear lock + registry."""
        with self._lock:
            self._active_job = None
            self._active_type = None
            self._registry.clear()


job_lock = JobLock()
