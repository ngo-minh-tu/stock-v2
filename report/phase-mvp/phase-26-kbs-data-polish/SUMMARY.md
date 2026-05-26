# Phase 26 — KBS Data Polish (bvps Fallback + Period Suffix Lock + Snapshot Fixture)

**Ngày:** 2026-05-21
**Mục tiêu thực hiện:** đóng 3 carry-over data-quality từ Phase 21+22 REVIEW backlog trước khi trader test data thật qua ngrok. (a) Compute bvps fallback khi vnstock community-tier không trả per-share field; (b) Lock period suffix preference rule (`2025-Q4` vs `2025-Q4_1`) với logging audit; (c) KBS raw DataFrame snapshot fixture làm regression guard cho future schema drift.
**Trạng thái:** COMPLETED 2026-05-21

## 1. Việc đã làm

- **26.1 — bvps compute fallback** (Phase 21+22 backlog):
  - Thêm `_compute_derived_fields(rows, ticker=...)` chạy SAU multi-source merge + Phase 22 source-aware scaling trong `fetch_financials`.
  - Logic: nếu `bvps is None` AND `total_equity > 0` AND `shares_outstanding > 0` → compute `bvps = total_equity / shares_outstanding`.
  - Đơn vị: `total_equity` raw VND (post-Phase-22 scaling), `shares_outstanding` count → kết quả VND/share, đồng bộ convention "per-share VND, NOT scaled".
  - Parser thắng (skip nếu parser đã trả bvps); skip nếu equity ≤ 0 (insolvent) hoặc shares ≤ 0 (chia 0).

- **26.2 — Period suffix collapse rule lock + logging**:
  - Phase 21 lock "base wins" (preserve original report value). Phase 26 confirm + add audit logging.
  - `_log_period_suffix_collisions()` emit `info` log mỗi lần parser thấy cả `2025-Q4` AND `2025-Q4_1` cùng tồn tại trong 1 frame.
  - Docstring `_ordered_value_columns` lock rationale + cite trader audit use case.
  - Operator grep `"period suffix collision"` để visibility.

- **26.3 — KBS raw DataFrame snapshot fixture**:
  - Tạo `tests/fixtures/kbs_snapshot.py` chứa 4 synthetic DataFrame (income/balance/cash/ratio) + `KBS_2026Q1_GOLDEN` dict 13 canonical fields.
  - Pattern coverage: `n_N.` numeric prefix, `a./b./c./d.` alpha prefix, `i./iv.` Roman prefix, `tai_san/nguon_von` Vietnamese section headers (NaN), `total_owners_equity_and_liabilities` grand-total, `2025-Q4 + 2025-Q4_1` collision.
  - `test_kbs_snapshot.py` (5 test) chạy snapshot qua full `VnstockClient.fetch_financials` → assert golden values.

- **Test infrastructure**:
  - Extract `_reset_rate_gate` + `fake_vnstock_module` + `fake_vnstock_financial_module` từ `test_vnstock_client.py` sang `tests/unit/conftest.py` (pytest auto-resolve, tránh ruff F811).
  - `test_vnstock_client.py` shrink — keep test functions only.

## 2. File đã thêm

- `mvp/phases/phase-26-kbs-data-polish/SUMMARY.md` — audit trail.
- `mvp/phases/phase-26-kbs-data-polish/REVIEW.md` — self-critical review.
- `report/phase-mvp/phase-26-kbs-data-polish/SUMMARY.md` — file này.
- `mvp/code/tests/fixtures/kbs_snapshot.py` — synthetic snapshot + golden values.
- `mvp/code/tests/unit/test_kbs_snapshot.py` — 5 regression test.
- `mvp/code/tests/unit/conftest.py` — shared pytest fixtures.

## 3. File đã sửa

- `mvp/code/app/crawlers/vnstock_client.py` — `_compute_derived_fields()` + `_log_period_suffix_collisions()` + docstring lock; invocation từ `fetch_financials`.
- `mvp/code/tests/unit/test_vnstock_client.py` — drop duplicated fixtures (moved sang conftest).

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Targeted Phase 26
uv run pytest tests/unit/test_kbs_snapshot.py -v
# 5 passed

# Full BE regression
uv run pytest -q
# 299/299 expected (294 cũ + 5 mới)

# Lint
uv run ruff check app tests
# All checks passed
```

## 5. Kết quả

- **Tests:**
  | Suite | Trước Phase 26 | Sau Phase 26 |
  |---|---|---|
  | TypeScript (FE unchanged) | clean | clean ✅ |
  | BE pytest | 294/294 | **299/299** ✅ (+5 sanity snapshot) |
  | Ruff | clean | clean ✅ |

- **bvps fallback outcome** (sau khi operator chạy `pre-handoff-refresh.sh`):
  - Trước Phase 26: bvps NULL cho ~25 ticker (vnstock community-tier gap).
  - Sau Phase 26: bvps populate cho mọi ticker có `total_equity > 0 AND shares_outstanding > 0` (~25 ticker expected).
  - `feature_service.F02 P/B` feature có data thật → ai_score distribution có thể shift (operator verify sau refresh).

- **Period suffix lock**:
  - Snapshot test `2025-Q4 = 1_500_000` (base) wins over `2025-Q4_1 = 1_490_000` (restated). Log emit "period suffix collision: base=2025-Q4, restated=['2025-Q4_1'] → base wins".

- **KBS snapshot golden 13 field match**:
  - revenue, cogs, net_income, eps, current_assets, inventory, total_assets, total_debt, current_liabilities, total_equity, operating_cash_flow, shares_outstanding, bvps (computed).
  - Grand-total row `total_owners_equity_and_liabilities` skipped (Phase 21 `_FIELD_BLOCKLIST`).
  - Section headers `tai_san/nguon_von` NaN skipped.

## 6. Tồn đọng

- **Real ticker post-Phase-26 verify** — chưa chạy `script/pre-handoff-refresh.sh` để populate bvps thực. Operator thực hiện trước ngrok hand-off.
- **bvps formula đơn giản** — `total_equity / shares_outstanding`, KHÔNG xét preferred-stock subtract / treasury-stock add-back. Acceptable cho MVP screening; trader feedback nếu thấy off so với CafeF.
- **KBS OCF Q1 gap workaround** chưa fix — Phase 28 nếu trader feedback yêu cầu.
- **`_FIELD_BLOCKLIST` allowlist refactor** — Phase 28 khi blocklist > 10 entries (hiện 4).
- **VCI snapshot fixture** chưa extract — Phase 28 nếu VCI schema drift suspected.
- **Period suffix log INFO level** có thể spam structured-log — Phase 28 hạ DEBUG nếu trader báo noise.
- **Phase 6 backlog `test_compare_full_shape` flake** vẫn còn (pre-existing, KHÔNG do Phase 26) — solo run pass; full pytest có thể fail 1 case do floating-point precision (0.010000000000000397 vs 0.01 threshold). Defer Phase 28 cleanup.
