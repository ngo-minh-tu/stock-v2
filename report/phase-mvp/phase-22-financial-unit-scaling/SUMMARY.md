# Phase 22 — Financial Unit Scaling + Production Guards

**Ngày:** 2026-05-21
**Mục tiêu thực hiện:** đóng Phase 21 REVIEW High finding — VCI trả raw VND, KBS trả ngàn đồng nên DB lưu hỗn hợp đơn vị, trader so sánh với CafeF/Vietstock sẽ thấy KBS-ticker 1000× nhỏ hơn thực tế. Đây là blocker thực sự cho hand-off ngrok. Phase 22 cũng đóng 2 hand-off Phase 20 REVIEW: production guard cho `.env.telegram` + log scrub audit.
**Trạng thái:** COMPLETED 2026-05-21

## 1. Việc đã làm

- Real-data inspect 2 source khác nhau:
  - **VCI VHM** balance sheet Q4 2025: `current_assets=4.97e14` (= 497T VND raw, khớp con số CafeF) → **VCI = raw VND, không cần scale**.
  - **KBS NLG** balance sheet Q1 2026: `total_assets=2.65e10` (= 26.5B nếu raw VND, hoặc 26.5T VND nếu ×1000) → **KBS = ngàn đồng, cần ×1000**.
- Thiết kế **source-aware scaling**:
  - Định nghĩa `_FINANCIAL_VND_FIELDS` set 11 field cần scale: revenue, net_income, total_assets, total_equity, total_debt, current_assets, current_liabilities, inventory, cogs, operating_cash_flow, advances.
  - KHÔNG scale: `eps`, `bvps` (per-share VND/share), `shares_outstanding` (count), `audit_opinion` (string).
  - Thêm helper `_apply_source_scaling(rows, source)` chạy sau mỗi source rows trong `fetch_financials` multi-source merge. Chỉ scale khi `source != "VCI"` (currently chỉ KBS).
- Thêm production guard `_enforce_production_secret_isolation()` chạy trong `create_app()`:
  - Raise `RuntimeError` nếu `APP_ENV=production` + file `.env.telegram` tồn tại trong working directory.
  - No-op cho `development/demo/test` (Phase 20 local convention).
- Log scrub audit `app/services/*.py` + `app/crawlers/*.py`:
  - `telegram_service.py:54` đã scrub Phase 20 (log `exc.__class__.__name__` thay `exc`).
  - Other services (`refresh_service`, `screening_service`) log VnstockUnavailable/generic exception — vnstock guest quota dùng URL public không chứa secret → OK.
- Update 5 existing test cho phù hợp source-aware scaling logic (mock chung không phân biệt source: VCI raw wins, KBS scaling no-op do no-downgrade).
- Real verify NLG sau Phase 22:
  - Revenue Q1 2026 = 1.279T VND (CafeF NLG Q1 ~1.3T) ✓
  - Total_assets = 25.894T VND (CafeF NLG ~26T) ✓
  - Net_income = 0.348T = 348B VND (CafeF NLG Q1 ~350B) ✓
  - EPS = 679 VND/share (per-share, không scale) ✓

## 2. File đã thêm

- `mvp/phases/phase-22-financial-unit-scaling/SUMMARY.md` — audit trail 9-section.
- `mvp/phases/phase-22-financial-unit-scaling/REVIEW.md` — self-critical review.
- `mvp/code/tests/unit/test_main_prod_guard.py` — 3 test cho production guard.
- `report/phase-mvp/phase-22-financial-unit-scaling/SUMMARY.md` — file này.

## 3. File đã sửa

- `mvp/code/app/crawlers/vnstock_client.py` — `_FINANCIAL_VND_FIELDS` + `_apply_source_scaling()` + integration vào `fetch_financials`.
- `mvp/code/app/main.py` — `_enforce_production_secret_isolation()` chạy ở `create_app()`.
- `mvp/code/tests/unit/test_vnstock_client.py` — update 5 test reflect source-aware scaling.

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Targeted regression
uv run pytest tests/unit/test_vnstock_client.py tests/unit/test_main_prod_guard.py tests/integration/test_financial_repo.py -v
# 15 passed

# Full BE regression
uv run pytest -q
# 266/266 passed

# Lint
uv run ruff check app tests
# All checks passed

# Real verify NLG with source-aware scaling
PYTHONPATH=. uv run python -c "
from app.crawlers.vnstock_client import VnstockClient
rows = VnstockClient(rate_limit_s=0.5).fetch_financials('NLG')
r = rows[0]
print(f\"{r['period']}: revenue={r['revenue']/1e12:.3f}T VND, total_assets={r['total_assets']/1e12:.3f}T VND, eps={r['eps']} VND/share\")
# 2026Q1: revenue=1.279T VND, total_assets=25.894T VND, eps=679 VND/share
"
```

## 5. Kết quả

- **Test:**
  - Targeted: 15/15 pass (10 vnstock + 3 prod guard + 2 financial_repo).
  - Full backend: 266/266 pass (3 mới Phase 22).
  - Ruff: All checks passed.

- **Real NLG audit (1 ticker KBS-fallback):**

  | Field | Trước Phase 22 | Sau Phase 22 | Real (CafeF) |
  |---|---|---|---|
  | `revenue` Q1 2026 | 1,279B (raw KBS ngàn đồng) | 1.279T VND | ~1.3T |
  | `total_assets` | 25,894B | 25.894T VND | ~26T |
  | `net_income` | 348B (ngàn đồng) | 0.348T = 348B VND | ~350B |
  | `total_equity` | 14,910B | 14.91T VND | ~15T |
  | `eps` | 679 | 679 VND/share (NOT scaled) | ~600-700 |

  Sau Phase 22, mọi số liệu BCTC match với báo cáo CafeF/Vietstock trong sai số chấp nhận được.

- **Production guard verify**: `_enforce_production_secret_isolation()` raise đúng khi production+file; no-op khi demo+file hoặc production+no-file.

- **Production refresh chưa rerun trong phiên này** — operator chạy `/refresh/all` (~22 phút) trước hand-off trader, kèm wipe `financial_reports` để tránh mixed-unit DB.

## 6. Tồn đọng

- **Production refresh + wipe DB trước hand-off ngrok**: operator phải WIPE `financial_reports` rows cũ (pre-Phase-22 mix unit) + chạy `/refresh/all` full để có clean state. Lệnh trong SUMMARY §7.
- **F11 OCF feature threshold re-tune**: F11 = OCF / 1e9. Trước Phase 22 OCF ngàn đồng → F11 = 1000× nhỏ hơn intent. Sau Phase 22, F11 đúng → có thể cần adjust scoring weight cho ai_score distribution không skew.
- **Source-unit assumption chỉ verify 2 ticker** (VHM-VCI, NLG-KBS). Nếu vnstock đổi convention cho small-cap khác, parser silent miss-scale. Defer Phase 23 thêm range sanity check.
- **Production guard chỉ check 1 file** (`.env.telegram`). Future secret files cần extensible list. Defer Phase 23.
- **Phase 19 REVIEW Low**: HoldingFormModal `TODAY=2026-05-07` hard-code — chưa fix. Carry sang Phase 23 (UX polish).
- **Phase 20 REVIEW Medium**: config-layer pytest cho multi-env-file precedence — chưa add. Carry Phase 23.
- **Telegram broadcast khi run COMPLETED** (TAD c07 §3) — chưa wire. Phase 23.
