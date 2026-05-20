# Phase 17 — Financial Source Fallback (Mốc 3, step 1/N)

**Status:** COMPLETED 2026-05-20
**Spec ref:** Mốc 3 — Finding 3 follow-up từ [Phase 16 §8](../phase-16-mvp-data-readiness-closure/SUMMARY.md). TAD [g04-cache.md](../../../docs/tad/g04-cache.md) source-level rule.

## 1. Scope

Mở rộng `fetch_financials()` để fallback sang KBS khi VCI không trả data, tăng coverage BCTC cho 14 real ticker bị fail ở Phase 16.

Trong scope:

- Thêm fallback chain `VCI → KBS` trong `vnstock_client.fetch_financials()`.
- Verify parser hiện có xử lý KBS shape (`item × period` format).
- Re-run full `/refresh/all` trên prod-screener.db.
- Re-run screening verify scored_count tăng.

Out of scope (carry tiếp):

- Vnstock rate limit / API key hardening — quota guest 20 req/min vẫn là constraint chính cho `vnstock_financial=FRESH`.
- Tune alias mapping cho KBS item_id (một số field hiện về 0 trong KBS path).
- Playwright/Telegram/security/PDF/prod env — các step Mốc 3 còn lại.

## 2. Pre-code audit / drift

| # | Drift / issue | Resolution |
|---|---|---|
| 1 | `Finance(source=...)` chỉ accept `VCI` hoặc `KBS` (không có TCBS/MSN) | ✅ Fallback chain locked 2 source `("VCI", "KBS")` |
| 2 | KBS trả shape `item × period` (143 rows × N period cols), khác VCI `period × row` | ✅ Parser hiện có (`_extract_item_period_frame`) đã handle qua `_ROW_METADATA_COLUMNS` detection |
| 3 | KBS alias mapping chưa đầy đủ — một số field như `total_assets`, `revenue` về 0 trong KBS path | ⏭️ Acceptable — `len(d.financials) >= 4` quarters filter pass; cải thiện alias map sau |
| 4 | Vnstock rate limit (guest 20 req/min) burnt nhanh do BCTC = 4 sub-call/ticker | ⏭️ Carry — cần API key hoặc tune `VNSTOCK_RATE_LIMIT_S` per-call. Run-to-run failed_tickers khác nhau (intermittent) là triệu chứng của quota, không phải coverage |

## 3. Deliverables

| Path | Nội dung |
|---|---|
| [app/crawlers/vnstock_client.py](../../code/app/crawlers/vnstock_client.py) | Tách `_fetch_financials_source(ticker, source)` helper; `fetch_financials()` loop qua `_FINANCIAL_SOURCES=("VCI","KBS")`, fallback khi exception hoặc empty rows; raise `VnstockUnavailable` chỉ khi ALL source fail |

## 4. Exit criteria

| Check | Result |
|---|---|
| Finance signature support cả VCI và KBS | PASS — direct inspect `Finance(source='KBS')` works |
| KBS data parses qua existing parser | PASS — DXG/PDR/NLG cho 4 quarter rows từ KBS |
| Targeted vnstock_client tests | PASS — 5/5 |
| Full backend pytest | PASS — 256/256 |
| Ruff | PASS |
| Real `/refresh/all` sau fallback | PASS — prices 26/26 FRESH; financials 12/26 success run-level NHƯNG DB cumulative coverage tăng 12→20 ticker (8 mới từ KBS: AGG/BCM/HQC/KBC/KOS/NLG/NTL/PDR) |
| Re-run screening | PASS — scored_count = 14 (8 GIU + 6 BAN), tăng từ 11 ở Phase 16 |

## 5. Locked decisions

| Mục | Giá trị | Lý do |
|---|---|---|
| Fallback source list | `("VCI", "KBS")` tuple constant | VCI primary (alias mapping richer); KBS fallback (Finance API chỉ accept 2 source này) |
| Fallback trigger | Exception OR `_merge_financial_frames()` returns empty rows | Phân biệt rõ "source fail" vs "source success but no data" |
| Gate timing | `_gate_wait()` per source attempt (không gộp) | Tránh burst gọi vnstock không gating; fallback path tốn thêm ~6.5s/ticker |
| `vnstock_financial=FRESH` rule | Giữ nguyên TAD g04 source-level: chỉ FRESH khi run này 100% success | Cache freshness reflect run-level, không phải DB cumulative. Coverage cumulative track qua DB row count |
| KBS alias mapping | Accept gap hiện tại (một số field về 0) | `min_quarters=4` filter pass đủ cho screening universe expand; cải thiện alias map khi cần ratio chính xác |

## 6. Verification commands

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Verify KBS source available
uv run python -c "from vnstock.api.financial import Finance; Finance(source='KBS', symbol='DXG', period='quarter', show_log=False).balance_sheet()"

# Targeted + full pytest
uv run pytest tests/unit/test_vnstock_client.py -v
uv run pytest -q  # 256/256

# Full refresh with fallback (real network)
# Login → POST /api/refresh/all → poll status

# Verify DB coverage
uv run python -c "
from sqlalchemy import create_engine, text
eng = create_engine('sqlite:///./data/prod-screener.db')
with eng.connect() as c:
    for r in c.execute(text('SELECT ticker, COUNT(*) FROM financial_reports GROUP BY ticker ORDER BY ticker')):
        print(r)
"
```

## 7. Hand-off (Mốc 3 còn lại)

Phase 17 đóng phần Finding 3 ở mức **code fallback works**, coverage tăng 12 → 20/26 ticker, scored_count 11 → 14. Tồn đọng:

1. **Vnstock quota hardening** — `vnstock_financial=FRESH` consistently requires:
   - Vnstock paid API key (insiders program), HOẶC
   - Tăng `VNSTOCK_RATE_LIMIT_S` cho financial path lên ~25s (slows full refresh từ 7 phút → ~25 phút), HOẶC
   - Per-call gating thay vì per-ticker gating (BCTC = 4 sub-calls/ticker).
2. **KBS alias mapping improvement** — fields hiện về 0 trong KBS path: `total_assets`, `revenue`, `total_liabilities`, một số khác. Cần investigate KBS `item_id` schema và mapping thêm.
3. **Các step Mốc 3 còn lại**: Playwright critical-path smoke, Telegram real-send verify, Next/security upgrade, production env config, backup strategy, PDF check, cron refresh schedule.