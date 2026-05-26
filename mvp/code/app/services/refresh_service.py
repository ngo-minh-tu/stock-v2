"""Refresh background driver — TAD g01 §1 Flow 1.

POST /refresh/* trả 202 ngay; FastAPI BackgroundTasks gọi `run_refresh_*` trên threadpool.
Service tự open SessionLocal (background không có request scope), update job_lock progress
mỗi N tickers, release với status COMPLETED|FAILED ở cuối.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import asdict, dataclass, field

from app.constants.enums import RefreshStatus
from app.constants.sources import MACRO_GSO, MACRO_SBV, VNSTOCK_FINANCIAL, VNSTOCK_PRICE
from app.crawlers import cache_manager, macro_crawler
from app.crawlers.vnstock_client import VnstockClient, VnstockUnavailable
from app.db.session import SessionLocal
from app.job_lock import job_lock
from app.repositories import financial_repo, macro_repo, price_repo, stock_repo

logger = logging.getLogger(__name__)

# Test hook: cho phép test inject mock client thay real VnstockClient.
_client_factory: Callable[[], VnstockClient] = VnstockClient
_macro_fetcher = macro_crawler.fetch_macro_points
_last_price_retry_tickers: list[str] = []


@dataclass(slots=True)
class _PriceRefreshStats:
    total: int = 0
    full_universe: bool = False
    processed: int = 0
    success: int = 0
    failed: int = 0
    empty: int = 0
    rows: int = 0
    failed_tickers: list[str] = field(default_factory=list)
    empty_tickers: list[str] = field(default_factory=list)

    def as_job_stats(self) -> dict:
        return asdict(self)

    @property
    def complete_success(self) -> bool:
        return (
            self.full_universe
            and self.total > 0
            and self.success == self.total
            and self.failed == 0
            and self.empty == 0
        )


@dataclass(slots=True)
class _FinancialRefreshStats:
    total: int = 0
    full_universe: bool = False
    processed: int = 0
    success: int = 0
    failed: int = 0
    empty: int = 0
    rows: int = 0
    failed_tickers: list[str] = field(default_factory=list)
    empty_tickers: list[str] = field(default_factory=list)

    def as_job_stats(self) -> dict:
        return asdict(self)

    @property
    def complete_success(self) -> bool:
        return (
            self.full_universe
            and self.total > 0
            and self.success == self.total
            and self.failed == 0
            and self.empty == 0
        )


def _open_session():
    return SessionLocal()


def _recoverable_external_abort(e: BaseException) -> bool:
    """Some external libraries call sys.exit() for quota errors; treat that as job failure."""
    return isinstance(e, SystemExit)


def _select_price_tickers(db, *, tickers: list[str] | None, resume_failed: bool) -> tuple[list[str], bool]:
    active = stock_repo.list_active_tickers(db)
    active_set = set(active)
    if tickers:
        return [t.upper() for t in tickers if t.upper() in active_set], False
    if resume_failed:
        retry = [t for t in _last_price_retry_tickers if t in active_set]
        return retry, False
    return active, True


def _upsert_price_rows(rows: list[dict]) -> int:
    with _open_session() as db:
        count = price_repo.bulk_upsert(db, rows)
        db.commit()
        return count


def _upsert_financial_rows(rows: list[dict]) -> int:
    with _open_session() as db:
        count = financial_repo.bulk_upsert(db, rows)
        db.commit()
        return count


def _upsert_macro_rows(rows: list[dict]) -> int:
    with _open_session() as db:
        count = macro_repo.bulk_upsert(db, rows)
        db.commit()
        return count


def _mark_price_cache(stats: _PriceRefreshStats) -> None:
    if stats.success == 0:
        return
    status = "FRESH" if stats.complete_success else "PARTIAL"
    with _open_session() as db:
        cache_manager.mark_refreshed(db, VNSTOCK_PRICE.key, status=status)
        db.commit()


def _mark_financial_cache(stats: _FinancialRefreshStats) -> None:
    if stats.success == 0:
        return
    status = "FRESH" if stats.complete_success else "PARTIAL"
    with _open_session() as db:
        cache_manager.mark_refreshed(db, VNSTOCK_FINANCIAL.key, status=status)
        db.commit()


def _mark_macro_cache(*, success: bool) -> None:
    with _open_session() as db:
        status = "FRESH" if success else "PARTIAL"
        cache_manager.mark_refreshed(db, MACRO_SBV.key, status=status)
        cache_manager.mark_refreshed(db, MACRO_GSO.key, status=status)
        db.commit()


def _refresh_macro(client: VnstockClient) -> dict:
    points, errors = _macro_fetcher(vnstock_client=client)
    rows = [
        {
            "indicator": p.indicator,
            "period": p.period,
            "value": p.value,
            "source": p.source,
        }
        for p in points
    ]
    count = _upsert_macro_rows(rows)
    _mark_macro_cache(success=count > 0 and not errors)
    return {
        "processed": 5,
        "success": count,
        "failed": len(errors),
        "failed_indicators": errors,
        "rows": count,
    }


def _update_price_progress(job_id: str, stats: _PriceRefreshStats, *, message: str) -> None:
    progress = int(stats.processed / max(stats.total, 1) * 100)
    job_lock.update(
        job_id,
        progress=progress,
        message=message,
        stats=stats.as_job_stats(),
    )


def run_refresh_prices(
    job_id: str,
    *,
    tickers: list[str] | None = None,
    resume_failed: bool = False,
) -> None:
    """Refresh OHLCV cho tất cả 81 mã ACTIVE. Chạy trên thread pool (BackgroundTasks)."""
    logger.info("[%s] refresh_prices start", job_id)
    job_lock.update(job_id, status=RefreshStatus.RUNNING.value, progress=0, message="Đang tải giá...")
    stats = _PriceRefreshStats()
    try:
        client = _client_factory()
        with _open_session() as db:
            selected, stats.full_universe = _select_price_tickers(db, tickers=tickers, resume_failed=resume_failed)
        stats.total = len(selected)
        job_lock.update(job_id, stats=stats.as_job_stats())
        if not selected:
            job_lock.release(
                job_id,
                status=RefreshStatus.FAILED.value,
                error="No tickers selected for refresh",
            )
            return
        for i, ticker in enumerate(selected):
            try:
                rows = client.fetch_prices(ticker, days=365)
                if rows:
                    stats.rows += _upsert_price_rows(rows)
                    stats.success += 1
                else:
                    # Empty payload = không có dữ liệu mới ↛ KHÔNG tính success.
                    # Tránh trường hợp 81 ticker đều rỗng vẫn mark cache FRESH.
                    stats.empty += 1
                    stats.empty_tickers.append(ticker)
                    logger.warning("[%s] price empty %s", job_id, ticker)
            except VnstockUnavailable as e:
                stats.failed += 1
                stats.failed_tickers.append(ticker)
                logger.warning("[%s] price fail %s: %s", job_id, ticker, e)
            except Exception:
                stats.failed += 1
                stats.failed_tickers.append(ticker)
                logger.exception("[%s] unexpected price error %s", job_id, ticker)
            except BaseException as e:  # noqa: BLE001 — guard background job lock release
                if not _recoverable_external_abort(e):
                    raise
                stats.failed += 1
                stats.failed_tickers.append(ticker)
                logger.warning("[%s] price aborted by external library %s: %s", job_id, ticker, e)
            stats.processed = i + 1
            if (i + 1) % 5 == 0 or (i + 1) == stats.total:
                _update_price_progress(
                    job_id,
                    stats,
                    message=f"Đã xử lý {i + 1}/{stats.total} mã (lỗi: {stats.failed}, rỗng: {stats.empty})",
                )

        _mark_price_cache(stats)

        global _last_price_retry_tickers
        _last_price_retry_tickers = [*stats.failed_tickers, *stats.empty_tickers]
        job_lock.update(job_id, stats=stats.as_job_stats())
        if stats.success == 0:
            job_lock.release(job_id, status=RefreshStatus.FAILED.value, error=f"All {stats.total} tickers failed")
            logger.error("[%s] refresh_prices ALL failed", job_id)
        else:
            job_lock.release(job_id, status=RefreshStatus.COMPLETED.value)
            logger.info(
                "[%s] refresh_prices done — success=%d failed=%d empty=%d rows=%d",
                job_id,
                stats.success,
                stats.failed,
                stats.empty,
                stats.rows,
            )
    except BaseException as e:  # noqa: BLE001 — ensure background job reaches terminal state
        if not _recoverable_external_abort(e) and not isinstance(e, Exception):
            raise
        logger.exception("[%s] refresh_prices crashed", job_id)
        job_lock.update(job_id, stats=stats.as_job_stats())
        job_lock.release(job_id, status=RefreshStatus.FAILED.value, error=str(e))


def run_refresh_all(job_id: str) -> None:
    """Refresh prices + financials sequentially.

    Macro crawler runs after prices + financials. News has its own endpoint
    (`POST /api/news/refresh`) because it is user-visible and can be retried
    independently by source.
    """
    logger.info("[%s] refresh_all start", job_id)
    job_lock.update(job_id, status=RefreshStatus.RUNNING.value, progress=0, message="Đang tải giá...")

    try:
        client = _client_factory()

        # 1) Prices
        with _open_session() as db:
            tickers = stock_repo.list_active_tickers(db)
        price_stats = _PriceRefreshStats(total=len(tickers), full_universe=True)
        total = len(tickers) or 1
        for i, ticker in enumerate(tickers):
            try:
                rows = client.fetch_prices(ticker, days=365)
                if rows:
                    price_stats.rows += _upsert_price_rows(rows)
                    price_stats.success += 1
                else:
                    price_stats.empty += 1
                    price_stats.empty_tickers.append(ticker)
                    logger.warning("[%s] price empty %s", job_id, ticker)
            except VnstockUnavailable as e:
                price_stats.failed += 1
                price_stats.failed_tickers.append(ticker)
                logger.warning("[%s] price fail %s: %s", job_id, ticker, e)
            except Exception as e:  # noqa: BLE001 — log mọi lỗi, continue
                price_stats.failed += 1
                price_stats.failed_tickers.append(ticker)
                logger.warning("[%s] price fail %s: %s", job_id, ticker, e)
            except BaseException as e:  # noqa: BLE001 — guard background job lock release
                if not _recoverable_external_abort(e):
                    raise
                price_stats.failed += 1
                price_stats.failed_tickers.append(ticker)
                logger.warning("[%s] price aborted by external library %s: %s", job_id, ticker, e)
            price_stats.processed = i + 1
            if (i + 1) % 5 == 0 or (i + 1) == total:
                job_lock.update(
                    job_id,
                    progress=int((i + 1) / total * 50),  # prices = nửa đầu
                    message=f"Giá {i + 1}/{total}",
                    stats={"prices": price_stats.as_job_stats()},
                )
        _mark_price_cache(price_stats)

        # 2) Financials
        job_lock.update(
            job_id,
            progress=50,
            message="Đang tải BCTC...",
            stats={"prices": price_stats.as_job_stats()},
        )
        with _open_session() as db:
            tickers = stock_repo.list_active_tickers(db)
        financial_stats = _FinancialRefreshStats(total=len(tickers), full_universe=True)
        total = len(tickers) or 1
        for i, ticker in enumerate(tickers):
            try:
                rows = client.fetch_financials(ticker)
                if rows:
                    financial_stats.rows += _upsert_financial_rows(rows)
                    financial_stats.success += 1
                else:
                    financial_stats.empty += 1
                    financial_stats.empty_tickers.append(ticker)
                    logger.warning("[%s] financial empty %s", job_id, ticker)
            except VnstockUnavailable as e:
                financial_stats.failed += 1
                financial_stats.failed_tickers.append(ticker)
                logger.warning("[%s] financial fail %s: %s", job_id, ticker, e)
            except Exception as e:  # noqa: BLE001 — log mọi lỗi, continue
                financial_stats.failed += 1
                financial_stats.failed_tickers.append(ticker)
                logger.warning("[%s] fin fail %s: %s", job_id, ticker, e)
            except BaseException as e:  # noqa: BLE001 — guard background job lock release
                if not _recoverable_external_abort(e):
                    raise
                financial_stats.failed += 1
                financial_stats.failed_tickers.append(ticker)
                logger.warning("[%s] financial aborted by external library %s: %s", job_id, ticker, e)
            financial_stats.processed = i + 1
            if (i + 1) % 10 == 0 or (i + 1) == total:
                job_lock.update(
                    job_id,
                    progress=50 + int((i + 1) / total * 50),
                    message=f"BCTC {i + 1}/{total}",
                    stats={
                        "prices": price_stats.as_job_stats(),
                        "financials": financial_stats.as_job_stats(),
                    },
                )
        _mark_financial_cache(financial_stats)
        job_lock.update(
            job_id,
            progress=95,
            message="Đang tải macro...",
            stats={
                "prices": price_stats.as_job_stats(),
                "financials": financial_stats.as_job_stats(),
            },
        )
        macro_stats = _refresh_macro(client)
        job_lock.update(
            job_id,
            progress=100,
            message="Hoàn tất refresh",
            stats={
                "prices": price_stats.as_job_stats(),
                "financials": financial_stats.as_job_stats(),
                "macro": macro_stats,
            },
        )

        if price_stats.success == 0:
            job_lock.release(
                job_id,
                status=RefreshStatus.FAILED.value,
                error="No prices fetched (vnstock unavailable hoặc all failed)",
            )
        else:
            job_lock.release(job_id, status=RefreshStatus.COMPLETED.value)
        logger.info("[%s] refresh_all done", job_id)
    except BaseException as e:  # noqa: BLE001 — ensure background job reaches terminal state
        if not _recoverable_external_abort(e) and not isinstance(e, Exception):
            raise
        logger.exception("[%s] refresh_all crashed", job_id)
        job_lock.release(job_id, status=RefreshStatus.FAILED.value, error=str(e))
