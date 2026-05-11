"""Default thresholds — TAD g03 §L + SRS f15.

Mỗi giá trị mặc định khi insert settings row đầu tiên (g03 Table 12 DEFAULT clauses).
Override-able qua /api/settings PUT.
"""

# Recommendation thresholds (0..100 AI score)
DEFAULT_BUY_THRESHOLD = 75
DEFAULT_HOLD_MIN_THRESHOLD = 45

# Validation ranges (validateSettingsPatch — SRS f15)
BUY_THRESHOLD_MIN, BUY_THRESHOLD_MAX = 50, 95
HOLD_MIN_THRESHOLD_MIN, HOLD_MIN_THRESHOLD_MAX = 20, 74

# Telegram
TELEGRAM_TOP_N_OPTIONS = (3, 5)

# Confidence penalty per badge count (SRS g03 §K)
CONFIDENCE_PENALTY_1_BADGE = 5
CONFIDENCE_PENALTY_2_BADGES = 10
CONFIDENCE_PENALTY_3PLUS = 15
CONFIDENCE_PENALTY_CAP = 20  # absolute cap, kể cả khi badge count cao
FEATURE_AVAILABILITY_MIN = 20  # < này → INSUFFICIENT_DATA

# Allocation defaults (TAD c01 risk service)
ALLOCATION_WEIGHT_MAX = 0.30  # 30% per single ticker

# Stop loss defaults (% from current price)
STOP_LOSS_DEFAULT_PCT = -0.10

# News
NEWS_DEFAULT_LIMIT = 20
NEWS_SENTIMENT_LOOKBACK_DAYS = 30

# Pagination
DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 200

# Compare (SRS g03 §Q + §R)
REC_RANK: dict[str, int] = {"BAN": 0, "GIU": 1, "MUA": 2}

SCORE_DISTRIBUTION_BUCKETS: list[tuple[str, float, float]] = [
    ("<30", 0.0, 30.0),
    ("30-45", 30.0, 45.0),
    ("45-60", 45.0, 60.0),
    ("60-75", 60.0, 75.0),
    ("75-90", 75.0, 90.0),
    ("≥90", 90.0, 101.0),  # include 100
]

# VND unit conversion (TAD g02 §M cluster 4)
VND_RAW_TO_NGAN_DONG = 1_000.0  # close=35_000 raw → 35.0 ngàn đồng

# Dashboard alpha proxy — placeholder cho VN-Index 3M return
# Rationale: backtest engine (Phase 8) sẽ replace bằng historical VN-Index actual.
DASHBOARD_VNINDEX_3M_PROXY_PCT = 5.0

# Backtest constants — SRS g03 §K + AC-12-23 heuristic (mock, NOT strict per PRD §4.5)
BACKTEST_HOLD_RETURN_MIN = -7.0  # %
BACKTEST_HOLD_RETURN_MAX = 12.0  # %
BACKTEST_SELL_UNDERPERFORM = 5.0  # % vs VN-Index (post-MVP strict mode)

# Backtest mock state machine — total ~1.5s simulated
BACKTEST_MOCK_STEP_DELAY_S = 0.3  # 4 transitions × 0.3s ≈ 1.2s

# Share Link
SHARE_DEFAULT_EXPIRES_DAYS = 7
