"""Register all ORM models — import order ensures Base.metadata sees every table.

Use `from app.models import Base` để alembic env.py + tests/seed pickup metadata.
"""

from app.db.session import Base
from app.models.backtest import BacktestResult, BacktestRun
from app.models.cache import CacheMetadata
from app.models.financial import FinancialReport
from app.models.macro import MacroData
from app.models.news import NewsArticle
from app.models.portfolio import PortfolioHolding, Transaction
from app.models.run import ExcludedStock, ScreeningResult, ScreeningRun
from app.models.settings import Settings
from app.models.share import ShareLink
from app.models.stock import Stock, StockPrice
from app.models.user import UserProfile

__all__ = [
    "Base",
    "BacktestResult",
    "BacktestRun",
    "CacheMetadata",
    "ExcludedStock",
    "FinancialReport",
    "MacroData",
    "NewsArticle",
    "PortfolioHolding",
    "ScreeningResult",
    "ScreeningRun",
    "Settings",
    "ShareLink",
    "Stock",
    "StockPrice",
    "Transaction",
    "UserProfile",
]
