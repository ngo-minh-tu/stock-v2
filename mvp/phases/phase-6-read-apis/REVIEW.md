# Phase 6 — Read APIs REVIEW

**Done:** ~2026-05-10 (~3.5h, estimate 1d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: VND ngàn đồng convention (field-specific), 2 endpoints không có trong TAD registry, DB pollution test isolation.

## Surprises / non-obvious

- **VND unit convention at API boundary**: backend DB stores **raw VND** (e.g. close=35_000). API trả **ngàn đồng** (35.0) cho price fields. `_to_ngan_dong(v) = round(v/1000, 2)`. Apply cho: `current_price, target_price_3m, support_zone, resistance_zone, stop_loss_price, OHLCV close/open/high/low/reference/ceiling/floor`. **NHƯNG**: `allocation_amount` giữ raw VND, `volume` giữ raw shares, `ai_score` 0-100 không đổi. Phase 7 portfolio.buy_price = ngàn đồng cả store + API (KHÔNG convert) → field-specific rule, dễ miss.
- **2 endpoints không có trong TAD g02 §1 registry**: `GET /runs/{id}/excluded` (cho Red Flags page) + `GET /stocks/{ticker}/runs` (cho Stock Detail run selector). SRS reference nhưng spec registry chưa add. Phase 6 added — cluster 7+ reconcile cần update TAD.
- **Phase 9 rename `reason → reason_text`** trong excluded endpoint emit để match FE accessor cluster 6.
- **`market_cap` proxy `ai_score × 10`**: schema chưa có `shares_outstanding` column trong screening_results. Phase 7+ wire real cap nếu cần — `financial_reports.shares_outstanding` field đã có sẵn.
- **`radar_industry_avg` null**: TAD g02 §4 spec có field nhưng Phase 6 chưa aggregate per-sector. Phase 7+ revisit.
- **`raw_indicators_used` = []**: Phase 5 EntryResult có field nhưng KHÔNG persist DB. Phase 6 trả []. Phase 7+ hoặc parse `entry_reason_code` hoặc thêm column.
- **`index_trend 26 weeks` sin-wobble**: VN-Index + RE Index placeholder. Phase 8 backtest sẽ replace bằng historical actual.
- **DB pollution issue khó chịu**: tests share dev DB `mvp/code/data/screener.db`. `screening_data` fixture insert 16k rows + cleanup defensive. Nếu fixture crash giữa chừng = orphan rows + IntegrityError next run. Workaround: cleanup script trước full pytest. Long-term fix Phase 10.
- **REC_RANK ASCII**: `{BAN:0, GIU:1, MUA:2}` ASCII keys. TAD g02 §8.3 + SRS g03 §Q viết diacritics — backend dùng ASCII. Document drift Phase 6 §2 #4.

## Key decisions (why)

- **Endpoint registration order**: results → stocks → news. Match include order trong `app/api/__init__.py`. Path resolution correct.
- **Run-scoped endpoints prefix không chung**: `/api/runs/{id}/*` paths hardcode trong [results.py](../../code/app/api/results.py), KHÔNG chung prefix `/runs` vì [screening.py](../../code/app/api/screening.py) đã include `/runs` paths. Tránh conflict.
- **Score distribution buckets** SRS g03 §R: 6 ranges low-incl high-excl. Score=60 thuộc `60-75`. Score=100 thuộc `≥90`.
- **Compare same-run validation** server-side 400 ERR-12-01 dù FE đã ngăn.
- **Alpha proxy** `mean_upside_MUA - 5.0%` (DASHBOARD_VNINDEX_3M_PROXY_PCT). Phase 8 backtest replace.

## To revisit

- TAD g02 §1 registry **chưa list `/excluded` + `/stocks/{ticker}/runs`** — Phase 10 hoặc cluster 7+ reconcile.
- TAD g02 §8.3 + SRS g03 §Q diacritics doc — chỉ doc-level drift, code ASCII OK.
- Dashboard service `db.query(Stock).all()` SQLAlchemy 1.x style — Phase 7+ migrate sang `db.scalars(select(Stock))` (style debt, không break).
- `index_trend 26 weeks` không deterministic per-run (dùng `datetime.utcnow()`) — acceptable cho UI render. Phase 8 wire actual → deterministic.
- `market_cap` real cần `shares_outstanding × price` — Phase 1 model có `financial_reports.shares_outstanding` field, có thể wire khi cần.
