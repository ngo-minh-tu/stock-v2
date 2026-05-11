"""Refresh background driver — TAD g01 §1 Flow 1.

POST /refresh/* trả 202 ngay; FastAPI BackgroundTasks gọi `run_refresh_*` trên threadpool.
Service tự open SessionLocal (background không có request scope), update job_lock progress
mỗi N tickers, release với status COMPLETED|FAILED ở cuối.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from app.constants.enums import RefreshStatus
from app.constants.sources import VNSTOCK_FINANCIAL, VNSTOCK_PRICE
from app.crawlers import cache_manager
from app.crawlers.vnstock_client import VnstockClient, VnstockUnavailable
from app.db.session import SessionLocal
from app.job_lock import job_lock
from app.repositories import price_repo, stock_repo

logger = logging.getLogger(__name__)

# Test hook: cho phép test inject mock client thay real VnstockClient.
_client_factory: Callable[[], VnstockClient] = VnstockClient


def _open_session():
    return SessionLocal()


def run_refresh_prices(job_id: str) -> None:
    """Refresh OHLCV cho tất cả 81 mã ACTIVE. Chạy trên thread pool (BackgroundTasks)."""
    logger.info("[%s] refresh_prices start", job_id)
    job_lock.update(job_id, status=RefreshStatus.RUNNING.value, progress=0, message="Đang tải giá...")
    try:
        client = _client_factory()
        with _open_session() as db:
            tickers = stock_repo.list_active_tickers(db)
            total = len(tickers) or 1
            success = 0
            fail = 0
            for i, ticker in enumerate(tickers):
                try:
                    rows = client.fetch_prices(ticker, days=365)
                    if rows:
                        price_repo.bulk_upsert(db, rows)
                    success += 1
                except VnstockUnavailable as e:
                    fail += 1
                    logger.warning("[%s] price fail %s: %s", job_id, ticker, e)
                except Exception:
                    fail += 1
                    logger.exception("[%s] unexpected price error %s", job_id, ticker)
                if (i + 1) % 5 == 0 or (i + 1) == total:
                    job_lock.update(
                        job_id,
                        progress=int((i + 1) / total * 100),
                        message=f"Đã xử lý {i + 1}/{total} mã (lỗi: {fail})",
                    )

            # All-or-mostly-failed → still mark refreshed (cache row gets STALE if 0 success).
            if success > 0:
                cache_manager.mark_refreshed(db, VNSTOCK_PRICE.key, status="FRESH")
            db.commit()

        if success == 0:
            job_lock.release(job_id, status=RefreshStatus.FAILED.value, error=f"All {total} tickers failed")
            logger.error("[%s] refresh_prices ALL failed", job_id)
        else:
            job_lock.release(job_id, status=RefreshStatus.COMPLETED.value)
            logger.info("[%s] refresh_prices done — success=%d fail=%d", job_id, success, fail)
    except Exception as e:
        logger.exception("[%s] refresh_prices crashed", job_id)
        job_lock.release(job_id, status=RefreshStatus.FAILED.value, error=str(e))


def run_refresh_all(job_id: str) -> None:
    """Refresh prices + financials sequentially.

    News + macro: stub (Phase post-MVP wire real). Job lock chỉ marked completed sau khi cả 2
    bước price + financial chạy xong.
    """
    logger.info("[%s] refresh_all start", job_id)
    job_lock.update(job_id, status=RefreshStatus.RUNNING.value, progress=0, message="Đang tải giá...")

    try:
        client = _client_factory()

        # 1) Prices
        with _open_session() as db:
            tickers = stock_repo.list_active_tickers(db)
            total = len(tickers) or 1
            success_p = 0
            for i, ticker in enumerate(tickers):
                try:
                    rows = client.fetch_prices(ticker, days=365)
                    if rows:
                        price_repo.bulk_upsert(db, rows)
                    success_p += 1
                except (VnstockUnavailable, Exception) as e:  # noqa: BLE001 — log mọi lỗi, continue
                    logger.warning("[%s] price fail %s: %s", job_id, ticker, e)
                if (i + 1) % 5 == 0 or (i + 1) == total:
                    job_lock.update(
                        job_id,
                        progress=int((i + 1) / total * 50),  # prices = nửa đầu
                        message=f"Giá {i + 1}/{total}",
                    )
            if success_p > 0:
                cache_manager.mark_refreshed(db, VNSTOCK_PRICE.key)
            db.commit()

        # 2) Financials (stub trong MVP)
        job_lock.update(
            job_id,
            progress=50,
            message="Đang tải BCTC...",
        )
        with _open_session() as db:
            tickers = stock_repo.list_active_tickers(db)
            total = len(tickers) or 1
            for i, ticker in enumerate(tickers):
                try:
                    client.fetch_financials(ticker)  # stub: returns []
                except Exception as e:  # noqa: BLE001
                    logger.warning("[%s] fin fail %s: %s", job_id, ticker, e)
                if (i + 1) % 10 == 0 or (i + 1) == total:
                    job_lock.update(
                        job_id,
                        progress=50 + int((i + 1) / total * 50),
                        message=f"BCTC {i + 1}/{total}",
                    )
            cache_manager.mark_refreshed(db, VNSTOCK_FINANCIAL.key)
            db.commit()

        if success_p == 0:
            job_lock.release(
                job_id,
                status=RefreshStatus.FAILED.value,
                error="No prices fetched (vnstock unavailable hoặc all failed)",
            )
        else:
            job_lock.release(job_id, status=RefreshStatus.COMPLETED.value)
        logger.info("[%s] refresh_all done", job_id)
    except Exception as e:
        logger.exception("[%s] refresh_all crashed", job_id)
        job_lock.release(job_id, status=RefreshStatus.FAILED.value, error=str(e))
