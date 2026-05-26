# Phase 26 — KBS Data Polish REVIEW

**Started:** 2026-05-21
**Completed:** 2026-05-21
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 26 đóng 3 carry-over (bvps fallback + period suffix lock + snapshot fixture) cho data polish trước ngrok. Câu hỏi chính: bvps formula đúng convention với BE/FE consumer? Period suffix lock có thực sự an toàn cho trader audit? Snapshot fixture coverage có đủ rộng để catch drift?

## Findings

- **High — bvps fallback assumes `total_equity` raw VND post-Phase-22 scaling, KHÔNG có runtime guard.** [_compute_derived_fields](../../../mvp/code/app/crawlers/vnstock_client.py) — chia equity / shares. Nếu Phase 22 `_apply_source_scaling` regression future (vd KBS đổi unit, scaling logic miss), `total_equity` có thể là ngàn đồng → bvps fallback compute SAI 1000×. Phase 25 sanity guard `_warn_total_assets_range` flag `< 1e9 VND` nhưng KHÔNG có guard tương tự cho equity post-scaling. Mitigation: snapshot test sẽ catch nếu scaling regression. Phase 27 thêm `_warn_total_equity_range` analog.

- **High — Period suffix "base wins" locked Phase 26 chưa có trader confirmation.** Memory ghi "wait trader feedback" — Phase 26 lock vì cần ship trước ngrok. Nếu trader feedback restated thắng, code thay đổi `_ordered_value_columns` 1 line (flip sort key). Acceptable risk. Document trong SUMMARY §5.

- **Medium — Snapshot fixture không cover VCI shape.** `kbs_snapshot.py` chỉ exercise KBS-shape (item × period với prefix). VCI shape (period × rows) tested inline trong `test_vnstock_client.py` test_fetch_financials_merges_multiple_sources. Phase 26 không extract VCI fixture vì VCI alias mapping đã stable từ Phase 17 và chưa có drift signal. Defer Phase 28 nếu VCI schema thay đổi.

- **Medium — bvps fallback bằng formula đơn giản, KHÔNG xét book-value adjustments.** Real BVPS có thể include preferred-stock subtraction, treasury-stock add-back, minority-interest separation. Phase 26 formula = `total_equity / shares_outstanding` — đủ cho MVP screening filter (F02 P/B threshold ±2σ), nhưng trader audit chính xác đến đồng có thể off. Acceptable trade-off cho MVP. Trader feedback nếu thấy bvps off so với CafeF (CafeF cũng đơn giản hóa) → revisit.

- **Medium — Period suffix `_log_period_suffix_collisions` log INFO level mỗi frame.** Real production refresh 26 ticker × 4 sub-call × 2 source × N period = nhiều INFO log lines. Có thể spam structured-log aggregation. Acceptable cho MVP (log retention chỉ 7 ngày, JSON parsable), nhưng nếu trader báo log noise quá nhiều, hạ xuống DEBUG. Defer Phase 28.

- **Medium — Snapshot golden values hard-coded với 6 decimal precision** (vd `bvps = 14_910_000.0 * 1000.0 / 380_000_000.0` = 39236.842105...). Test assertion `abs(actual - expected) < 1e-3` — nếu floating-point chuyển đổi đổi (vd parser future round-trip qua DB Numeric), epsilon có thể fail. Defer review when scaling pattern thay đổi.

- **Low — Conftest extract test_vnstock_client.py shrink size từ 75 lines → ~10 lines header.** Acceptable refactor, nhưng test isolation hơi giảm (run file riêng cần conftest collect). Pytest convention chuẩn.

- **Low — `_compute_derived_fields` chỉ implement bvps, KHÔNG có hooks cho derive khác** (vd EBITDA margin, FCF). Phase 26 scope focus bvps vì rõ trader audit blocker. Mở rộng future không khó (loop over derive rules).

- **Low — Snapshot fixture period suffix collision chỉ test cho `2025-Q4` + `2025-Q4_1`** — không test 2 suffix `_1` + `_2` cùng base. Acceptable: chưa thấy KBS ship `_2` trong real data.

## Đã kiểm chứng

- Đã đọc [Phase 21 SUMMARY](../phase-21-financial-quality-no-downgrade/SUMMARY.md) §5 lock period suffix preference + [Phase 22 REVIEW](../phase-22-financial-unit-scaling/REVIEW.md) carry bvps + range sanity.
- Đã verify formula bvps đúng convention: VCI/KBS return `eps`/`bvps` per-share VND (NOT scaled), `total_equity` raw VND post-Phase-22 (×1000 for KBS), `shares_outstanding` count. → `total_equity / shares_outstanding` = VND/share consistent.
- Đã verify `_compute_derived_fields` chạy SAU `_apply_source_scaling` + multi-source merge → equity đã scaled raw VND.
- Đã verify period suffix collision log emit qua caplog assertion.
- Đã verify snapshot test catch grand-total leak (parser regression nếu `_FIELD_BLOCKLIST` miss).
- 5/5 Phase 26 unit test pass.
- Tests pre-existing 294 still pass (chờ confirm full pytest).
- Ruff clean.

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

uv run pytest tests/unit/test_kbs_snapshot.py -v
# 5 passed

uv run pytest -q
# 299/299 expected

uv run ruff check app tests
# All checks passed
```

## Điểm làm tốt

- **bvps fallback parser-time** — single point of computation, persists vào DB, downstream consumer (FE + feature_service) đồng nhất. KHÔNG runtime-compute scattered.
- **Conftest extract** — chuẩn pytest pattern. Tránh ruff F811 noise.
- **Snapshot synthetic, không real data** — pattern coverage rộng (n_N./alpha/Roman prefix + grand-total + section header + period suffix collision) trong 1 fixture file, KHÔNG có PII/license risk.
- **Golden expected values** — 13 canonical fields với pre-computed bvps fallback. Test fail → operator biết ngay field nào drift.
- **Period suffix lock + logging cùng phase** — không flip default behavior (risky), nhưng add audit visibility (low-risk). Trader feedback unblocked.
- **Skip bvps khi inputs invalid (equity ≤ 0, shares ≤ 0)** — defensive. Tránh false bvps cho insolvent ticker hoặc data corruption.
- **Tests cover full path** (mock VCI empty + KBS snapshot → fetch_financials → merged row khớp golden) thay vì isolated unit. Catch regression bất kỳ stage.

## Cần revisit

- **Phase 27 (deploy):**
  - `_warn_total_equity_range` analog với `_warn_total_assets_range` — sentinel cho equity post-scaling drift.
  - Extract VCI snapshot fixture nếu drift signal.
  - Period suffix log → DEBUG level nếu spam.
- **Phase 28 (UX + polish):**
  - bvps adjustment (preferred-stock subtract, treasury-stock add-back, minority-interest) nếu trader audit feedback.
  - KBS OCF Q1 gap workaround.
  - `_FIELD_BLOCKLIST` → allowlist refactor nếu blocklist > 10 entries.
  - Snapshot multi-suffix coverage (`_1` + `_2`).
- **Operator action ngoài Phase 26:**
  - Chạy `script/pre-handoff-refresh.sh` để populate bvps cho ALL ticker.
  - Verify Top N MUA + ai_score distribution shift sau khi F02 P/B có data thật.
  - Telegram broadcast smoke với new scoring.
