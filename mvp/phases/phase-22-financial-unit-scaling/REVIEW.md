# Phase 22 — Financial Unit Scaling + Production Guards REVIEW

**Started:** 2026-05-21
**Completed:** 2026-05-21
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 22 đóng 3 hand-off finding (unit scaling, prod guard, log scrub audit). Câu hỏi chính: source-aware scaling có thực sự thay trader test thấy data đúng không, hay vẫn còn assumption ngầm chưa kiểm? Production guard có cover được edge case deploy thực không?

## Findings

- **High — Source-unit assumption (VCI=raw VND, KBS=ngàn đồng) chỉ verify trên 2 ticker.** [vnstock_client.py:115](../../code/app/crawlers/vnstock_client.py#L115) lock convention dựa trên: VCI VHM Q4 2025 current_assets = 4.97e14 (raw VND) + KBS NLG Q1 2026 total_assets = 2.65e10 (ngàn đồng). 2 sample. Nếu VCI cho 1 ticker khác trả ngàn đồng (vd small-cap với balance sheet < 1B VND không có dấu hiệu phân biệt), parser sẽ silently miss-scale. Cần dùng heuristic: nếu raw value < threshold (vd 1e6) cho field như total_assets thì có thể là ngàn đồng → force scale. Tạm thời chấp nhận hard-coded source convention; flag để add range sanity-check trong feature_service hoặc dashboard.

- **High — Production refresh chưa chạy sau Phase 21+22 → DB vẫn ở mixed-unit state.** Phase 22 §6 đã document carry cho operator. Risk: nếu operator forget hoặc partial-refresh, screening sẽ chạy với mix unit (10 ticker scaled + 16 ticker old unscaled), output sẽ vô nghĩa (filter PRICE_FLOOR sai → false PENNY_PRICE). Phải có script một-shot wipe + full refresh + verify magic-number check trước hand-off ngrok. Nên gộp trong Phase 23 pre-hand-off checklist.

- **High — `feature_service.F11 = OCF / 1e9` chưa re-verify sau scaling.** [feature_service.py:225](../../code/app/services/feature_service.py#L225) chia OCF raw cho 1e9 để có "billion VND". Trước Phase 22: OCF cho KBS-ticker = ngàn đồng → ocf_billion 1000× nhỏ hơn → scoring feature F11 (range expect -2..+5 billion) sẽ ALWAYS dạng -0.002..+0.005 → normalize đều thành rất thấp → bias. Sau Phase 22: ocf_billion đúng → F11 hợp lý. NHƯNG nếu screening run gần đây dùng pre-Phase-22 data, ai_score đã embed bias. Cần re-run screening sau full refresh + audit ai_score distribution shift.

- **Medium — Production guard chỉ check sự tồn tại file, không check content.** [main.py:11](../../code/app/main.py#L11) raise nếu `.env.telegram` exists. Nếu file rỗng (vd dev quên xóa sau test), startup fail dù không thực sự leak. Có thể relax: chỉ raise nếu file chứa `TELEGRAM_BOT_TOKEN=<non-empty>`. Tạm chấp nhận strict-fail vì operator chỉ cần `rm .env.telegram` nếu test artifact.

- **Medium — Log scrub audit dừng ở grep, chưa add automated test guard.** Phase 22 §6 outcome ghi log scrub OK. Nhưng nếu Phase 23+ thêm service mới có URL chứa token (vd Slack webhook), không có pytest detect được leak. Đề xuất: thêm `tests/unit/test_log_safety.py` parse code AST, scan tất cả `logger.warning/error/info` calls với `exc` arg và assert exception class name only (regex check). Defer Phase 23.

- **Medium — Test 1 (`test_fetch_financials_merges_quarterly_frames`) hiện test sai expectation.** Mock chung không phân biệt VCI vs KBS. Code call cả 2 source với cùng mock data; VCI điền raw (no scaling); KBS scale ×1000 nhưng VCI fields đã filled (no-downgrade) → final = VCI raw. Test assert raw values (100, 12, ...) — đúng output nhưng KHÔNG test scaling logic. Cần thêm test riêng force KBS-only path để assert scaling kick in cho KBS-only fields. Hiện có test 4 (`merges_multiple_sources`) và test 5 (`falls_back_to_kbs_when_vci_raises`) cover; test 1 chỉ test no-regression cho merge behavior.

- **Low — `_FINANCIAL_VND_FIELDS` hand-maintained không có cross-reference với DB schema.** [vnstock_client.py:116](../../code/app/crawlers/vnstock_client.py#L116) list 11 field. Nếu thêm field mới vào `FinancialReport` model (vd `gross_margin`), parser sẽ không scale → silent unit mismatch. Đề xuất: tự derive từ `FinancialReport.__table__.columns` minus per-share + categorical exception list. Defer.

- **Low — Production guard không check `data/*.env*` hay `mvp/code/.env.production` files khác.** Phase 22 §5 chỉ guard `.env.telegram`. Nếu sau này có thêm `.env.slack`, `.env.aws`, cần guard tương tự — sẽ duplicate logic. Đề xuất: `_PRODUCTION_FORBIDDEN_FILES = (".env.telegram", ".env.local", ...)` set thay vì hard-code 1 file. Defer.

## Đã kiểm chứng

- Đã đọc Phase 21 REVIEW (High finding unit scaling) + Phase 20 REVIEW (High finding log scrub + Medium prod guard).
- Đã verify real KBS NLG: revenue Q1 2026 = 1.279T VND (CafeF NLG Q1 ~1.3T), total_assets = 25.894T VND (CafeF NLG ~26T), EPS = 679 VND/share. Khớp.
- Regression hiện tại pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

uv run pytest tests/unit/test_vnstock_client.py tests/unit/test_main_prod_guard.py tests/integration/test_financial_repo.py -v
# 15 tests pass

uv run pytest -q
# 266/266 passed

uv run ruff check app tests
# All checks passed
```

- Đã verify production guard chỉ trigger khi APP_ENV=production + file exists (3 test variants cover).
- Đã verify multi-source merge test giữ đúng VCI-wins-KBS-fills logic sau khi add scaling.

## Điểm làm tốt

- Source-aware scaling đặt tại `fetch_financials` post-process boundary — clean separation: parser stateless, scaling = source-knowledge concern.
- Test 4 (`merges_multiple_sources`) thiết kế đúng cover edge case: VCI sparse + KBS complementary. Đây là production behavior khi VCI gặp gap.
- Production guard fail-fast tại `create_app()` — phát hiện ngay startup, không runtime surprise.
- Document carry hand-off rõ ràng (operator phải wipe + refresh trước hand-off ngrok).
- Real verify ra số khớp CafeF, không phải synthetic.

## Cần revisit

- **Phase 23 pre-hand-off script**: one-shot wipe `FinancialReport` + full `/refresh/all` + verify magic numbers (range check 10T-1000T cho total_assets các BĐS large-cap). Tránh operator quên.
- **F11 OCF threshold re-tune** sau real refresh, kiểm scoring distribution shift.
- **Range sanity check** tại `feature_service` boundary: if `total_assets < 1e9` raise/warn — guards against future source-unit drift.
- **`tests/unit/test_log_safety.py`** AST-scan exception logging patterns.
- **`_FINANCIAL_VND_FIELDS` auto-derive** từ schema thay vì hard-code.
- **`_PRODUCTION_FORBIDDEN_FILES`** set extensible cho future secret files.
