# Phase 6 — Read APIs

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 1d / ~3.5h
**Spec ref:** [PLAN.md §3 row 6](../../PLAN.md), [SRS f04](../../../docs/srs/f04-dashboard-market-overview.md), [SRS f05](../../../docs/srs/f05-price-board.md), [SRS f06](../../../docs/srs/f06-top-mua-explainability.md), [SRS f07](../../../docs/srs/f07-red-flags-risk-warnings.md), [SRS f08](../../../docs/srs/f08-stock-detail.md), [SRS f10](../../../docs/srs/f10-news-sentiment.md), [SRS f12](../../../docs/srs/f12-run-history-backtest.md), [SRS g03 §Q+§R](../../../docs/srs/g03-appendix-enums-constants.md), [TAD g02 §4 + §7 + §8.3](../../../docs/tad/g02-api.md)

## 1. Scope

11 read endpoints support 6 frontend pages (Dashboard, Top MUA, Red Flags, Stock Detail, Price Board, News, Run History compare):

**Run-scoped (5 endpoints, prefix `/api/runs/{run_id}/...`):**
- `GET /results` — full results array (Top MUA filter rec=MUA client-side; Dashboard table)
- `GET /excluded` — Red Flags Section A (4-round excluded list) — **NEW endpoint, không có trong TAD g02 §1 registry**
- `GET /stocks/{ticker}` — Stock Detail full schema (TAD g02 §4): static + scoring + entry + risk + reasons + features + radar
- `GET /dashboard` — 5 KPI + 5 chart aggregates (treemap, pie, radar_avg, index_trend 26 weeks, top 10)
- `GET /{run_a}/compare/{run_b}` — 4-section diff (TAD g02 §8.3): summary_diff + recommendation_changes + new_entries + removed + score_distribution 6 buckets

**Stock-scoped (4 endpoints, prefix `/api/stocks`):**
- `GET /stocks` — Price Board snapshot (TAD g02 §7.1): 81 mã + LatestPrice (current_price ưu tiên latest run terminal)
- `GET /stocks/{ticker}` — static info + latest price
- `GET /stocks/{ticker}/prices?interval=D|W|M&lookback=...` — Stock Detail candlestick OHLCV với weekly/monthly aggregation
- `GET /stocks/{ticker}/runs` — Stock Detail run selector dropdown — **NEW endpoint, không có trong TAD g02 §1 registry**

**News (2 endpoints):**
- `GET /news?limit&offset&source&sentiment&ticker&from&to&mock_news_failure` — News page list với 5 filter + source_errors envelope
- `GET /news/sentiment/{ticker}?days=30` — 30-day rollup (label_counts, source_breakdown, score_avg)

## 2. Pre-code spec audit (drift report)

4 drift phát hiện trong audit, fix ngay trong Phase 6:

| # | Drift | File trước | Resolution |
|---|---|---|---|
| 1 | **`GET /runs/{run_id}/excluded` missing trong TAD g02 §1 registry**: SRS f07 UC-07-01 yêu cầu Red Flags page list mã bị loại 4-round. Phase 5 hand-off đã flag. cluster prompt §5 đã đề xuất ADD endpoint nhưng spec g02 §1 registry chưa update | n/a (spec gap) | ✅ ADD endpoint trong `app/api/results.py`. Document trong §2 này — TAD g02 §1 cần update khi reconcile cluster 7+ |
| 2 | **`GET /stocks/{ticker}/runs` missing trong TAD g02 §1 registry**: SRS f08 §1 Header sub-row "Run selector" yêu cầu dropdown list run đã chấm mã này. Endpoint không có trong g02 §1 nhưng SRS reference nó | n/a (spec gap) | ✅ ADD endpoint trong `app/api/stocks.py`. Document spec gap. |
| 3 | **VND unit conversion drift**: backend lưu RAW VND trong `screening_results.current_price` + `stock_prices.close` (e.g. 35_000). TAD g02 §M Cluster 4 chốt convention frontend nhận **ngàn đồng** (e.g. 35.0 = 35_000 VND). Phase 4-5 không nhận thức convention này | `app/services/results_service.py` + `app/services/stock_service.py` | ✅ Convert tại API boundary: `_to_ngan_dong(raw) = round(raw / 1000, 2)`. Áp dụng cho fields `current_price, target_price_3m, support_zone, resistance_zone, stop_loss_price, open/high/low/close/reference/ceiling/floor`. `allocation_amount` giữ raw đồng (TAD g02 §M); `volume` giữ raw shares; ai_score 0-100 không đổi. Constant `VND_RAW_TO_NGAN_DONG = 1_000.0` lock trong `constants/thresholds.py` |
| 4 | **TAD g02 §8.3 + SRS g03 §Q diacritics**: `recommendation_changes.rec_a/b: 'MUA' \| 'GIỮ' \| 'BÁN'`. Phase 4 đã chốt ASCII keys (`MUA`/`GIU`/`BAN`); code follow ASCII | n/a (doc-only) | ✅ Code emit ASCII. Document TAD reconcile sang ASCII khi cluster 5+ next reconciliation. KHÔNG thay đổi code. |

