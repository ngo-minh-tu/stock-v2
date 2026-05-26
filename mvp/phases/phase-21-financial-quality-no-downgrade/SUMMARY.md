# Phase 21 — Financial Quality + No-Downgrade Upsert

**Started:** 2026-05-21 · **Closed:** 2026-05-21
**Roadmap:** Mốc 4 step 1 (Data quality cho trader audit) — fix BCTC coverage 14 ticker KBS-fallback + 12 ticker VCI-sparse trước khi expose qua ngrok cho trader test.

## 1. Scope

Đóng 3 finding bug đã treo từ Phase 17-18 (Codex review High):

1. **KBS alias mapping incomplete** — 14 ticker từ KBS fallback có `total_assets / total_debt / total_equity = 0` thay vì giá trị thật.
2. **`bulk_upsert()` downgrade risk** — sparse fallback row có thể overwrite VCI rich row, mất data.
3. **First-non-empty-wins trong `fetch_financials`** — 12 ticker VCI return data sparse → KBS không bao giờ được dùng → `net_income / eps / operating_cash_flow` toàn NULL.

Out of scope: financial unit scaling (vnstock KBS trả ngàn đồng, chưa scale ×1000 tại ingest boundary — defer Phase 22 nếu trader phát hiện); KBS data gaps cho `bvps` + `operating_cash_flow` quarter-mới (vnstock-side limitation).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 21-01 | Real KBS inspection (NLG): item_ids dùng prefix `n_N.` (n_1.revenue, n_18.net_profit_after_tax), `a./b./c./d.` (a.short_term_assets, c.liabilities, d.owners_equity), `i./ii./iii./iv.` (i.short_term_liabilities). Parser hiện không strip prefix. | `vnstock_client.py` | Thêm `_KBS_PREFIX_PATTERN` regex `^(?:n_\d+|[abcdefgh]|[ivx]{1,4})_` strip trước alias lookup. |
| 21-02 | Substring fallback trong `_canonical_field` quá greedy: `total_owners_equity_and_liabilities` (grand total = total_assets value) substring-match `owners_equity` → overwrite `total_equity` với grand total. Phase 17 Codex review High. | `vnstock_client.py` | Drop second-pass substring matcher; chỉ exact-match. Thêm `_FIELD_BLOCKLIST` cho grand-totals + section headers (`total_owners_equity_and_liabilities`, `total_equity_and_liabilities`, `nguon_von`, `tai_san`). |
| 21-03 | `_to_number(NaN)` trả NaN (float), không phải None. Header row "TÀI SẢN" (item_id=`assets`, value=NaN) ghi đè real total_assets ở row sau. | `vnstock_client.py` | Thêm `math.isnan` + `math.isinf` check trong `_to_number`. Parser cũng skip None/NaN giá trị trước khi ghi vào `target` dict — không overwrite real value đã ghi trước. |
| 21-04 | Period suffix `2025-Q4_1` (restated) + `2025-Q4` (base) cùng parse về key `2025Q4`. Last-wins không xác định, phụ thuộc thứ tự column DataFrame. Phase 17 Codex Medium. | `vnstock_client.py` | `_ordered_value_columns` sort suffix-first (`_N`), base period iterate cuối → base override restated. |
| 21-05 | `financial_repo.bulk_upsert` set_={field: excluded.field} ép sparse KBS row overwrite VCI rich. Phase 18 Codex High. | `financial_repo.py` | `func.coalesce(excluded.field, FinancialReport.field)` cho mọi field trừ year/quarter — None mới chỉ giữ existing value. |
| 21-06 | `fetch_financials` first-non-empty-wins: VCI return rows (dù sparse) → KBS không thử → 12 ticker miss `net_income/eps/OCF`. | `vnstock_client.py` | Restructure thành **multi-source merge**: try ALL sources, merge per `(period)` — primary VCI wins on overlap, fallback KBS fills gaps. Trade-off: ~22 phút refresh thay 14 (8 sub-call/ticker thay 4). |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `mvp/code/app/crawlers/vnstock_client.py` | `_FIELD_ALIASES` mở rộng (KBS-specific keys: `net_cash_flows_from_operating_activities` plural, `earnings_per_share_vnd`, `profit_after_tax_for_shareholders_of_parent_company`, `short_term_assets/liabilities`); `_FIELD_BLOCKLIST` mới; `_KBS_PREFIX_PATTERN` strip; `_canonical_field` exact-match only; `_to_number` skip NaN/Inf; `_extract_item_period_frame` skip None values; `_ordered_value_columns` sort suffix-first; `fetch_financials` multi-source merge. |
| `mvp/code/app/repositories/financial_repo.py` | `bulk_upsert` chuyển sang `COALESCE(excluded.field, FinancialReport.field)` cho mọi non-key field. Year/quarter hard-overwrite (always present). |
| `mvp/code/tests/unit/test_vnstock_client.py` | +3 test: KBS prefix strip + NaN skip + blocklist (`test_kbs_balance_sheet_strips_prefix_and_skips_nan_header`); period suffix preference (`test_kbs_period_suffix_prefers_base_period`); multi-source merge VCI-wins/KBS-fills (`test_fetch_financials_merges_multiple_sources`); VCI-raises-KBS-fallback (`test_fetch_financials_falls_back_to_kbs_when_vci_raises`). |
| `mvp/code/tests/integration/test_financial_repo.py` (new) | 2 test: `test_bulk_upsert_no_downgrade_keeps_existing_non_null` (sparse upsert giữ existing); `test_bulk_upsert_overwrites_field_when_new_value_non_null` (non-null vẫn overwrite). Synthetic period `2099Q1` để không collide seed data. |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| Parser KBS map đúng `total_assets/total_debt/total_equity/revenue/net_income/eps` (trước đó NULL hoặc 0) | ✅ | Real KBS NLG inspect: trước = `total_assets=0, total_equity=wrong, total_debt=negative provisions`. Sau = `total_assets=25894B, total_equity=14910B, total_debt=10983B` (Q1 2026). |
| Multi-source merge VCI+KBS lấp gap | ✅ | Real NLG: trước fix `net_income=NULL, eps=NULL`. Sau fix `net_income=347M, eps=679`. |
| Grand-total row không pollute total_equity | ✅ | Unit test `test_kbs_balance_sheet_strips_prefix_and_skips_nan_header` cụ thể assert `total_equity != grand_total`. |
| `bulk_upsert` no-downgrade hoạt động | ✅ | Integration test verify sparse upsert giữ existing 13 field non-null. |
| Backend pytest pass | ✅ | 263/263 (5 mới: 3 vnstock + 2 financial_repo). |
| Ruff clean | ✅ | `uv run ruff check app tests` — All checks passed. |
| Không break existing functionality | ✅ | Existing test `test_fetch_financials_merges_quarterly_frames` (VCI-shape) vẫn pass sau khi thêm `equity` lại vào alias set. |

