# Phase 16 — MVP Data Readiness Closure (Mốc 2 đóng thật)

**Ngày:** 2026-05-19 đến 2026-05-20
**Mục tiêu thực hiện:** đóng nốt phần "full real-data refresh" còn nợ ở Phase 14/15 — chạy production refresh thật trên prod-like DB, đạt `vnstock_price=FRESH` và `scored_count > 0` từ screening real data.
**Trạng thái:** COMPLETED 2026-05-20

## 1. Việc đã làm

- Đối chiếu đề xuất 3-mốc của Codex (Mốc 1 demo / Mốc 2 production data / Mốc 3 release hardening) với phase đã build:
  - Xác định Phase 13 = Mốc 1, Phase 14+15 = Mốc 2 (code-level), Mốc 3 chưa bắt đầu.
  - Sửa label sai trong `mvp/phases/phase-15-financial-ingestion/SUMMARY.md` (gán nhầm "Mốc 3" → đổi thành "Phần còn lại của Mốc 2 — BCTC ingestion").
- Setup prod-like local DB tách hẳn dev/demo/test:
  - Tạo `mvp/code/.env` với `APP_ENV=production`, `DB_PATH=./data/prod-screener.db`, guest quota `VNSTOCK_RATE_LIMIT_S=6.5`.
  - Chạy `alembic upgrade head` + `seed.py` cho prod DB (81 stocks, 150 news, 5 macro, 1 user, 9 cache rows).
- Smoke subset 5 anchor ticker (VHM/KDH/NLG/DXG/PDR) qua `POST /api/refresh/prices` body subset:
  - 5/5 success trong ~26 giây, 1320 rows.
  - Xác nhận Phase 14 partial-commit + stats + cache `PARTIAL` cho subset (đúng TAD g04 source-level rule).
- Chạy full `/api/refresh/all` lần 1 trên 81 ticker:
  - 17 phút, COMPLETED.
  - Phát hiện 3 drift chưa từng nói tới trong các phase trước.
- Phát hiện và phân tích 3 finding:
  - **Finding 1 — Unit mismatch close**: `vnstock_client.fetch_prices()` lưu OHLC raw từ VCI (ngàn đồng), nhưng `filter_service.PRICE_FLOOR=15_000.0` so raw VND. Hệ quả VHM close=157 (= 157K VND thật) bị loại `PENNY_PRICE` → 24/26 real ticker bị loại → screening trả `scored_count=0`.
  - **Finding 2 — Seed pollution**: `seed.py` có 26 real RE ticker + 55 MOCK ticker (`MOCK_*` + `MOCK01-50`). Refresh universe `WHERE Stock.status='ACTIVE'` lấy cả mock → 55 fail mỗi run → cache không bao giờ đạt `FRESH`. Memory cũ ghi "81 RE ticker" — sai.
  - **Finding 3 — VCI BCTC gap**: 14/26 real ticker fail `Finance.balance_sheet(source='vci', period='quarter')` (NLG, DXG, PDR, KBC, BCM, VRE, HQC, TIG, LDG, ITC, SCR, AGG, KOS, NTL). Vnstock VCI intermittent — lần đầu 11/26 fail, lần sau 14/26.
- Báo cáo 3 finding cho user; user chọn fix ngay Finding 1+2, carry Finding 3 sang Mốc 3.
- Fix Finding 1 (unit mismatch):
  - Thêm helper `_scale_vnd(v)` trong `vnstock_client.py` (× 1000 ngàn đồng → raw VND, None-safe).
  - `fetch_prices()` áp `_scale_vnd` cho open/high/low/close; volume giữ nguyên (đã là raw shares).
  - DB convention được chốt là **raw VND**, align với `demo_seed.base_close=25_000` và `filter_service.PRICE_FLOOR=15_000`.
- Fix Finding 2 (MOCK pollution):
  - `stock_repo.list_active_tickers()` thêm filter `~Stock.ticker.like('MOCK%')`.
  - Giữ MOCK ticker trong seed (test/dev/FE prototype vẫn cần) — chỉ loại khỏi refresh + screening universe.
  - Không cần DB migration, không break test fixture.