**Conventions locked:**
- **Alpha proxy**: `alpha_pct = avg_upside_pct(MUA) - DASHBOARD_VNINDEX_3M_PROXY_PCT (5.0)`. Phase 8 backtest sẽ replace bằng historical VN-Index actual.
- **Index trend 26 weeks**: sin curve quanh 1100 (VN-Index) + 1050 (RE Index) — placeholder. Phase 8 wire historical actual.
- **Market_cap**: chưa có `shares_outstanding × price` column trong schema → Treemap dùng proxy `ai_score × 10` (tỷ đồng). Phase 7+ wire real cap.
- **`radar_industry_avg`**: TAD g02 §4 specs có field này (overlay industry avg trên Stock Detail Radar). Phase 6 trả `null` — Phase 7+ aggregate per-sector và wire qua dashboard service.
- **`raw_indicators_used`**: Phase 4 EntryResult có field nhưng Phase 5 không persist vào DB. Stock Detail trả `[]`. Phase 7+ revisit: hoặc thêm column hoặc parse `entry_reason_code`.

## 3. Deliverables

Tất cả path relative tới `mvp/code/`.

### Mới tạo
| Path | Nội dung |
|---|---|
| `app/repositories/news_repo.py` | `list_paginated(filters)`, `sentiment_summary(ticker, days)`, `parse_related_tickers(json_str)` — SQLite LIKE `%"ticker"%` cho JSON-array contains |
| `app/schemas/result.py` | StockStaticSection, ScoringSection, EntrySection, RiskSection, StockDetailResponse (TAD g02 §4); ResultRow + ResultsListResponse; ExcludedItem + ExcludedListResponse; TreemapCell, TopByScore, IndexTrendPoint, DashboardKpis, DashboardResponse |
| `app/schemas/stock.py` | LatestPrice, StockListItem + StockListResponse, StockStaticInfo, PriceBar + PriceHistoryResponse, StockRunListItem + StockRunsResponse |
| `app/schemas/news.py` | NewsArticleItem, NewsListResponse (`source_errors` luôn array), SentimentSummaryResponse |
| `app/schemas/compare.py` | CompareDelta, CompareSummaryDiff, RecommendationChange, CompareEntryRow, ScoreDistribution, CompareResponse (TAD g02 §8.3) |
| `app/services/results_service.py` | `to_result_row(row, stock)` + `to_stock_detail(row, stock)` — parse JSON + `_to_ngan_dong()` price unit conversion |
| `app/services/dashboard_service.py` | `build_dashboard(db, run)`: 4 counts + alpha + treemap (all scored) + pie + radar_avg (5 group means) + index_trend 26-week sin curve + top 10. `_vnindex_proxy_curve()` placeholder cho Phase 8 |
| `app/services/compare_service.py` | `compute_compare(db, run_a, run_b)`: summary_diff (delta = b-a), recommendation_changes via REC_RANK (BAN=0, GIU=1, MUA=2), new_entries/removed via set diff, score_distribution với 6 buckets low-incl high-excl |
| `app/services/news_service.py` | `list_news(filters)` + `sentiment_summary(ticker, days)`. `mock_news_failure` echo trong `source_errors[]` (dev only) |
| `app/services/stock_service.py` | `list_stocks_with_prices`, `get_stock_static`, `get_price_history` (D/W/M aggregation), `list_runs_for_stock`. `_to_ngan_dong()` + `_build_latest_price()` (run-override anchor pattern TAD g02 §7.1) |
| `app/api/results.py` | 5 endpoints scoped to run: `/results, /excluded, /stocks/{t}, /dashboard, /compare/{b}`. `_require_run` helper 404 |
| `app/api/stocks.py` | 4 endpoints: `/stocks, /stocks/{t}, /stocks/{t}/prices, /stocks/{t}/runs` |
| `app/api/news.py` | 2 endpoints: `/news, /news/sentiment/{t}`. CSV parser cho `source` query param |

