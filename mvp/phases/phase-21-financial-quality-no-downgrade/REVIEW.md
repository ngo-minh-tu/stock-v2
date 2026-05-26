# Phase 21 — Financial Quality + No-Downgrade Upsert REVIEW

**Started:** 2026-05-21
**Completed:** 2026-05-21
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 21 đóng 3 finding tích lũy từ Phase 17-18 trong cùng pass (parser strict + bulk_upsert COALESCE + multi-source merge). Câu hỏi chính không phải là code có chạy hay không — 263 test pass + real NLG verified — mà là code fix có thực sự đủ tin cậy để trader audit BCTC qua ngrok không bị phát hiện sai số chưa, và những giả định nào trong fix có thể bị vô hiệu hoá ở tickers khác / data sau này.

## Findings

- **High — Financial unit scaling chưa apply là blocker cho trader audit thực.** [vnstock_client.py](../../code/app/crawlers/vnstock_client.py) hiện store raw KBS/VCI value (ngàn đồng) vào DB, trong khi Phase 16 đã apply `_scale_vnd` ×1000 cho prices. Hệ quả: trader so sánh `total_assets` qua UI/PDF với báo cáo CafeF/Vietstock sẽ thấy giá trị 1000 lần nhỏ hơn (vd VHM total_assets ~616B trong DB vs ~616T tỷ VND thực tế). SUMMARY §6 đã document defer Phase 22 nhưng nếu hand-off ngrok cho trader TRƯỚC Phase 22 thì sẽ blow up credibility ngay. Phase 22 phải làm trước hand-off, không phải parallel.

- **High — Code verified trên 1 ticker (NLG) thôi, generalize sang 25 ticker còn lại là untested assumption.** Real verify chỉ chạy NLG. NLG thuộc 14 ticker VCI-fail-KBS-fallback nhóm. KBS shape có thể khác cho ticker khác (KBS không guarantee schema stability per Codex Phase 17 review). Specifically: prefix pattern `^(?:n_\d+|[abcdefgh]|[ivx]{1,4})_` giả định KBS dùng `n_N.` / `a-h.` / `i-iv.` — chưa kiểm với ticker khác có thể có `n_NN.` (2 digit) hoặc các prefix khác. Nên chạy production `/refresh/all` trước khi tuyên bố Phase 21 đóng — hiện SUMMARY §6 ghi "chưa chạy", hand-off responsibility cho operator. Đây là gap audit thực sự.

- **High — Tests dùng synthetic data shape, chưa có fixture từ raw KBS DataFrame thực để guard regression.** `test_kbs_balance_sheet_strips_prefix_and_skips_nan_header` hard-code item_id strings tôi quan sát từ NLG. Nếu vnstock đổi naming (vd `n_18.net_profit_after_tax` → `n_18.profit_after_tax`) hoặc thêm grand-total row mới (vd `total_resources` thay `total_owners_equity_and_liabilities`), test vẫn pass nhưng production parser fail im lặng. Cần thêm 1 integration test bắt KBS thật (gate qua quota) hoặc snapshot real raw DataFrame để compare schema drift.

