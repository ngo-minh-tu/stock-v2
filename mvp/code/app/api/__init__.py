from fastapi import APIRouter

from app.api import (
    auth,
    backtest,
    export,
    health,
    news,
    portfolio,
    refresh,
    results,
    screening,
    settings,
    share,
    stocks,
    telegram,
)

router = APIRouter(prefix="/api")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(settings.router)
router.include_router(refresh.router)
router.include_router(screening.router)
router.include_router(results.router)
router.include_router(stocks.router)
router.include_router(news.router)
router.include_router(portfolio.router)
router.include_router(backtest.router)
router.include_router(export.router)
router.include_router(share.router)
router.include_router(telegram.router)