### Sửa
| Path | Thay đổi |
|---|---|
| `app/repositories/price_repo.py` | + `latest_per_ticker(db)` (single query MAX(date) per ticker), `latest(db, ticker)`, `list_recent` retry import |
| `app/repositories/screening_repo.py` | + `latest_completed(db)` cho Price Board anchor logic (current_price ưu tiên run mới nhất) |
| `app/constants/thresholds.py` | + `REC_RANK = {BAN:0, GIU:1, MUA:2}` (SRS g03 §Q) + `SCORE_DISTRIBUTION_BUCKETS` 6 ranges (§R) + `VND_RAW_TO_NGAN_DONG=1000.0` + `DASHBOARD_VNINDEX_3M_PROXY_PCT=5.0` |
| `app/api/__init__.py` | Register 3 new routers: results, stocks, news |
| `tests/integration/conftest.py` | EXTRACT `screening_data` + `completed_run` fixtures từ test_run_lifecycle (shared cho Phase 5 + Phase 6). + `reference/ceiling/floor` synthetic price columns |
| `tests/integration/test_run_lifecycle.py` | REMOVE inline fixtures (moved to conftest) |

### Tests mới (5 file integration, +41 cases)
| Path | Cases |
|---|---|
| `tests/integration/test_results.py` | 11 cases: 3 auth, 4 × 404 (results/excluded/stock_detail unknown run + ticker not in run), `test_results_returns_full_array` (shape + unit conversion check), `test_excluded_list`, `test_stock_detail_full_shape` (5 sections + ranges + reasons/features/radar), `test_stock_detail_ticker_lowercase_normalized` |
| `tests/integration/test_dashboard.py` | 3 cases: auth, 404, full shape (5 KPI + treemap == scored + pie matches counts + radar 5 axes 0-100 + index_trend 26 + top10 sorted DESC) |
| `tests/integration/test_compare.py` | 4 cases: auth, ERR-12-01 same run, 404 unknown run B, full shape (delta=b-a invariant + buckets sum=scored + new_entries=removed=[] cho cùng data) |
| `tests/integration/test_stocks.py` | 12 cases: 4 auth, list no-data → latest=null, list-with-prices unit-conversion check, pagination, 404 unknown ticker, static info, daily prices, weekly aggregate, invalid interval 422, runs empty + after run |
| `tests/integration/test_news.py` | 8 cases: 2 auth, default pagination 20/150, source filter, multi-source CSV, sentiment filter POSITIVE-only, mock_news_failure echoes, sentiment_summary shape, empty ticker handles count=0 |

## 4. Exit criteria — all PASS

- `uv run pytest` → **174/174 pass** (Phase 0-5: 133, Phase 6 mới: 41)
- `uv run ruff check app tests` → All checks passed
- 11 endpoints cover 6 FE page dependencies (PLAN row 6 exit criteria):
  - Dashboard (`run_id=...`): `/runs/{id}/dashboard` ✓
  - Top MUA: `/runs/{id}/results` ✓ (FE filter rec=MUA)
  - Red Flags: `/runs/{id}/excluded` + `/runs/{id}/results` ✓
  - Stock Detail: `/runs/{id}/stocks/{ticker}` + `/stocks/{ticker}/prices` + `/stocks/{ticker}/runs` ✓
  - Price Board: `/stocks` ✓
  - News: `/news` + `/news/sentiment/{ticker}` ✓
