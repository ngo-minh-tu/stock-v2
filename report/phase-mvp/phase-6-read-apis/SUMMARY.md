# Phase 6 — Read APIs

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** wire 11 read endpoint cho 6 FE page (Dashboard / Top MUA / Red Flags / Stock Detail / Price Board / News + Run History compare); chốt VND unit convention ngàn đồng tại API boundary.
**Trạng thái:** COMPLETED 2026-05-10

## 1. Việc đã làm

- Pre-code drift audit 4 drift:
  - `GET /runs/{id}/excluded` thiếu trong TAD g02 §1 registry (SRS f07 UC-07-01 yêu cầu) → ADD.
  - `GET /stocks/{ticker}/runs` thiếu trong TAD g02 §1 registry (SRS f08 run selector) → ADD.
  - **VND unit drift**: DB lưu RAW VND (35_000); TAD g02 §M cluster 4 chốt FE nhận ngàn đồng (35.0). Convert tại API boundary: `_to_ngan_dong(raw) = round(raw/1000, 2)` cho price fields; `allocation_amount` raw VND, `volume` raw shares, `ai_score` 0-100 không đổi. Constant `VND_RAW_TO_NGAN_DONG=1000.0`.
  - TAD g02 §8.3 + SRS g03 §Q diacritics doc — code emit ASCII (`MUA/GIU/BAN`), doc reconcile sau.
- 5 endpoint run-scoped (`/api/runs/{run_id}/*`):
  - `GET /results` — full results array.
  - `GET /excluded` — Red Flags Section A (4-round excluded).
  - `GET /stocks/{ticker}` — Stock Detail full schema TAD g02 §4 (5 sections).
  - `GET /dashboard` — 5 KPI + treemap + pie + radar_avg + index_trend 26 weeks (sin curve placeholder) + top10.
  - `GET /{run_a}/compare/{run_b}` — 4-section diff TAD g02 §8.3 (delta=b-a + recommendation_changes via REC_RANK + new_entries/removed set diff + score_distribution 6 buckets low-incl high-excl).
- 4 endpoint stock-scoped (`/api/stocks/*`):
  - `GET /stocks` — Price Board snapshot 81 mã + LatestPrice (current_price anchor logic ưu tiên latest run terminal).
  - `GET /stocks/{ticker}` — static info + latest price.
  - `GET /stocks/{ticker}/prices?interval=D|W|M&lookback=...` — OHLCV với weekly/monthly aggregation (group ISO week / month).
  - `GET /stocks/{ticker}/runs` — Stock Detail run selector dropdown.
- 2 endpoint news:
  - `GET /news?limit&offset&source&sentiment&ticker&from&to&mock_news_failure` — 5 filter + `source_errors` envelope.
  - `GET /news/sentiment/{ticker}?days=30` — rollup (label_counts + source_breakdown + score_avg).
- Conventions: alpha_pct proxy = `mean_upside_MUA - 5.0%` (`DASHBOARD_VNINDEX_3M_PROXY_PCT`); index_trend 26 weeks sin wobble placeholder; market_cap proxy `ai_score × 10` (chưa có shares_outstanding); `radar_industry_avg = null`; `raw_indicators_used = []` (Phase 5 không persist DB).
- 1 repo + 5 service mới + 5 schema + 3 router.
- 5 file integration test, +41 cases.

## 2. File đã thêm

- `mvp/code/app/repositories/news_repo.py`
- `mvp/code/app/schemas/result.py`, `stock.py`, `news.py`, `compare.py`
- `mvp/code/app/services/results_service.py`, `dashboard_service.py`, `compare_service.py`, `news_service.py`, `stock_service.py`
- `mvp/code/app/api/results.py`, `stocks.py`, `news.py`
- `mvp/code/tests/integration/test_results.py`, `test_dashboard.py`, `test_compare.py`, `test_stocks.py`, `test_news.py`

## 3. File đã sửa

- `mvp/code/app/repositories/price_repo.py` — thêm `latest_per_ticker`, `latest`.
- `mvp/code/app/repositories/screening_repo.py` — thêm `latest_completed`.
- `mvp/code/app/constants/thresholds.py` — `REC_RANK = {BAN:0, GIU:1, MUA:2}` + `SCORE_DISTRIBUTION_BUCKETS` 6 ranges + `VND_RAW_TO_NGAN_DONG=1000.0` + `DASHBOARD_VNINDEX_3M_PROXY_PCT=5.0`.
- `mvp/code/app/api/__init__.py` — register 3 router (results, stocks, news).
- `mvp/code/tests/integration/conftest.py` — extract `screening_data` + `completed_run` fixtures (shared Phase 5+6).

## 4. Lệnh đã chạy

```bash
cd mvp/code
uv run pytest                              # 174/174
uv run pytest tests/integration/test_results.py tests/integration/test_dashboard.py \
  tests/integration/test_compare.py tests/integration/test_stocks.py \
  tests/integration/test_news.py -v        # Phase 6 only
uv run ruff check app tests                # clean

# Smoke
uv run uvicorn app.main:app --port 8000
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS http://127.0.0.1:8000/api/runs/{run_id}/dashboard -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8000/api/runs/{run_id}/stocks/VHM -H "Authorization: Bearer $TOKEN"
curl -sS "http://127.0.0.1:8000/api/news?limit=20&source=CAFEF,VNEXPRESS&sentiment=POSITIVE" \
  -H "Authorization: Bearer $TOKEN"
```

## 5. Kết quả

- Pytest: PASS — 174/174 (Phase 0-5: 133, Phase 6 mới: 41).
- Ruff: PASS.
- Unit invariants verify: `current_price < 1000` (ngàn đồng); `pie.MUA + GIU + BAN == scored_count`; treemap len == scored; index_trend len == 26; radar_avg ⊆ 5 axes 0-100; score_distribution buckets sum == scored; compare delta == b-a.
- 11 endpoints cover 6 FE page + Run History compare.

## 6. Tồn đọng

- **`GET /stocks` total query bug**: đã fix dùng `db.scalar(select(func.count()).select_from(Stock))`.
- **DB pollution between tests**: residual financial_reports + stock_prices từ pre-existing dev DB. Manual cleanup workaround; long-term fixture defensive.
- **`db.query(Stock).all()` legacy SQLAlchemy 1.x style** trong dashboard/compare service — Phase 7+ migrate sang `db.scalars(select(...))`. Style debt, không break.
- **Test_compare full-suite flake**: 1 lần fail trên 174 khi chạy full; retry pass. Liên quan TestClient BG + job_lock state. Đã thêm `job_lock.reset()` fixture.
- **News fixture random tickers** → `sentiment_summary("MOCK_INSUFFICIENT")` probabilistic; test wrapped `if total == 0`.
- **Index_trend 26 weeks không deterministic per-run** (dùng `datetime.utcnow()`). Phase 8 wire actual.
- **`/stocks/{ticker}/runs` chưa pagination** (default 20, max 100). Phase 7+ revisit nếu user > 100 runs/mã.
- **Stock Detail `static.current_price` từ screening result** (không phải latest StockPrice) — run-scoped pattern.
- **TAD g02 §1 registry chưa list `/excluded` + `/stocks/{ticker}/runs`** — cluster 7+ reconcile.
- **`radar_industry_avg = null` + `raw_indicators_used = []`** — Phase 7+ wire.
- **`market_cap` real cần `shares_outstanding × price`** — Phase 1 model có field, có thể wire khi cần.
