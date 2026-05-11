"""Domain enums — TAD g03 §L appendix + SRS g03."""

from enum import StrEnum


class RunStatus(StrEnum):
    """Canonical 7-state per TAD g01 §2.1 (locked).

    Frontend prototype 5-step subset map:
    - PENDING → CHECKING_DATA → SCREENING → SCORING → terminal (COMPLETED|COMPLETED_WITH_WARNINGS|FAILED).
    SRS g03 §G mention 3 simplified states (RUNNING/COMPLETED/FAILED) — RUNNING là gộp của
    CHECKING_DATA|SCREENING|SCORING. Backend dùng 7 states đầy đủ.
    """

    PENDING = "PENDING"
    CHECKING_DATA = "CHECKING_DATA"
    SCREENING = "SCREENING"
    SCORING = "SCORING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_WARNINGS = "COMPLETED_WITH_WARNINGS"
    FAILED = "FAILED"


RUN_TERMINAL_STATES: frozenset[RunStatus] = frozenset(
    {RunStatus.COMPLETED, RunStatus.COMPLETED_WITH_WARNINGS, RunStatus.FAILED}
)


class RefreshStatus(StrEnum):
    """Status cho refresh job — đơn giản hơn screening, không có CHECKING/SCREENING/SCORING."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


REFRESH_TERMINAL_STATES: frozenset[RefreshStatus] = frozenset(
    {RefreshStatus.COMPLETED, RefreshStatus.FAILED}
)


class Recommendation(StrEnum):
    """ASCII keys khớp frontend RECOMMENDATIONS — VIE label render ở UI/i18n layer."""

    MUA = "MUA"
    GIU = "GIU"
    BAN = "BAN"


class EntrySignal(StrEnum):
    """7 canonical entry signals — SRS f03 + cluster 3 lock + frontend ENTRY_SIGNALS."""

    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    NO_ENTRY = "NO_ENTRY"
    BUY_STRONG = "BUY_STRONG"
    BUY_NOW = "BUY_NOW"
    WAIT_FOR_BREAKOUT = "WAIT_FOR_BREAKOUT"
    WAIT_FOR_PULLBACK = "WAIT_FOR_PULLBACK"
    WAIT_FOR_CONFIRMATION = "WAIT_FOR_CONFIRMATION"


ENTRY_SIGNAL_PRIORITY: dict[EntrySignal, int] = {
    EntrySignal.INSUFFICIENT_DATA: 1,
    EntrySignal.NO_ENTRY: 2,
    EntrySignal.BUY_STRONG: 3,
    EntrySignal.BUY_NOW: 4,
    EntrySignal.WAIT_FOR_BREAKOUT: 5,
    EntrySignal.WAIT_FOR_PULLBACK: 6,
    EntrySignal.WAIT_FOR_CONFIRMATION: 7,
}


class NewsSource(StrEnum):
    CAFEF = "CAFEF"
    VNEXPRESS = "VNEXPRESS"
    VIETSTOCK = "VIETSTOCK"
    BATDONGSAN = "BATDONGSAN"
    THANHNIEN = "THANHNIEN"


class SentimentLabel(StrEnum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"


class Theme(StrEnum):
    CLASSIC = "CLASSIC"
    LIGHT = "LIGHT"
    OLED = "OLED"


class ClassicMode(StrEnum):
    DARK = "DARK"
    LIGHT = "LIGHT"


class Language(StrEnum):
    VIE = "VIE"
    ENG = "ENG"


class Exchange(StrEnum):
    HOSE = "HOSE"
    HNX = "HNX"
    UPCOM = "UPCOM"


class StockStatus(StrEnum):
    ACTIVE = "ACTIVE"
    DELISTED = "DELISTED"
    SUSPENDED = "SUSPENDED"


class BacktestStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class CacheStatus(StrEnum):
    FRESH = "FRESH"
    STALE = "STALE"
    REFRESHING = "REFRESHING"