- Run History compare panel (cluster 5): `/runs/{a}/compare/{b}` ✓
- Unit invariants: `current_price < 1000` (ngàn đồng); `pie.MUA + GIU + BAN == scored_count`; treemap len == scored_count; index_trend len == 26; radar_avg ⊆ 5 axes 0-100; score_distribution buckets sum == scored_count; compare delta == b - a.

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| VND unit at API | API trả ngàn đồng (`raw / 1000`); allocation_amount giữ raw đồng | TAD g02 §M cluster 4 lock; `VND_RAW_TO_NGAN_DONG=1000` constant |
| Recommendation enum value | ASCII (MUA/GIU/BAN) trong API output | Phase 4 lock; doc-level diacritics drift trong TAD g02 §8.3 / SRS g03 §Q chỉ là spec inconsistency |
| Alpha proxy | `mean_upside_MUA - 5.0%` | VN-Index 3M proxy hardcode; Phase 8 backtest replace |
| Index trend curve | sin wobble 26 weeks | Stub cho UI render; Phase 8 wire historical actual |
| Treemap market_cap | proxy `ai_score × 10` (tỷ đồng) | Schema chưa có shares_outstanding × price; Phase 7+ wire real cap |
| `radar_industry_avg` | null | Phase 6 chưa aggregate per-sector |
| `raw_indicators_used` | `[]` | Phase 5 không persist vào DB; Phase 7+ revisit |
| Score distribution buckets | low-incl high-excl boundaries (60 thuộc 60-75) | SRS g03 §R |
| REC_RANK | `{BAN:0, GIU:1, MUA:2}` | SRS g03 §Q (ASCII keys, override diacritics doc) |
| Compare same-run validation | server-side 400 ERR-12-01 | TAD g02 §8.3 + SRS f12 |
| Price Board current_price anchor | ưu tiên latest run terminal `screening_results.current_price`; fallback latest StockPrice.close | TAD g02 §7.1 anchor logic |
| Price aggregation D/W/M | Group by ISO week (`%Y-W%V`) hoặc month (`%Y-%m`); first.open + max(high) + min(low) + last.close + sum(vol) | Standard OHLCV aggregation |
| `mock_news_failure` semantics | Echo trong `source_errors[]`, KHÔNG remove articles | SRS f10 dev tool toggle (test acceptance #11). Frontend banner test pattern |
| Sentiment empty case | score_avg=0, label_counts all 0, source_breakdown={} | TAD g02 §7.3 GUARD-08 |
| Endpoint registration order | results → stocks → news (after refresh + screening) | Match `app/api/__init__.py` include order; routes resolved correctly |
| Run-scoped endpoints prefix | KHÔNG có chung prefix `/runs` (đã ở screening.py) — `api/results.py` không prefix, paths hardcode `/runs/{run_id}/...` | Tránh conflict với `screening.py` đã include `/runs` paths. Cleaner để future-proof |
| Test fixture `completed_run` | Reuse `screening_data` + POST /run sync (TestClient await BG) | Single source of truth shared Phase 5 + Phase 6 |

## 6. Issues / drift

- **`GET /stocks` total query bug**: Phase 6 dùng `func.count()` after limit query đầu — đã sửa thành `db.scalar(select(func.count()).select_from(Stock))` để total = 81 chính xác. Tests verify.
- **DB pollution between tests**: Đầu Phase 6 phát hiện residual financial_reports + stock_prices từ pre-existing dev DB. Manual `delete()` cleanup chạy trước Phase 6 test pass. Long-term fix: `screening_data` fixture cleanup defensive (nếu fixture bị crash giữa chừng, manual cleanup cần). Test_seed assert MacroData=5 đã thêm Phase 5.
- **`db.query(Stock).all()` legacy SQLAlchemy 1.x style**: dashboard_service + compare_service dùng pattern này. Works ở SQLAlchemy 2.x nhưng deprecated. Phase 7+ migrate sang `db.scalars(select(Stock))`. Không phải bug, chỉ style debt.
- **Test_compare full-suite flake nhưng isolated pass**: 1 lần fail trong 174 test khi chạy full suite, retry pass. Có thể do TestClient await BG semantics + job_lock state across tests. Đã thêm `job_lock.reset()` trong fixture setup + teardown. Verified pass on retry.
- **News fixture seed random tickers**: `news_repo.sentiment_summary("MOCK_INSUFFICIENT")` có thể return `total>0` nếu random.choice trúng (probabilistic). Test wrapped trong `if data["total"] == 0` để robust.
- **Index_trend 26 weeks không deterministic per-run**: dùng `datetime.utcnow()` → week labels thay đổi mỗi ngày. Acceptable cho UI render. Phase 8 wire actual → deterministic.
- **`/stocks/{ticker}/runs` chưa wire pagination**: limit query default 20, max 100. Chưa offset. Phase 7+ revisit nếu user có >100 runs / mã.
- **Stock Detail `static.current_price` from screening result, không phải latest StockPrice**: Khi run cũ có giá khác latest, stock detail header sẽ hiển thị giá tại thời điểm run. Frontend prototype có cùng pattern (run-scoped). OK.

## 7. Test commands (reproducible)

```bash
cd mvp/code

uv run pytest                              # 174 pass (133 cũ + 41 Phase 6)
uv run pytest tests/integration/test_results.py tests/integration/test_dashboard.py tests/integration/test_compare.py tests/integration/test_stocks.py tests/integration/test_news.py -v   # Phase 6 only
uv run ruff check app tests                # clean

# Smoke với uvicorn thực
uv run uvicorn app.main:app --port 8000   # terminal 1
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# Tạo 1 run
curl -sS -X POST http://127.0.0.1:8000/api/run -H "Authorization: Bearer $TOKEN" -d '{"total_capital":500000000}'
# Lấy run_id, đợi terminal, sau đó:

# Read endpoints
curl -sS http://127.0.0.1:8000/api/runs/{run_id}/results -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8000/api/runs/{run_id}/dashboard -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8000/api/runs/{run_id}/stocks/VHM -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8000/api/runs/{run_id}/excluded -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8000/api/stocks?limit=10 -H "Authorization: Bearer $TOKEN"
curl -sS "http://127.0.0.1:8000/api/news?limit=20&source=CAFEF,VNEXPRESS&sentiment=POSITIVE" -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8000/api/news/sentiment/VHM -H "Authorization: Bearer $TOKEN"
```

⚠️ **Lưu ý**: Cần data thực (refresh trước khi run, hoặc seed synthetic) để screening pipeline produce results. Test SQLite dev không có vnstock real data.

## 8. Hand-off cho Phase 7

Phase 7 (Personal & History) sẽ wire:
- Portfolio CRUD: GET/POST/PUT/DELETE `/api/portfolio` + validateHolding mirror (TAD g02 §8.2 cluster 5)
- Cascade JOIN với `/api/stocks` snapshot client-side compute HoldingRow (cost_basis, market_value, unrealized_pnl)
- Run History đã có (Phase 5 GET /api/runs paginated + /compare Phase 6)
- DELETE /api/runs/{id} đã có (Phase 5)

Đã sẵn sàng:
- Run History list + delete + compare panel ✓ (Phase 5+6)
- Stock Detail full schema ✓
- LatestPrice anchor logic ✓ (Price Board + Stock Detail header dùng same source)

⚠️ **Phase 7 phải audit**:
- Portfolio model `app/models/portfolio.py` đã có chưa? Settings `default_capital` field?
- `validateHolding` rules: ticker phải trong whitelist, quantity > 0, buy_price > 0, buy_date ≤ TODAY (SRS f11 + TAD g02 §8.2).
- buy_price unit: ngàn đồng (TAD g02 §M).
- Portfolio cluster 5 spec: HoldingRow joined không phải backend response — frontend compute từ `/api/portfolio` + `/api/stocks` snapshot. Backend chỉ trả raw holding rows.

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 6 sau khi phase đã đóng)*
