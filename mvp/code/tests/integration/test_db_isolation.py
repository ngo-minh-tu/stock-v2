from pathlib import Path

import pytest
from app.config import get_settings
from app.db import demo_seed


def test_pytest_uses_isolated_test_database():
    settings = get_settings()
    db_name = Path(settings.db_path).name

    assert settings.app_env == "test"
    assert "test" in db_name
    assert db_name != "screener.db"
    assert db_name != "demo-screener.db"


def test_demo_seed_refuses_to_mutate_test_database():
    with pytest.raises(RuntimeError, match="non-demo DB"):
        demo_seed._guard_demo_db()
