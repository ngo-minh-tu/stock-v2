# Phase 16 — MVP Data Readiness Closure (Mốc 2 đóng thật)

**Status:** COMPLETED 2026-05-20
**Spec ref:** Đóng nốt phần "full 81-ticker refresh thật" còn nợ ở [Phase 14 §7](../phase-14-production-data-hardening/SUMMARY.md) + [Phase 15 §7](../phase-15-financial-ingestion/SUMMARY.md). Tuân TAD g04 cache rule + Phase 14/15 data conventions.

## 1. Scope

Sau Phase 15, Mốc 2 chỉ "code-level done". Phase 16 chạy full real-data refresh trên prod-like DB để kiểm chứng cuối pipeline, phát hiện và sửa drift còn lại để đạt:

- Cache `vnstock_price = FRESH` thật.
- Screening trả `scored_count > 0` với real data.

Trong scope:

- Tạo prod-like DB tách hẳn dev/demo (`./data/prod-screener.db`).
- Subset smoke 5 anchor + full `/refresh/all` thật, guest quota 6.5s/req.
- Re-run screening verify `scored_count > 0`.
- Sửa các drift phát hiện trong quá trình kiểm.

Out of scope (chuyển sang Mốc 3):

- Vnstock VCI BCTC gap cho 14 ticker (Finding 3).
- Playwright/security/Telegram/PDF (release hardening).

## 2. Pre-code audit / drift (phát hiện khi chạy full refresh thật)

| # | Drift / issue | Resolution |
|---|---|---|
| 1 | **Unit mismatch close**: `vnstock_client.fetch_prices()` lưu OHLC raw từ VCI (ngàn đồng), nhưng `filter_service.PRICE_FLOOR=15_000.0` so raw VND. Hệ quả VHM close=157 (= 157K VND thật) bị loại `PENNY_PRICE` → 24/26 real ticker bị loại → `scored_count=0`. | ✅ Thêm `_scale_vnd()` helper, scale OHLC ×1000 trong `fetch_prices()` ingest. DB convention align với `demo_seed.base_close=25_000` (raw VND). |
| 2 | **Seed pollution**: seed.py có 26 real + 55 MOCK ticker (`MOCK_*` + `MOCK01-50`). Refresh universe `WHERE status='ACTIVE'` lấy cả mock → 55 fail mỗi run → cache không bao giờ `FRESH`. | ✅ `stock_repo.list_active_tickers()` thêm filter `~ticker.like('MOCK%')`. Universe co từ 81 → 26 real ticker. Test `test_run_lifecycle` cập nhật `total_input` 81 → 26. |
| 3 | **VCI BCTC gap** (CARRY sang Mốc 3): 14/26 real ticker fail `Finance.balance_sheet()` từ source `vci` (NLG/DXG/PDR/KBC/BCM/VRE/HQC/TIG/LDG/ITC/SCR/AGG/KOS/NTL). Lần đầu chạy là 11/26 fail, lần 2 là 14/26 — vnstock VCI intermittent. | ⏭️ Carry sang Mốc 3 — cần research thêm: fallback source (tcbs/kbs) hoặc accept gap. Hiện tại chấp nhận `vnstock_financial=PARTIAL`. |

## 3. Deliverables

| Path | Nội dung |
|---|---|
| [app/crawlers/vnstock_client.py](../../code/app/crawlers/vnstock_client.py) | `_scale_vnd()` helper + OHLC scale ×1000 trong `fetch_prices()` (Finding 1) |
| [app/repositories/stock_repo.py](../../code/app/repositories/stock_repo.py) | `list_active_tickers()` thêm exclude `MOCK%` (Finding 2) |
| [tests/integration/test_run_lifecycle.py](../../code/tests/integration/test_run_lifecycle.py) | `total_input` 81 → 26 (universe co lại sau Finding 2 fix) |
| [.env](../../code/.env) | Prod-like config: `DB_PATH=./data/prod-screener.db`, `APP_ENV=production`, guest quota 6.5s |

## 4. Exit criteria

| Check | Result |
|---|---|
| Subset smoke (5 anchor) sau fix | PASS — VHM close=157000 raw VND, 5/5 success, cache=PARTIAL đúng |
| Full `/refresh/all` (26 real) | PASS — 322s (~5.4 phút), prices 26/26 success, financials 12/26 success |
| `vnstock_price` cache=FRESH | PASS — full universe 100% prices success |
| `vnstock_financial` cache=PARTIAL | EXPECTED — 14/26 fail từ VCI source (Finding 3 carry) |
| Screening `scored_count > 0` | PASS — 11 scored (7 GIU + 4 BAN, 0 MUA), 15 excluded |
| Excluded breakdown hợp lý | PASS — 7 PENNY_PRICE thật (IJC 9.9k), 5+2 INSUFFICIENT_DATA/NEWLY_LISTED (BCTC gap Finding 3), 1 LOW_LIQUIDITY (SIP 286K<300K) |
| Backend pytest | PASS — 256/256 |
| Ruff | PASS |

