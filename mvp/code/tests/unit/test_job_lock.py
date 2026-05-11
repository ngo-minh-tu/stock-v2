"""JobLock thread-safe singleton — TAD g05 §1."""

from app.job_lock import JobLock


def test_acquire_succeeds_when_idle():
    lock = JobLock()
    assert lock.try_acquire("job_1", "refresh") is True
    assert lock.active_job == "job_1"
    assert lock.active_type == "refresh"


def test_acquire_fails_when_held():
    lock = JobLock()
    lock.try_acquire("job_1", "refresh")
    assert lock.try_acquire("job_2", "screening") is False
    assert lock.active_job == "job_1"  # unchanged


def test_release_clears_active_and_records_terminal():
    lock = JobLock()
    lock.try_acquire("job_1", "refresh")
    lock.release("job_1", status="COMPLETED")
    assert lock.active_job is None
    snap = lock.get("job_1")
    assert snap is not None
    assert snap["status"] == "COMPLETED"
    assert snap["progress"] == 100
    assert snap["finished_at"] is not None


def test_release_with_error_records_message():
    lock = JobLock()
    lock.try_acquire("job_1", "refresh")
    lock.release("job_1", status="FAILED", error="boom")
    snap = lock.get("job_1")
    assert snap["status"] == "FAILED"
    assert snap["error"] == "boom"


def test_update_progress_and_message():
    lock = JobLock()
    lock.try_acquire("job_1", "refresh")
    lock.update("job_1", status="RUNNING", progress=42, message="halfway")
    snap = lock.get("job_1")
    assert snap["status"] == "RUNNING"
    assert snap["progress"] == 42
    assert snap["message"] == "halfway"


def test_get_unknown_returns_none():
    lock = JobLock()
    assert lock.get("nonexistent") is None


def test_release_preserves_registry_for_completed_job():
    lock = JobLock()
    lock.try_acquire("job_1", "refresh")
    lock.release("job_1", status="COMPLETED")
    # New job can be acquired
    assert lock.try_acquire("job_2", "screening") is True
    # Old job snapshot still queryable
    assert lock.get("job_1")["status"] == "COMPLETED"


def test_reset_clears_all():
    lock = JobLock()
    lock.try_acquire("job_1", "refresh")
    lock.update("job_1", progress=50)
    lock.reset()
    assert lock.active_job is None
    assert lock.get("job_1") is None