## 5. Quyết định khoá trong phase này

- **Exact-match only** thay greedy substring fallback. Trade-off: phải maintain alias list rộng hơn (đã add ~10 KBS-specific keys). Lợi: predictable, không bị grand-total contamination.
- **Multi-source = sequential merge** thay vì parallel. Lý do: vnstock global rate gate đã serialize call rồi, parallel không giúp; sequential dễ debug + log per-source.
- **Primary VCI wins on overlap, KBS fills gaps**. Lý do: VCI là primary spec source theo TAD g04; KBS fallback có nhiều field nhưng schema kém ổn định (period suffix, prefix variants).
- **Refresh time trade-off ~22 phút thay 14 phút**: chấp nhận. Refresh chạy off-hours / cron, không block UX. Có thể giảm xuống ~3 phút với vnstock Insiders paid key (Phase 18 backlog).
- **`_to_number` reject NaN + Inf**: an toàn cho mọi numeric column trong DB (Decimal/Numeric không lưu NaN sạch).
- **Period suffix base wins**: giữ original report value, không lấy restated. Nếu KBS publish restated với `_1` suffix, base period vẫn sẽ override → trader thấy original report. Rule này có thể flip nếu user feedback cần restated.

## 6. Issues / drift còn open

- **`bvps` toàn NULL cho mọi ticker** — vnstock-side data gap. Cả VCI và KBS không trả `book_value_per_share` cho cộng đồng-tier. Có thể compute downstream: `bvps = total_equity / shares_outstanding`. Defer Phase 22.
- **`operating_cash_flow` partial coverage** — KBS chỉ trả OCF cho 1-2 quarter gần nhất (vd Q4 2025), Q1 2026 thường NULL khi báo cáo Q1 chưa publish OCF. Đây là phenomena vnstock community-tier, không phải bug.
- **Financial unit scaling chưa apply** — KBS + VCI return ngàn đồng (×1000 → VND). Phase 16 đã scale prices nhưng KHÔNG scale financials. Hệ quả: trader xem báo cáo qua UI/PDF sẽ thấy giá trị nhỏ hơn thực tế 1000 lần. Phase 22 sẽ apply `_scale_vnd` cho financial fields ở ingest boundary, đồng nhất với prices.
- **Refresh time ~22 phút** — chấp nhận được cho cron weekday 16:30 ICT, nhưng người demo có thể impatient. Vnstock Insiders paid key sẽ giảm xuống ~3 phút (Phase 18 backlog).
- **Production refresh chưa chạy trong phase này** — code fix verified với 1 ticker real (NLG), chưa rerun toàn 26 ticker prod DB. Operator chạy `/api/refresh/all` trước khi hand-off ngrok cho trader (xem §7).

