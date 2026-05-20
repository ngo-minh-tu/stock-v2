# Phase 17 — Financial Source Fallback (Mốc 3, step 1/N)

**Ngày:** 2026-05-20
**Mục tiêu thực hiện:** mở rộng `fetch_financials()` để fallback sang KBS khi VCI không có data, đóng nốt Finding 3 carry từ Phase 16.
**Trạng thái:** COMPLETED 2026-05-20

## 1. Việc đã làm

- Investigate vnstock 4.0.2 Finance API:
  - `Finance(source=...)` chỉ accept 2 giá trị: `VCI` và `KBS`. TCBS/MSN bị ValueError.
  - Test trực tiếp `Finance(source='KBS', symbol='DXG/PDR/NLG', period='quarter').balance_sheet()` — cả 3 ticker đều trả DataFrame shape `(143, 6)` với cột `item`, `item_id`, và các kỳ `2026-Q1, 2025-Q4_1, 2025-Q4, 2025-Q3`.
  - Verify KBS DataFrame đi qua parser hiện có: 4 quarter rows merged ra cho DXG với các field map được như `eps`, `net_income`, `cogs`, `inventory`, `total_equity`. Một số field như `revenue`, `total_assets` về 0 do KBS `item_id` schema khác VCI — acceptable cho mục tiêu phase này.
- Implement fallback chain trong `vnstock_client.fetch_financials()`:
  - Thêm constant `_FINANCIAL_SOURCES: tuple[str, ...] = ("VCI", "KBS")`.
  - Tách `_fetch_financials_source(ticker, source)` helper chứa logic gọi income/balance/cash/ratio cho 1 source.
  - `fetch_financials()` loop qua `_FINANCIAL_SOURCES`: nếu exception OR `_merge_financial_frames()` trả empty rows → log + thử source tiếp theo.
  - Khi source fallback thành công, log INFO "served by fallback source=KBS" để traceable.
  - Raise `VnstockUnavailable` chỉ khi TẤT CẢ source fail; message chứa ticker + tuple source đã thử + last error.
- Gate timing: `_gate_wait()` gọi PER source attempt (không gộp vào ngoài loop) — tránh burst gọi vnstock không gating. Fallback path tốn thêm ~6.5s/ticker.
- Verify regression:
  - Targeted pytest `tests/unit/test_vnstock_client.py` 5/5 pass.
  - Full backend pytest 256/256 pass.
  - Ruff pass.
- Re-run full real-data refresh trên prod-screener.db:
  - `/api/refresh/all` chạy ~7 phút (424s).
  - Prices 26/26 success → `vnstock_price=FRESH` giữ nguyên.
  - Financials run-level: 12/26 success — nhưng DB cumulative coverage tăng từ 12 → 20 ticker (8 mới từ KBS fallback: AGG, BCM, HQC, KBC, KOS, NLG, NTL, PDR).
- Phát hiện root cause cho run-level failed: **vnstock rate limit exceeded** (quota guest 20 req/min). BCTC = 4 sub-call/ticker → 26 ticker × 4 = 104 call, quota burnt giữa chừng. Cả VCI và KBS đều đụng cùng quota gate, nên fallback giảm hiệu quả khi quota đã exhausted.
- Re-run screening sau fallback:
  - `scored_count = 14` (8 GIU + 6 BAN, 0 MUA) — tăng từ 11 ở Phase 16.
  - Universe-to-scored ratio: 14/26 = 54% (vs 11/26 = 42% trước).

## 2. File đã sửa

- `mvp/code/app/crawlers/vnstock_client.py` — thêm `_FINANCIAL_SOURCES` constant + tách `_fetch_financials_source()` + rewrite `fetch_financials()` thành fallback loop.

## 3. File đã thêm

- `mvp/phases/phase-17-financial-source-fallback/SUMMARY.md` — audit trail.
- `report/phase-mvp/phase-17-financial-source-fallback/SUMMARY.md` — file này.

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Investigate sources
uv run python -c "
from vnstock.api.financial import Finance
for src in ['vci', 'tcbs', 'kbs', 'msn']:
    try:
        Finance(source=src, symbol='VHM', period='quarter')
        print(f'{src} OK')
    except Exception as e:
        print(f'{src} FAIL: {e}')
"

# Verify KBS data + parser
uv run python -c "
from vnstock.api.financial import Finance
from app.crawlers.vnstock_client import _merge_financial_frames
f = Finance(source='KBS', symbol='DXG', period='quarter', show_log=False)
rows = _merge_financial_frames('DXG',
  income=f.income_statement(period='quarter', lang='en', dropna=False, show_log=False),
  balance=f.balance_sheet(period='quarter', lang='en', dropna=False, show_log=False),
  cash=f.cash_flow(period='quarter', lang='en', dropna=False, show_log=False),
  ratio=f.ratio(period='quarter', lang='en', dropna=False, show_log=False))
print(len(rows), 'quarters')
"

# Tests
uv run pytest tests/unit/test_vnstock_client.py -v
uv run pytest -q

# Real refresh
uv run uvicorn app.main:app --port 8000  # background
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"password":"ChangeMe123!"}' | jq -r .data.token)
curl -s -X POST http://localhost:8000/api/refresh/all -H "Authorization: Bearer $TOKEN"
# Poll GET /api/refresh/{id}/status

curl -s -X POST http://localhost:8000/api/run -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
# Poll + GET dashboard

# DB inspection
uv run python -c "
from sqlalchemy import create_engine, text
eng = create_engine('sqlite:///./data/prod-screener.db')
with eng.connect() as c:
    for r in c.execute(text('SELECT ticker, COUNT(*) FROM financial_reports GROUP BY ticker ORDER BY ticker')):
        print(r)
"
```

## 5. Kết quả

- **Fallback hoạt động trong code**: KBS được kích hoạt khi VCI fail, parse data ra row, merge với `_merge_financial_frames()` không cần thay đổi parser.
- **DB coverage tăng 12 → 20 ticker** có BCTC (cumulative qua các run).
- **Screening scored_count 11 → 14**, +3 từ tickers được KBS fallback ingest.
- 256/256 backend tests pass, ruff sạch.
- Server stop sạch sau verify.

## 6. Tồn đọng

- **Vnstock rate limit là constraint chính**: `vnstock_financial=FRESH` consistently chưa đạt vì quota guest 20 req/min burnt giữa run. Hướng giải quyết (Mốc 3 follow-up):
  - Vnstock paid API key (insiders program) — fastest path.
  - Tăng `VNSTOCK_RATE_LIMIT_S` cho financial path lên ~25s — slows full refresh 7 phút → ~25 phút.
  - Per-call gating thay vì per-ticker gating (BCTC = 4 sub-calls/ticker) — đòi rewrite gate logic.
- **KBS alias mapping chưa đầy đủ**: `total_assets`, `revenue`, `total_liabilities` trong KBS path về 0. Screening vẫn hoạt động nhưng ratio chính xác có thể sai. Cần map thêm KBS `item_id` schema khi cần ratio chuẩn.
- **Các step Mốc 3 còn lại** (chưa bắt đầu):
  - Playwright critical-path smoke (login → refresh → run → dashboard → portfolio → backtest → share → PDF).
  - Telegram real-send verify với Bot token + chat ID thật.
  - Next/security upgrade + dependency audit FE/BE.
  - Production env config + backup strategy SQLite.
  - PDF check trong browser cả 2 modes (weasyprint + html_mock).
  - Cron refresh schedule (TAD g05) chưa wire vào systemd/cron.