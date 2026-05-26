# Phase 21 — Financial Quality + No-Downgrade Upsert

**Ngày:** 2026-05-21
**Mục tiêu thực hiện:** đóng 3 bug data quality treo từ Phase 17-18 (Codex review High) để khi trader audit BCTC qua ngrok không thấy số liệu 0 / NULL / sai. Đây là Mốc 4 step 1 — chuẩn bị data quality trước khi hand-off.
**Trạng thái:** COMPLETED 2026-05-21

## 1. Việc đã làm

- Inspect real KBS shape cho NLG (1 trong 14 ticker fallback) — phát hiện:
  - KBS dùng prefix `n_N.` (revenue, net_profit_after_tax), `a./b./c./d.` (short_term_assets, liabilities, owners_equity), `i./ii./iii./iv.` cho hierarchical items.
  - Header row "TÀI SẢN" / "NGUỒN VỐN" có value NaN, ghi đè giá trị thật ở row total.
  - Grand-total row "TỔNG CỘNG NGUỒN VỐN" (item_id=`total_owners_equity_and_liabilities`) substring-match `owners_equity` → overwrite total_equity với grand total.
  - Column period `2025-Q4_1` (restated) + `2025-Q4` (base) collapse về cùng key `2025Q4`.
- Refactor `_canonical_field`:
  - Strip prefix qua `_KBS_PREFIX_PATTERN` regex `^(?:n_\d+|[abcdefgh]|[ivx]{1,4})_` trước alias lookup.
  - **Drop greedy substring fallback** (second pass). Chỉ exact-match.
  - Thêm `_FIELD_BLOCKLIST = {total_owners_equity_and_liabilities, total_equity_and_liabilities, nguon_von, tai_san}` cho grand-totals + section headers.
- Mở rộng `_FIELD_ALIASES`:
  - `revenue`: thêm `net_sales`, `net_sales_revenue`
  - `net_income`: thêm `profit_after_tax_for_shareholders_of_parent_company`, `net_profit_attributable_to_shareholders_of_parent`
  - `total_assets`: thêm `tong_cong_tai_san` (VN total label)
  - `current_assets/current_liabilities`: thêm `short_term_assets/short_term_liabilities` (KBS hierarchical)
  - `operating_cash_flow`: thêm `net_cash_flows_from_operating_activities` (plural KBS variant)
  - `eps`: thêm `earnings_per_share_vnd` (KBS suffix variant)
  - `advances`: thêm `short_term_advances_from_customers`
- `_to_number` skip NaN + Inf (thêm `math.isnan` + `math.isinf` check). Parser cũng skip None values trước khi ghi `target` dict — không overwrite real value đã ghi trước.
- `_ordered_value_columns` sort suffix-first → base period iterate cuối → base override restated.
- `financial_repo.bulk_upsert` chuyển sang `func.coalesce(excluded.field, FinancialReport.field)` cho mọi non-key field. Sparse upsert giữ existing values.
- Restructure `fetch_financials` thành **multi-source merge**:
  - Try ALL sources sequentially (VCI → KBS).
  - Merge per `(period)` — primary VCI wins overlap, KBS fills gaps.
  - Trade-off ~22 phút refresh thay 14 phút (8 sub-call/ticker thay 4).
- Verify real NLG (VCI + KBS merge): trước fix `total_assets=0, net_income=NULL, eps=NULL`. Sau fix `total_assets=25894B, net_income=347M, eps=679`.

## 2. File đã thêm

- `mvp/phases/phase-21-financial-quality-no-downgrade/SUMMARY.md` — audit trail 9-section.
- `mvp/code/tests/integration/test_financial_repo.py` — 2 test no-downgrade.
- `report/phase-mvp/phase-21-financial-quality-no-downgrade/SUMMARY.md` — file này.

## 3. File đã sửa

- `mvp/code/app/crawlers/vnstock_client.py` — alias expand + blocklist + prefix strip + NaN skip + period suffix preference + multi-source merge.
- `mvp/code/app/repositories/financial_repo.py` — `bulk_upsert` COALESCE no-downgrade.
- `mvp/code/tests/unit/test_vnstock_client.py` — +3 test (KBS prefix/NaN/blocklist, period suffix, multi-source merge, VCI-raise-KBS-fallback).

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Targeted regression
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_financial_repo.py -v
# 12 passed

# Full BE regression
uv run pytest -q
# 263/263 passed

# Lint
uv run ruff check app tests
# All checks passed

# Real KBS NLG verify (1 ticker, ~52s do per-sub-call gating)
PYTHONPATH=. uv run python -c "
from app.crawlers.vnstock_client import VnstockClient
rows = VnstockClient(rate_limit_s=0.5).fetch_financials('NLG')
for r in rows[:2]:
    print(r['period'], 'total_assets=', r.get('total_assets'), 'net_income=', r.get('net_income'))
"
```

## 5. Kết quả

- **Test:**
  - Targeted: 12/12 pass.
  - Full backend: 263/263 pass (5 mới: 3 vnstock_client + 2 financial_repo).
  - Ruff: All checks passed.

- **Real NLG inspection (1 trong 14 ticker fallback KBS):**

  | Field | Trước Phase 21 | Sau Phase 21 |
  |---|---|---|
  | `total_assets` | 0 (literal) | 25894B (real) |
  | `total_equity` | wrong (grand total = total_assets) | 14910B (real) |
  | `total_debt` | NEGATIVE (provisions counted) | 10983B (real positive) |
  | `revenue` | populated (already worked) | 1279B (multi-source merged) |
  | `net_income` | NULL | 347M (KBS filled gap) |
  | `eps` | NULL | 679 VND/share (KBS filled gap) |
  | `current_assets/liabilities`, `inventory`, `cogs`, `advances` | mixed | tất cả populated |
  | `operating_cash_flow` (Q1 2026) | NULL | Q1=NULL (KBS data gap), Q4=-936M (populated) |
  | `bvps` | NULL | NULL (vnstock community-tier không trả field) |

- **Production refresh chưa chạy trong phiên này** — code fix đã verify với 1 ticker real (NLG). Operator chạy `/api/refresh/all` trước khi hand-off ngrok cho trader (~22 phút cho 26 ticker × 2 sources).

## 6. Tồn đọng

- **`bvps` toàn NULL** — vnstock community-tier không trả `book_value_per_share`. Workaround: compute downstream `bvps = total_equity / shares_outstanding` (Phase 22).
- **`operating_cash_flow` partial** — KBS chỉ có OCF cho 1-2 quarter gần nhất (vd Q4 2025), Q1 2026 thường NULL do báo cáo Q1 chưa publish. Phenomena vnstock-side.
- **Financial unit scaling chưa apply** — KBS + VCI return ngàn đồng (×1000 → VND). Phase 16 đã scale prices nhưng KHÔNG scale financials. Hệ quả: trader xem báo cáo qua UI/PDF sẽ thấy giá trị nhỏ hơn thực tế 1000 lần. **Phase 22 sẽ apply** `_scale_vnd` cho financial fields ở ingest boundary, đồng nhất với prices.
- **Refresh time ~22 phút** — chấp nhận được cho cron weekday 16:30 ICT. Vnstock Insiders paid key sẽ giảm xuống ~3 phút (Phase 18 backlog).
- **Production refresh prod-screener.db chưa chạy trong phase này** — carry sang Phase 22 (sau khi unit scaling cũng đóng để refresh chỉ chạy 1 lần).
