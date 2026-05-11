"""Error codes — SRS g01 + TAD g05 §3.

Convention: ERR-{NN}-{NN} — module / code.
- 00: generic / cross-cutting
- AUTH: authentication
- 01: screening
- 02: feature engineering
- 03: entry engine
- 04: dashboard
- 05: stocks / price board
- 06: top mua
- 07: red flags
- 08: stock detail
- 09: risk
- 10: news
- 11: portfolio
- 12: run history / compare
- 13: export
- 14: telegram
- 15: settings
- 16: auth
- 17: theme/i18n
"""

# Generic
ERR_INTERNAL = "ERR-INTERNAL"
ERR_VALIDATION = "ERR-VALIDATION"
ERR_NOT_FOUND = "ERR-NOT-FOUND"
ERR_JOB_CONFLICT = "ERR-JOB-CONFLICT"  # 409

# Screening (SRS f01)
ERR_SCREENING_NO_DATA = "ERR-01-01"  # vnstock unavailable + no cache
ERR_SCREENING_EMPTY_RESULTS = "ERR-01-02"  # 0 mã pass 4 rounds
ERR_SCREENING_ENGINE_CRASH = "ERR-01-03"  # AI engine fail → fallback baseline

# Auth
ERR_AUTH_INVALID_CREDENTIALS = "ERR-AUTH-INVALID-CREDENTIALS"
ERR_AUTH_TOKEN_EXPIRED = "ERR-AUTH-TOKEN-EXPIRED"
ERR_AUTH_UNAUTHORIZED = "ERR-AUTH-UNAUTHORIZED"
ERR_AUTH_CURRENT_REQUIRED = "ERR-AUTH-01"
ERR_AUTH_NEW_PASSWORD_TOO_SHORT = "ERR-AUTH-02"

# Settings (SRS f15 UC-15-07)
ERR_SETTINGS_THRESHOLD = "ERR-15-01"  # buy_threshold ≤ hold_min_threshold
ERR_SETTINGS_TELEGRAM_EMPTY = "ERR-15-02"  # telegram_enabled with empty chat_id/token
ERR_SETTINGS_TOP_N = "ERR-15-03"  # telegram_top_n not in [3, 5]
ERR_SETTINGS_THEME = "ERR-15-04"
ERR_SETTINGS_LANGUAGE = "ERR-15-05"
ERR_SETTINGS_CLASSIC_MODE = "ERR-15-06"

# Portfolio (SRS f11)
ERR_PORTFOLIO_TICKER_INVALID = "ERR-11-04"
ERR_PORTFOLIO_QUANTITY_INVALID = "ERR-11-02"
ERR_PORTFOLIO_PRICE_INVALID = "ERR-11-03"
ERR_PORTFOLIO_DATE_INVALID = "ERR-11-05"
ERR_PORTFOLIO_DATE_FUTURE = "ERR-11-06"

# Compare (SRS f12)
ERR_COMPARE_SAME_RUN = "ERR-12-01"

# Backtest (SRS f12 UC-12-03)
ERR_BACKTEST_PERIOD_INVALID = "ERR-12-02"  # period_from >= period_to or period_to > today
ERR_BACKTEST_NO_BASELINE_RUN = "ERR-12-03"  # chưa có run COMPLETED nào để lấy scored universe

# Export PDF (SRS f13 UC-13-01)
ERR_EXPORT_NO_DATA = "ERR-13-01"  # run không có results để export

# Share Link (SRS f13 UC-13-02)
ERR_SHARE_TOKEN_INVALID = "ERR-13-02"  # token không tồn tại hoặc đã expire

# Telegram (SRS f14)
ERR_TELEGRAM_NOT_CONFIGURED = "ERR-14-01"  # chat_id/token rỗng → không gửi được
ERR_TELEGRAM_API_FAIL = "ERR-14-02"  # Bot API trả error