## 5. Locked decisions

| Mục | Giá trị | Lý do |
|---|---|---|
| DB price unit | **Raw VND** (e.g., VHM close = 157000) | Align với `demo_seed.base_close=25_000` + `filter_service.PRICE_FLOOR=15_000`. Memory cluster-5 "ngàn đồng↔VND units" thực ra là về API serialization (Phase 6 `raw/1000` cho OHLCV API output) + portfolio_holdings.buy_price (Phase 7), KHÔNG phải stock_prices.close DB column. |
| Vnstock ingest scale | ×1000 trong `_scale_vnd()` (Finding 1) | VCI native unit = ngàn đồng; scale ngay tại ingest boundary, in-DB luôn là raw VND. |
| Refresh universe filter | `Stock.status='ACTIVE' AND ticker NOT LIKE 'MOCK%'` | MOCK tickers vẫn giữ trong seed cho test/dev/FE prototype dùng, chỉ loại khỏi refresh + screening universe. Tránh DB migration. |
| Prod DB path | `./data/prod-screener.db` | Tách khỏi `screener.db` (dev), `demo-screener.db` (Phase 13), `test-screener.db` (pytest). 4 DB modes locked. |
| Mốc 2 closure criteria | `vnstock_price=FRESH` + `scored_count>0` | `vnstock_financial=PARTIAL` chấp nhận do source-level limitation (Finding 3 carry). |

## 6. Verification commands

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Setup prod DB
uv run alembic upgrade head
uv run python -m app.db.seed

# Start server (background)
uv run uvicorn app.main:app --port 8000

# Login
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"ChangeMe123!"}'

# Subset smoke
curl -s -X POST http://localhost:8000/api/refresh/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tickers":["VHM","KDH","NLG","DXG","PDR"]}'

# Full refresh + screening
curl -s -X POST http://localhost:8000/api/refresh/all \
  -H "Authorization: Bearer $TOKEN"
# Poll GET /api/refresh/{id}/status until COMPLETED

curl -s -X POST http://localhost:8000/api/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
# Poll GET /api/runs/{id}/status, then GET /api/runs/{id}/dashboard

# Regression
uv run pytest -q  # 256/256
uv run ruff check app/ tests/
```

## 7. Findings detail (cross-ref)

### Finding 1 — Unit mismatch (FIXED)

- File: [app/crawlers/vnstock_client.py:168-180](../../code/app/crawlers/vnstock_client.py#L168-L180)
- Helper: `_scale_vnd()` line ~236
- Verify: VHM close trước fix = 157 (= 0.157 VND if treated raw); sau fix = 157000 (raw VND, ≈ 157K = giá thị trường thực).

### Finding 2 — MOCK pollution (FIXED)

- File: [app/repositories/stock_repo.py:11-21](../../code/app/repositories/stock_repo.py#L11-L21)
- Pattern: `~Stock.ticker.like('MOCK%')` excludes 55 mock tickers.
- Trade-off cân nhắc nhưng bỏ: thay vì sửa seed.py set status='MOCK' (cần DB migration + UPDATE row hiện có), filter ở repo cleaner và không break test fixture.

### Finding 3 — VCI BCTC gap (CARRY)

- 14 real ticker fail `Finance(source='vci', period='quarter')`: NLG, DXG, PDR, KBC, BCM, VRE, HQC, TIG, LDG, ITC, SCR, AGG, KOS, NTL.
- Lần chạy đầu (trước Finding 2 fix): 11/26 fail. Lần sau: 14/26. → vnstock VCI intermittent với một số ticker.
- Hệ quả: 5 INSUFFICIENT_DATA + 2 NEWLY_LISTED trong screening excluded đều do gap này, không phải lỗi screening logic.
- Mốc 3 cần: thử fallback source (`tcbs`, `kbs`), hoặc accept gap + document trong PRD.

## 8. Hand-off cho Mốc 3 (release hardening)

Mốc 2 đã đóng thực sự (data-level, không chỉ code-level). Mốc 3 scope chốt:

1. **Finding 3 follow-up** — fallback source trong `fetch_financials()` hoặc accept-and-document.
2. **Playwright critical-path smoke** — login → refresh → run → dashboard → portfolio → backtest → share → PDF. Open từ Phase 12 §5.
3. **Telegram real-send verify** — Bot token + chat ID. Open từ Phase 12 §5.
4. **Next/security upgrade** — FE + BE dependency audit.
5. **Production env config** + backup strategy SQLite.
6. **PDF check** — weasyprint + html_mock cả 2 modes trong browser.

Cron refresh schedule (TAD g05): chưa wire vào systemd/cron job — Mốc 3 hoặc post-MVP.
