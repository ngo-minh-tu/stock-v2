"""Phase 26 — KBS raw DataFrame snapshot fixture.

Synthetic snapshot KBS-shape (item × period) cho 1 ticker đại diện (NLG-like).
Goal: regression guard cho parser khi vnstock thay đổi KBS schema (column rename,
item_id pattern drift, hierarchy prefix change).

KHÔNG capture real KBS response — tránh PII + license issue. Snapshot reflects
Phase 17-22 observed shape:
  - Columns: `item_id`, `item_en`, `item`, plus `2026-Q1`, `2025-Q4`, `2025-Q4_1`
    (restated collision), `2025-Q3`, `2025-Q2`.
  - Item_id prefixes: `n_1.`, `n_18.`, `a.`, `b.`, `c.`, `d.`, `i.`, `iv.`.
  - Includes grand-total row (`total_owners_equity_and_liabilities`) — must be
    blocklisted by parser.
  - Includes header NaN row (`tai_san`) — must be skipped.

Golden assertions per period dưới — nếu parser future drift, test fail và force
review trước khi ship.
"""

from __future__ import annotations

import math

import pandas as pd


def kbs_income_statement_snapshot() -> pd.DataFrame:
    """KBS income_statement shape — revenue + net_income + EPS per quarter."""
    return pd.DataFrame(
        [
            {
                "item_id": "n_1.revenue",
                "item_en": "Net sales",
                "item": "Doanh thu thuần",
                "2026-Q1": 1_279_000.0,  # ngàn đồng — KBS unit; ×1000 sau Phase 22
                "2025-Q4": 1_500_000.0,
                "2025-Q4_1": 1_490_000.0,  # restated — base wins (Phase 26)
                "2025-Q3": 1_100_000.0,
                "2025-Q2": 980_000.0,
            },
            {
                "item_id": "n_5.cost_of_goods_sold",
                "item_en": "Cost of goods sold",
                "item": "Giá vốn",
                "2026-Q1": 900_000.0,
                "2025-Q4": 1_050_000.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 800_000.0,
                "2025-Q2": 700_000.0,
            },
            {
                "item_id": "n_18.net_profit_after_tax",
                "item_en": "Net profit after tax",
                "item": "Lợi nhuận sau thuế",
                "2026-Q1": 348_000.0,
                "2025-Q4": 420_000.0,
                "2025-Q4_1": 415_000.0,
                "2025-Q3": 290_000.0,
                "2025-Q2": 250_000.0,
            },
            {
                "item_id": "n_19.earnings_per_share_vnd",
                "item_en": "EPS (VND/share)",
                "item": "EPS",
                "2026-Q1": 679.0,  # per-share VND — NOT scaled
                "2025-Q4": 820.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 565.0,
                "2025-Q2": 487.0,
            },
        ]
    )


