"""financial_repo.bulk_upsert — Phase 21 no-downgrade policy.

When a fallback source (KBS) returns a sparse row for an existing (ticker, period),
the previously-upserted richer row must NOT have its non-null fields overwritten
with None. Codex Phase 17/18 review identified this as a High finding.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from app.repositories import financial_repo

# `VHM` exists in the seed; the FK on financial_reports → stocks needs an existing ticker.
# We use a synthetic period that no other test or seed touches so the snapshot/restore
# stays scoped to this test file.
TICKER = "VHM"
PERIOD = "2099Q1"  # far-future synthetic — won't collide with real data


def _rich_row() -> dict:
    return {
        "ticker": TICKER,
        "period": PERIOD,
        "year": 2099,
        "quarter": 1,
        "revenue": 100.0,
        "net_income": 12.0,
        "total_assets": 500.0,
        "total_equity": 200.0,
        "total_debt": 300.0,
        "current_assets": 150.0,
        "current_liabilities": 80.0,
        "inventory": 40.0,
        "cogs": 70.0,
        "operating_cash_flow": 20.0,
        "eps": 1200.0,
        "bvps": 20_000.0,
        "advances": 30.0,
        "shares_outstanding": 1_000_000,
        "audit_opinion": "UNQUALIFIED",
    }


@pytest.fixture(autouse=True)
def _cleanup_synthetic_row():
    from app.db.session import SessionLocal
    from app.models.financial import FinancialReport

    def wipe():
        with SessionLocal() as db:
            db.query(FinancialReport).filter(
                FinancialReport.ticker == TICKER,
                FinancialReport.period == PERIOD,
            ).delete()
            db.commit()

    wipe()
    yield
    wipe()


def test_bulk_upsert_no_downgrade_keeps_existing_non_null():
    """Sparse upsert for same (ticker, period) must coalesce — not wipe richer fields to NULL."""
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        financial_repo.bulk_upsert(db, [_rich_row()])
        db.commit()

        # Sparse upsert — only revenue updated, everything else absent (None).
        sparse = [{
            "ticker": TICKER,
            "period": PERIOD,
            "year": 2099,
            "quarter": 1,
            "revenue": 110.0,
        }]
        financial_repo.bulk_upsert(db, sparse)
        db.commit()

        report = next(
            r for r in financial_repo.list_latest(db, TICKER, limit=12)
            if r.period == PERIOD
        )

        # revenue updated
        assert float(report.revenue) == 110.0
        # everything else preserved
        assert float(report.net_income) == 12.0
        assert float(report.total_assets) == 500.0
        assert float(report.total_equity) == 200.0
        assert float(report.total_debt) == 300.0
        assert float(report.current_assets) == 150.0
        assert float(report.current_liabilities) == 80.0
        assert float(report.inventory) == 40.0
        assert float(report.cogs) == 70.0
        assert float(report.operating_cash_flow) == 20.0
        assert float(report.eps) == 1200.0
        assert Decimal(str(report.bvps)) == Decimal("20000.0")
        assert float(report.advances) == 30.0
        assert int(report.shares_outstanding) == 1_000_000
        assert report.audit_opinion == "UNQUALIFIED"


def test_bulk_upsert_overwrites_field_when_new_value_non_null():
    """Sanity: non-null new values DO overwrite — only None gets coalesced from existing."""
    from app.db.session import SessionLocal

    with SessionLocal() as db:
        financial_repo.bulk_upsert(db, [_rich_row()])
        db.commit()

        updated = [{
            "ticker": TICKER,
            "period": PERIOD,
            "year": 2099,
            "quarter": 1,
            "revenue": 150.0,
            "net_income": 18.0,
            "total_assets": 510.0,
        }]
        financial_repo.bulk_upsert(db, updated)
        db.commit()

        report = next(
            r for r in financial_repo.list_latest(db, TICKER, limit=12)
            if r.period == PERIOD
        )
        assert float(report.revenue) == 150.0
        assert float(report.net_income) == 18.0
        assert float(report.total_assets) == 510.0
        # Untouched fields still preserved
        assert float(report.total_equity) == 200.0
        assert float(report.bvps) == 20_000.0
