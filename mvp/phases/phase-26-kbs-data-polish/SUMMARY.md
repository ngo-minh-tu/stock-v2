# Phase 26 — KBS Data Polish (bvps Fallback + Period Suffix Lock + Snapshot Fixture)

**Started:** 2026-05-21 · **Closed:** 2026-05-21
**Roadmap:** Track 3 Data Quality — Phase 21+22 backlog đóng chéo (bvps gap cho ticker community-tier + period suffix collapse rule audit + KBS schema drift regression guard). KHÔNG đợi trader feedback vì 3 deliverable đều có acceptance criteria rõ ràng + ROI cao cho pre-handoff (data trader sẽ tham chiếu).

## 1. Scope

3 sub-task song hành, all locked Phase 21 REVIEW + Phase 22 REVIEW backlog:

1. **26.1 — bvps compute fallback** (Phase 21+22 backlog): vnstock community-tier (cả VCI và KBS) thường bỏ trống `bvps` per-share. Phase 21 đã populate `total_assets/net_income/eps` nhưng `bvps` vẫn NULL → `feature_service.F02 P/B` thiếu data. Phase 26 thêm `_compute_derived_fields(rows, ticker=...)` chạy sau multi-source merge: nếu `bvps is None` AND `total_equity > 0` AND `shares_outstanding > 0`, compute `bvps = total_equity / shares_outstanding` (raw VND / count = VND/share).

2. **26.2 — Period suffix collapse rule lock + logging** (Phase 21 §2 carry — "confirm với trader hoặc vnstock docs"): KBS thỉnh thoảng ship cả `2025-Q4` (base) AND `2025-Q4_1` (restated). Cả hai map về cùng period key `2025Q4`. **Locked decision (Phase 26):** base wins (preserve originally-reported value cho trader audit). Add `_log_period_suffix_collisions()` emit `info` log mỗi lần collision → operator grep audit visibility. KHÔNG flip default. Docstring + memory đầy đủ rationale.

3. **26.3 — KBS raw DataFrame snapshot fixture** (Phase 21 REVIEW High carry): Synthetic snapshot mô phỏng KBS-shape thực (item × period với prefix `n_N.`, `a.`-`d.`, `i.`-`x.`, grand-total row, section header NaN, period suffix collision). Save trong `tests/fixtures/kbs_snapshot.py` cộng golden expected values per canonical field. Regression test `test_kbs_snapshot.py` chạy snapshot qua full `fetch_financials` → assert golden — catch schema drift nếu vnstock đổi KBS layout future.