- **Medium — `_FIELD_BLOCKLIST` hand-maintained không có cơ chế detect drift.** [vnstock_client.py:113](../../code/app/crawlers/vnstock_client.py#L113) hard-code 4 entries cho grand-totals. Vnstock có thể publish thêm bilingual versions (vd `total_equity_and_liabilities` tiếng Anh + `tong_nguon_von_va_no_phai_tra` tiếng Việt). Parser sẽ silently match wrong field. Đề xuất: thay vì blocklist, dùng explicit allowlist của row patterns tin cậy ("first row of section X = section total only if has child rows"). Tạm thời blocklist đủ; flag để Phase 22+ revisit.

- **Medium — Period suffix rule `_1` always loses to base — chưa có domain validation.** Phase 21 chốt base period override restated. Nhưng `_1` trong vnstock có thể là **bản restated cuối cùng** (sau khi audit) chứ không phải bản tạm. Nếu vậy, base sẽ là preliminary và `_1` là final → ta đang lưu preliminary. Cần xác nhận với trader / vnstock docs. Tạm chấp nhận vì simpler và consistent với "first publish wins" intuition; flag để Phase 22+ revisit nếu trader feedback nói data lệch CafeF.

- **Medium — `bvps` NULL toàn bộ — workaround dễ nhưng không làm.** SRS f04/g03 dùng `bvps` cho `book_value_per_share` feature normalization (P/B ratio in scoring). Workaround đơn giản: compute `bvps = total_equity / shares_outstanding` trong `feature_service.py`. Phase 21 punt sang Phase 22 — nhưng nếu scoring đang dùng `bvps` mà NULL → 26 ticker mất feature → 26/38 features incomplete → scoring output có thể bias. Cần check `feature_service` xem có code path nào break với `bvps=None` chưa.

- **Medium — Refresh time ~22 phút × cron mỗi ngày = 11% time vnstock quota burnt cho 1 user.** Phase 18 chọn 16:30 ICT cron. Vnstock guest quota = 20 req/min = ~1200 req/giờ = 28800/ngày. Refresh 22 phút × 6.5s gating ≈ 1.6 req/ticker × 26 ticker × 8 sub-call = 333 req. Nhỏ so total nhưng peak ~3 req/s nếu nhiều client cùng dùng vnstock. Operator nên monitor 429 response trong log. Phase 22 nên enable structured log để track quota burn.

- **Low — Tests chưa cover VCI-success + KBS-empty edge case rõ ràng.** `test_fetch_financials_merges_multiple_sources` mock cả 2 source. `test_fetch_financials_falls_back_to_kbs_when_vci_raises` mock VCI raise. Còn case: VCI return rows nhưng KBS return empty (no exception). Hiện code handle đúng (KBS empty → tiếp next source loop, không break), nhưng không có test guard.

- **Low — `equity` plain alias back trong set — false positive risk.** Phase 21 first removed `equity` từ alias để tránh polluting, sau add lại để giữ backward compat với `test_fetch_financials_merges_quarterly_frames`. Hiện không có item_id nào contain "equity" mà không phải owners_equity, nhưng vnstock có thể thêm `negative_equity_adjustments` hoặc `equity_method_investments` → false positive map to total_equity. Cần unit test guard.

## Đã kiểm chứng

- Đã đọc Phase 17/18 SUMMARY + REVIEW.md (Codex finding High) đóng vào Phase 21 scope.
- Đã inspect raw KBS DataFrame cho NLG (income, balance, cash_flow) qua `/tmp/inspect_kbs*.py`.
- Đã verify Phase 21 code fix với real KBS NLG call: 11/13 BCTC fields populated (trước Phase 21 = 4/13).
- Regression hiện tại pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_financial_repo.py -v
# 12 tests passed

uv run pytest -q
# 263/263 passed

uv run ruff check app tests
# All checks passed
```

- Đã xác nhận `_FIELD_BLOCKLIST` chặn grand-total contamination qua unit test `test_kbs_balance_sheet_strips_prefix_and_skips_nan_header`.

## Điểm làm tốt

- Phase này xử lý đúng 3 finding treo từ Phase 17/18 Codex review High trong 1 pass — hiệu quả về scope batching.
- Pre-code investigation (real KBS inspect) trước khi viết code là cách đúng — phát hiện grand-total contamination + period suffix collapse mà spec không document.
- Multi-source merge thay first-non-empty-wins là quyết định đúng. Trước đó 12 ticker VCI-OK miss `net_income/eps/OCF` mà không ai notice — đây là silent data loss thực sự.
- Test coverage thêm 6 test focus đúng các pattern bug: prefix strip, NaN skip, blocklist, period suffix, multi-source merge, no-downgrade upsert.
- Document open issues rõ ràng trong SUMMARY §6 (bvps, OCF gap, unit scaling) thay vì che giấu — operator + Phase 22 có context để priorit.

## Cần revisit

- **Phase 22 ưu tiên #1**: financial unit scaling ×1000 ở ingest boundary cho VCI + KBS, đồng nhất với prices fix Phase 16. Đây là blocker thực sự cho trader audit.
- **Production `/refresh/all` chạy** ngay sau Phase 22 (combine 2 fix trong 1 refresh, tiết kiệm 22 phút thay 2 lần × 22 phút). Sau đó audit DB coverage 26 ticker thật.
- **Snapshot raw KBS DataFrame** vào `tests/fixtures/kbs_*.json` cho 3 ticker đại diện (1 VCI-OK, 1 VCI-fail-KBS-OK, 1 mới list ít data) — guard regression schema drift.
- **`feature_service` xử lý `bvps=None`**: kiểm code path, fallback compute hoặc skip feature graceful.
- **Period suffix rule** validate với trader hoặc vnstock docs — preliminary vs restated.
- **`_FIELD_BLOCKLIST` → allowlist pattern**: revisit nếu vnstock đổi naming.