def kbs_balance_sheet_snapshot() -> pd.DataFrame:
    """KBS balance_sheet shape — section headers + hierarchy prefix + grand total."""
    return pd.DataFrame(
        [
            # Section header — must be skipped (NaN values + blocklist).
            {
                "item_id": "tai_san",
                "item_en": "ASSETS",
                "item": "TÀI SẢN",
                "2026-Q1": math.nan,
                "2025-Q4": math.nan,
                "2025-Q4_1": math.nan,
                "2025-Q3": math.nan,
                "2025-Q2": math.nan,
            },
            {
                "item_id": "a.short_term_assets",
                "item_en": "Short-term assets",
                "item": "Tài sản ngắn hạn",
                "2026-Q1": 15_000_000.0,
                "2025-Q4": 14_500_000.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 14_000_000.0,
                "2025-Q2": 13_500_000.0,
            },
            {
                "item_id": "b.inventories",
                "item_en": "Inventories",
                "item": "Hàng tồn kho",
                "2026-Q1": 8_000_000.0,
                "2025-Q4": 7_500_000.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 7_200_000.0,
                "2025-Q2": 7_000_000.0,
            },
            {
                "item_id": "total_assets",
                "item_en": "Total assets",
                "item": "Tổng tài sản",
                "2026-Q1": 25_894_000.0,
                "2025-Q4": 24_500_000.0,
                "2025-Q4_1": 24_400_000.0,
                "2025-Q3": 23_000_000.0,
                "2025-Q2": 22_000_000.0,
            },
            # Section header
            {
                "item_id": "nguon_von",
                "item_en": "EQUITY AND LIABILITIES",
                "item": "NGUỒN VỐN",
                "2026-Q1": math.nan,
                "2025-Q4": math.nan,
                "2025-Q4_1": math.nan,
                "2025-Q3": math.nan,
                "2025-Q2": math.nan,
            },
            {
                "item_id": "c.liabilities",
                "item_en": "Total liabilities",
                "item": "Tổng nợ phải trả",
                "2026-Q1": 10_984_000.0,
                "2025-Q4": 10_500_000.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 10_000_000.0,
                "2025-Q2": 9_500_000.0,
            },
            {
                "item_id": "i.short_term_liabilities",
                "item_en": "Short-term liabilities",
                "item": "Nợ ngắn hạn",
                "2026-Q1": 7_000_000.0,
                "2025-Q4": 6_800_000.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 6_500_000.0,
                "2025-Q2": 6_200_000.0,
            },
            {
                "item_id": "d.owners_equity",
                "item_en": "Owners equity",
                "item": "Vốn chủ sở hữu",
                "2026-Q1": 14_910_000.0,
                "2025-Q4": 14_000_000.0,
                "2025-Q4_1": 14_050_000.0,
                "2025-Q3": 13_000_000.0,
                "2025-Q2": 12_500_000.0,
            },
            # Grand-total row — must be blocklisted (= total_assets identity).
            {
                "item_id": "total_owners_equity_and_liabilities",
                "item_en": "Total equity and liabilities",
                "item": "Tổng nguồn vốn",
                "2026-Q1": 25_894_000.0,  # = total_assets
                "2025-Q4": 24_500_000.0,
                "2025-Q4_1": 24_400_000.0,
                "2025-Q3": 23_000_000.0,
                "2025-Q2": 22_000_000.0,
            },
        ]
    )


def kbs_cash_flow_snapshot() -> pd.DataFrame:
    """KBS cash_flow shape — operating cash flow only."""
    return pd.DataFrame(
        [
            {
                "item_id": "net_cash_flows_from_operating_activities",
                "item_en": "Net cash flows from operating activities",
                "item": "Lưu chuyển tiền từ hoạt động kinh doanh",
                "2026-Q1": 200_000.0,
                "2025-Q4": 350_000.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 180_000.0,
                "2025-Q2": 150_000.0,
            },
        ]
    )


def kbs_ratio_snapshot() -> pd.DataFrame:
    """KBS ratio shape — shares_outstanding lives here for bvps fallback test."""
    return pd.DataFrame(
        [
            {
                "item_id": "shares_outstanding",
                "item_en": "Outstanding shares",
                "item": "Số lượng cổ phiếu lưu hành",
                "2026-Q1": 380_000_000.0,
                "2025-Q4": 380_000_000.0,
                "2025-Q4_1": math.nan,
                "2025-Q3": 380_000_000.0,
                "2025-Q2": 380_000_000.0,
            },
        ]
    )


# Golden expected values for the latest period (2026-Q1) AFTER:
#   - canonical-field mapping (KBS prefix stripped)
#   - period suffix collision resolved (base 2025-Q4 wins over `_1`)
#   - blocklist applied (total_owners_equity_and_liabilities, section headers skipped)
#   - Phase 22 source-aware scaling (×1000 for KBS VND fields)
#   - Phase 26 bvps fallback (computed from total_equity / shares_outstanding)
KBS_2026Q1_GOLDEN: dict[str, float] = {
    "revenue": 1_279_000.0 * 1000.0,           # 1.279 T VND
    "cogs": 900_000.0 * 1000.0,
    "net_income": 348_000.0 * 1000.0,
    "eps": 679.0,                              # per-share VND, NOT scaled
    "current_assets": 15_000_000.0 * 1000.0,
    "inventory": 8_000_000.0 * 1000.0,
    "total_assets": 25_894_000.0 * 1000.0,
    "total_debt": 10_984_000.0 * 1000.0,
    "current_liabilities": 7_000_000.0 * 1000.0,
    "total_equity": 14_910_000.0 * 1000.0,
    "operating_cash_flow": 200_000.0 * 1000.0,
    "shares_outstanding": 380_000_000.0,        # count, NOT scaled
    # Phase 26 bvps computed = total_equity / shares_outstanding
    # = 14_910_000_000_000 / 380_000_000 = 39_236.84... VND/share
    "bvps": 14_910_000.0 * 1000.0 / 380_000_000.0,
}