Out of scope: KBS OCF Q1 gap (workaround từ change-in-cash equiv — defer Phase 28 nếu trader feedback yêu cầu); `_FIELD_BLOCKLIST` → allowlist refactor (Phase 21 REVIEW Medium — defer, blocklist hiện đủ với 4 known grand-totals).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 26-01 | bvps fallback site: parser-time hay runtime? Parser-time persists vào DB → cả Portfolio cost basis + Stock Detail card + F02 P/B đều benefit. Runtime (`feature_service`) chỉ patch F02. | `vnstock_client.py` | Parser post-merge — `_compute_derived_fields` sau `_apply_source_scaling` cho mọi row. |
| 26-02 | `total_equity` đã raw VND sau Phase 22 scaling; `shares_outstanding` là count (NOT scaled). Formula `bvps = total_equity / shares_outstanding` = VND/share. Đồng bộ Phase 22 convention "per-share VND, NOT scaled". | `_compute_derived_fields` | Comment-locked rationale. |
| 26-03 | bvps fallback chỉ activate khi parser MISS — guard `if row.get("bvps") is not None: continue`. Trade-off: parser-provided bvps có thể outdated (vnstock community-tier lag), nhưng KHÔNG biết khi nào parser-value chính xác hơn fallback-value → KHÔNG ghi đè để tránh regression. | `_compute_derived_fields` | Parser thắng. Skip fallback nếu equity ≤ 0 (insolvent) hoặc shares ≤ 0 (chia 0). |
| 26-04 | Period suffix preference Phase 21 chốt "base wins" — nhưng accounting convention thường restated thắng (đã audit). Phase 21 lý do "preserve original report giúp trader audit". Trader feedback chưa có → KHÔNG flip. | `_ordered_value_columns` | Docstring + memory lock; log collision để operator audit. |
| 26-05 | Snapshot fixture phải capture real KBS shape (item_id prefix, column ordering, grand-total wording) nhưng KHÔNG capture real ticker (PII + license). | `tests/fixtures/kbs_snapshot.py` | Synthetic NLG-like data với mọi pattern thực (n_1./a./b./c./d./i./tai_san/nguon_von/total_owners_equity_and_liabilities + 2025-Q4_1 collision). |
| 26-06 | Snapshot regression test phải end-to-end (parser → merge → scale → bvps fallback) thay vì chỉ test `_extract_item_period_frame` riêng lẻ. Vì regression có thể từ bất kỳ stage nào. | `test_kbs_snapshot.py` | Drive qua `VnstockClient.fetch_financials` full path với KBS-only mock (VCI empty). |
| 26-07 | Shared fixtures `fake_vnstock_financial_module` + `_reset_rate_gate` duplicated giữa `test_vnstock_client.py` và new `test_kbs_snapshot.py`. Import qua module gây ruff F811 (redefinition khi pytest auto-injects). | `tests/unit/conftest.py` (new) | Extract sang conftest — auto-resolve by name, no import needed. |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `mvp/code/app/crawlers/vnstock_client.py` | `_compute_derived_fields()` helper (bvps fallback); `_log_period_suffix_collisions()` helper; docstring lock cho `_ordered_value_columns`; invocation từ `fetch_financials`. |
| `mvp/code/tests/fixtures/kbs_snapshot.py` (new) | Synthetic KBS DataFrame snapshot (4 functions: income/balance/cash/ratio) + `KBS_2026Q1_GOLDEN` dict 13 canonical fields. |
| `mvp/code/tests/unit/test_kbs_snapshot.py` (new) | 5 test: end-to-end snapshot khớp golden + period suffix log + bvps fallback (compute / skip-when-set / skip-invalid). |
| `mvp/code/tests/unit/conftest.py` (new) | Shared fixtures `_reset_rate_gate`, `fake_vnstock_module`, `fake_vnstock_financial_module`. |
| `mvp/code/tests/unit/test_vnstock_client.py` | Drop duplicated fixtures (moved sang conftest). |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| bvps compute fallback chạy khi parser miss | ✅ | `test_bvps_fallback_when_parser_misses` — `total_equity=14.91e12 / shares=380e6 = 39_236.84 VND/share`. |
| bvps fallback KHÔNG ghi đè parser-provided | ✅ | `test_bvps_fallback_skipped_when_parser_already_filled` — parser bvps=12345 wins. |
| bvps fallback skip khi inputs invalid | ✅ | `test_bvps_fallback_skipped_when_inputs_invalid` — negative equity → no bvps. |
| Period suffix collision logged | ✅ | `test_kbs_snapshot_period_suffix_logs_collision` — caplog chứa "period suffix collision". |
| KBS snapshot full parse khớp 13 golden field | ✅ | `test_kbs_snapshot_full_parse_to_golden` — 13/13 fields trong `KBS_2026Q1_GOLDEN` match (revenue/cogs/net_income/eps/current_assets/inventory/total_assets/total_debt/current_liabilities/total_equity/operating_cash_flow/shares_outstanding/bvps). |
| Grand-total row blocklisted (regression) | ✅ | Snapshot có `total_owners_equity_and_liabilities` row — golden `total_assets` chỉ pickup từ legitimate row (25,894M VND scaled), không double-count. |
| Section header NaN skipped | ✅ | Snapshot có `tai_san` + `nguon_von` rows với NaN values — golden vẫn match (no leak). |
| Period suffix base wins | ✅ | `_ordered_value_columns` order suffix=False LAST; last-write-wins via dict. Snapshot `2025-Q4_1 = 1_490_000` ignored, `2025-Q4 = 1_500_000` final. |
| Ruff clean | ✅ | `uv run ruff check app tests` — All checks passed (sau conftest extract + tests reorg). |
| Full BE pytest pass | ⏳ | _(Sẽ confirm 299/299 = 294 + 5 new)_ |

## 5. Quyết định khoá trong phase này

