"""External source descriptors — TAD g04 cache architecture.

TTL hours per TAD g04 §1 (locked):
- vnstock prices: 4h (in-session); 24h ngoài phiên — MVP dùng 4h conservative
- vnstock financials: 30 days = 720h
- macro (SBV + GSO): 30 days = 720h
- news (5 sources): 6h
"""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SourceConfig:
    key: str
    label: str
    ttl_hours: int


# vnstock data types (cache_metadata source field)
VNSTOCK_PRICE = SourceConfig("vnstock_price", "vnstock OHLCV", ttl_hours=4)
VNSTOCK_FINANCIAL = SourceConfig("vnstock_financial", "vnstock báo cáo tài chính", ttl_hours=720)

# Macro sources — 30 days
MACRO_SBV = SourceConfig("macro_sbv", "SBV (interest rate)", ttl_hours=720)
MACRO_GSO = SourceConfig("macro_gso", "GSO (CPI/FDI)", ttl_hours=720)

# News RSS sources (5) — 6h
NEWS_CAFEF = SourceConfig("news_cafef", "Cafef", ttl_hours=6)
NEWS_VNEXPRESS = SourceConfig("news_vnexpress", "VnExpress", ttl_hours=6)
NEWS_VIETSTOCK = SourceConfig("news_vietstock", "Vietstock", ttl_hours=6)
NEWS_BATDONGSAN = SourceConfig("news_batdongsan", "BatDongSan", ttl_hours=6)
NEWS_THANHNIEN = SourceConfig("news_thanhnien", "Thanh Niên", ttl_hours=6)

ALL_SOURCES: tuple[SourceConfig, ...] = (
    VNSTOCK_PRICE,
    VNSTOCK_FINANCIAL,
    MACRO_SBV,
    MACRO_GSO,
    NEWS_CAFEF,
    NEWS_VNEXPRESS,
    NEWS_VIETSTOCK,
    NEWS_BATDONGSAN,
    NEWS_THANHNIEN,
)

SOURCE_BY_KEY: dict[str, SourceConfig] = {s.key: s for s in ALL_SOURCES}