- Cập nhật test `test_run_lifecycle_completes_with_results` (assert `total_input == 81` → `26`) để khớp universe thật sau Finding 2 fix.
- Restart uvicorn để load code đã fix, smoke subset 5 ticker lại — verify VHM close=157000 raw VND, cache=PARTIAL.
- Chạy full `/refresh/all` lần 2 sau fix (26 real ticker):
  - 5.4 phút (giảm từ 17 phút vì universe co từ 81 → 26).
  - Prices 26/26 success → `vnstock_price=FRESH` ✅.
  - Financials 12/26 success (14 fail từ Finding 3) → `vnstock_financial=PARTIAL` (carry).
- Re-run screening `POST /api/run`:
  - **scored_count=11** (7 GIU + 4 BAN, 0 MUA), 15 excluded.
  - Excluded breakdown hợp lý: 7 PENNY_PRICE thật (IJC=9.9k<15k), 5 INSUFFICIENT_DATA + 2 NEWLY_LISTED (do gap BCTC Finding 3), 1 LOW_LIQUIDITY (SIP=286K<300K).
- Cập nhật memory `project_mvp_backend.md`, `MEMORY.md`, `reference_mvp_paths.md`:
  - Phase 0-15 → Phase 0-16 done.
  - Roadmap mapping Codex 3-mốc.
  - Thêm Phase 12-16 conventions.
  - 4 DB modes locked (dev / test / demo / prod).
  - Real universe size = 26 ticker (không phải 81).
  - DB price unit = raw VND.
  - Mốc 3 hand-off scope.

## 2. File đã sửa

- `mvp/code/app/crawlers/vnstock_client.py` — thêm `_scale_vnd()` helper + scale OHLC ×1000 trong `fetch_prices()`.
- `mvp/code/app/repositories/stock_repo.py` — `list_active_tickers()` thêm filter `NOT LIKE 'MOCK%'`.
- `mvp/code/tests/integration/test_run_lifecycle.py` — `total_input` assertion 81 → 26.
- `mvp/phases/phase-15-financial-ingestion/SUMMARY.md` — sửa label "Mốc 3" → "Phần còn lại của Mốc 2 — BCTC ingestion".

## 3. File đã thêm

- `mvp/code/.env` — prod-like config (gitignored).
- `mvp/code/data/prod-screener.db` — prod DB với real vnstock data (gitignored).
- `mvp/phases/phase-16-mvp-data-readiness-closure/SUMMARY.md` — audit trail phase 16.
- `report/phase-mvp/phase-16-mvp-data-readiness-closure/SUMMARY.md` — file này.

## 4. Lệnh đã chạy

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

# Subset smoke 5 anchor
curl -s -X POST http://localhost:8000/api/refresh/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tickers":["VHM","KDH","NLG","DXG","PDR"]}'

# Full refresh (lần 1 + lần 2 sau fix)
curl -s -X POST http://localhost:8000/api/refresh/all \
  -H "Authorization: Bearer $TOKEN"

# Screening sau khi cache=FRESH
curl -s -X POST http://localhost:8000/api/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Regression
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py tests/integration/test_seed.py -q
uv run pytest -q
```

## 5. Kết quả

- **Mốc 2 closure criteria đạt thật**:
  - `vnstock_price` cache = **FRESH** (full universe 26/26 prices success).
  - Screening `scored_count = 11` > 0 (7 GIU + 4 BAN).
- VHM close DB = 157000 raw VND sau Finding 1 fix (trước fix là 157).
- Refresh universe filter đúng: 81 stocks → 26 active (loại 55 MOCK).
- Full `/refresh/all` chạy 5.4 phút (giảm từ 17 phút).
- Targeted pytest 24/24 (vnstock_client + test_refresh + test_seed) pass.
- Full backend pytest pass — 256/256.
- Ruff pass.
- Server stop sạch sau khi verify.

## 6. Tồn đọng

- **Finding 3 carry sang Mốc 3**: 14 real ticker fail VCI BCTC (NLG, DXG, PDR, KBC, BCM, VRE, HQC, TIG, LDG, ITC, SCR, AGG, KOS, NTL). Hai lựa chọn cho Mốc 3:
  - Thử fallback source (`tcbs`, `kbs`) trong `fetch_financials()`.
  - Accept gap + document trong PRD/SRS.
- `vnstock_financial` cache hiện ở `PARTIAL` — chỉ về `FRESH` được khi Finding 3 giải quyết.
- Cron refresh schedule (TAD g05) chưa wire vào systemd/cron — Mốc 3 hoặc post-MVP.
- 0 MUA pick trong screening lần này — chưa rõ là (a) thị trường thực tháng 5/2026 không có MUA, hay (b) scoring threshold cần tune. Phase 4 scoring logic question, không phải Mốc 2.