- **bvps fallback parser-time, KHÔNG runtime.** Parser-post-merge → persists vào DB → benefit cả `feature_service.F02`, `feature_service.R03`, FE Portfolio cost basis. Trade-off: nếu parser future bug-fixed trả bvps thật, fallback skip (parser wins) — auto-recover. Runtime fallback chỉ patch 1 surface, không tiết kiệm code complexity đáng kể.
- **Skip bvps khi equity ≤ 0** — `_safe_div` semantics consistent với `feature_service` (negative equity = undefined book value). Trader audit insolvent ticker dùng `total_debt > total_assets` flag, không cần bvps fake.
- **Period suffix: base wins, locked Phase 26.** Rationale: trader audit so sánh với CafeF/Vietstock check số GỐC; restated `_1` có thể là đính chính/cải toán, khó so sánh. Trader feedback nếu yêu cầu flip thì add env toggle `PERIOD_SUFFIX_PREFER=restated` future.
- **Collision log INFO level** (KHÔNG warn) — tần suất cao (mỗi quarter có thể collision), warn level spam. Operator grep `"period suffix collision"` để audit visibility.
- **Snapshot fixture synthetic, KHÔNG real data** — tránh PII + license. Pattern coverage:
  - `n_N.` numeric prefix (income statement)
  - `a./b./c./d.` alpha prefix (balance sheet sections)
  - `i./iv.` Roman prefix (sub-sections)
  - `tai_san/nguon_von` Vietnamese section headers (NaN values)
  - `total_owners_equity_and_liabilities` grand-total (must skip)
  - `2025-Q4` + `2025-Q4_1` collision
  - `n_18.net_profit_after_tax` / `n_19.earnings_per_share_vnd` (Phase 21 alias map)
- **Conftest.py extract** — pytest fixture sharing chuẩn. Tránh ruff F811 vs `# noqa` workaround. Tests có thể chạy độc lập (file-level test selection vẫn OK).
- **Golden expected per-period: 13 fields** — coverage đầy đủ cho `feature_service.compute()` consumption (F03 ROE, F04 ROA, F06 D/E, F08 NIM, F09 inv/TA, F11 OCF, F02 P/B via computed bvps).

## 6. Issues / drift còn open

- **bvps fallback dùng `total_equity / shares_outstanding`** — nếu `shares_outstanding` chính nó là computed (vd vnstock derive từ share-buyback events), fallback có thể stale. Acceptable cho MVP — trader feedback nếu thấy bvps off so với CafeF.
- **Period suffix collision logger.info có thể spam** trong production refresh (~26 ticker × ~8 quarters × 2 source). Có thể giảm xuống `logger.debug` nếu trader không cần. Defer Phase 28.
- **Snapshot fixture không cover VCI shape** — chỉ KBS. VCI test cases vẫn inline trong `test_vnstock_client.py`. Phase 28+ extract VCI snapshot nếu future drift suspected.
- **KBS OCF Q1 gap** (Phase 22 §6 carry) — không fix Phase 26. Workaround `change-in-cash-equivalents` defer Phase 28 nếu trader báo.
- **`_FIELD_BLOCKLIST` allowlist refactor** (Phase 21 REVIEW Medium) — không fix. Hiện 4 entry, manageable. Khi blocklist > 10, revisit.
- **Real ticker verify post-Phase-26 chưa chạy** — operator chạy `script/pre-handoff-refresh.sh` thì sẽ có `bvps` populate cho mọi ticker; expected coverage Phase 21 12 ticker → Phase 26 ~25-26 ticker.

## 7. Test commands (reproducible)

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Targeted Phase 26 tests
uv run pytest tests/unit/test_kbs_snapshot.py -v
# 5 passed

# Full BE regression
uv run pytest -q
# 299/299 expected (294 cũ + 5 mới)

# Lint
uv run ruff check app tests
# All checks passed
```

## 8. Hand-off cho phase tiếp theo

**Operator pre-handoff impact:**
- Sau Phase 26, `bash script/pre-handoff-refresh.sh` (~22 phút) sẽ populate `bvps` cho ~ALL ticker (vs Phase 21 only 1-2 ticker). F02 P/B feature có data thật → ai_score distribution có thể shift.
- Operator chạy 1 manual `/api/run` sau refresh để kiểm Top N + Telegram broadcast với scoring bvps-populated.

**Phase 27 (production deploy actuals):**
- Docker build + reverse proxy + crontab + secret manager.
- Turbopack migration + `useExportPdf` blob refactor + PriceBoard "Chưa có dữ liệu" placeholder.
- KBS OCF Q1 gap workaround nếu trader feedback yêu cầu.

**Phase 28 (Telegram + sanity polish, optional):**
- `InfoBanner` dismiss + LocalStorage persist.
- Settings UI bật/tắt Telegram broadcast.
- Bot API 429 retry trong `_post_message`.
- Sanity floor raise to 1e10 hoặc exclude MOCK% pattern.
- Period suffix log → debug level if spam.

## 9. Post-phase fixes

_(Empty — Phase 26 vừa đóng.)_
