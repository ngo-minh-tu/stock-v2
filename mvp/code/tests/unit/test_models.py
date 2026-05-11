from app.models import Base


def test_base_metadata_has_16_tables():
    expected = {
        "stocks",
        "stock_prices",
        "financial_reports",
        "macro_data",
        "screening_runs",
        "screening_results",
        "excluded_stocks",
        "news_articles",
        "user_profile",
        "portfolio",
        "transactions",
        "settings",
        "backtest_runs",
        "backtest_results",
        "share_links",
        "cache_metadata",
    }
    assert set(Base.metadata.tables.keys()) == expected
    assert len(Base.metadata.tables) == 16


def test_features_count():
    from app.constants.features import FEATURE_BY_ID, FEATURES

    assert len(FEATURES) == 38
    assert len(FEATURE_BY_ID) == 38
    # 16 fundamental + 9 technical + 5 macro + 5 realestate + 3 sentiment = 38
    groups: dict[str, int] = {}
    for f in FEATURES:
        groups[f.group.value] = groups.get(f.group.value, 0) + 1
    assert groups == {
        "fundamental": 16,
        "technical": 9,
        "macro": 5,
        "realestate": 5,
        "sentiment": 3,
    }