## 7. Test commands (reproducible)

```bash
cd mvp/code

# Targeted regression (Phase 21 specifically)
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_financial_repo.py -v
# 12 tests pass (10 vnstock + 2 financial_repo)

# Full BE regression
uv run pytest -q
# 263/263 pass

# Lint
uv run ruff check app tests
# All checks passed

# Real KBS verify (single ticker, costs 1 quota burst ~8 sub-calls × 6.5s = 52s)
PYTHONPATH=. uv run python -c "
from app.crawlers.vnstock_client import VnstockClient
rows = VnstockClient(rate_limit_s=0.5).fetch_financials('NLG')
print(f'Got {len(rows)} rows')
for r in rows[:2]:
    print(r['period'], 'total_assets=', r.get('total_assets'), 'net_income=', r.get('net_income'), 'eps=', r.get('eps'))
"

# Production refresh (operator runs BEFORE hand-off trader, ~22 min)
cp env.production.example .env  # or existing prod .env
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS -X POST http://localhost:8000/api/refresh/all -H "Authorization: Bearer $TOKEN"

# Audit DB coverage after refresh
PYTHONPATH=. uv run python -c "
from app.db.session import SessionLocal
from app.models.financial import FinancialReport
from sqlalchemy import select
with SessionLocal() as db:
    rows = db.execute(select(FinancialReport)).scalars().all()
    by_ticker = {}
    for r in rows:
        by_ticker.setdefault(r.ticker, []).append(r)
    for ticker, rs in sorted(by_ticker.items()):
        latest = max(rs, key=lambda x: (x.year, x.quarter))
        n_full = sum(1 for f in ['revenue','net_income','total_assets','total_equity','total_debt'] if getattr(latest, f))
        print(f'{ticker:6} {latest.period}: {n_full}/5 core fields')
"
```

## 8. Hand-off cho Phase 22 (Mốc 4 step 2)

1. **Telegram log scrub audit** — kiểm tất cả `app/services/*.py` xem có `log.warning("%s", exc)` nào leak URL chứa token không.
2. **`.env.telegram` production guard** — startup check fail nếu `APP_ENV=production` + file tồn tại.
3. **Financial unit scaling ×1000** — apply `_scale_vnd` cho financial fields tại ingest boundary, đồng nhất với prices Phase 16. Cần re-run /refresh/all sau khi scale.

## 9. Post-phase fixes

*Reserved. Mọi user-requested fix sau khi phase đóng append vào đây với date + scope.*
