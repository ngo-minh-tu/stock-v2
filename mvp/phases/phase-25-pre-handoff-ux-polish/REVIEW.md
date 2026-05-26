# Phase 25 — Pre-Handoff UX Polish + Disclaimers REVIEW

**Started:** 2026-05-21
**Completed:** 2026-05-21
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 25 đóng pre-handoff checklist. Câu hỏi chính: schema rename có thật sự kill toàn bộ runtime latent bug `latest_price`? Banner UX có gây noise hoặc che thông tin? Sanity guard false-positive rate cho fixture có quá cao? Pre-handoff script đủ defensive để chạy 1 lần trên prod chưa?

## Findings

- **High — Schema rename PriceBoardTable lộ pre-existing bug khác chưa fix.** [PriceBoardTable.tsx accessor `r.latest.close - r.latest.reference`](../../../frontend/src/components/price-board/PriceBoardTable.tsx) dùng giá thô (ngàn đồng) làm cả change + change_pct. Nếu BE thay đổi unit (sau Phase 22 unit-scaling logic chỉ áp dụng cho financials, KHÔNG prices), display có thể off. Phase 16 lock prices = raw VND ở DB nhưng API serialize chia /1000 → ngàn đồng đến FE. Hiện vẫn consistent, nhưng KHÔNG có unit assertion test. Phase 26 thêm assert.

- **High — Page-level filter `row.latest !== null` có thể giấu legitimate ticker.** [price-board/page.tsx](../../../frontend/src/app/(app)/price-board/page.tsx) filter `latest === null`. Nếu BE có 26 ticker thật + 55 MOCK seed (Phase 16 lock) và refresh chưa hoàn tất, một số ticker sẽ có `latest=null` → ẩn khỏi board. Trader có thể không biết "thiếu" mã. Mitigation: Banner ở News page đã có warning về stub; nhưng price-board chưa banner riêng. Trade-off: vẫn tốt hơn show row 0đ. Phase 26 hoặc 27 thêm placeholder "Chưa có dữ liệu" row + count summary.

- **Medium — `useMemo(() => getTodayIso(), [])` stable chỉ trong vòng đời mount.** [HoldingFormModal.tsx:29](../../../frontend/src/components/portfolio/HoldingFormModal.tsx#L29) — nếu user mở modal lúc 23:59, gõ nửa form, sau nửa đêm submit → buyDate = ngày hôm qua (hợp lệ vì ≤ TODAY). Edge case rare, acceptable. Nếu muốn strict, dùng `useState` + `useEffect` re-compute trên `open=true`. Defer.

- **Medium — `InfoBanner` không có dismiss/persist.** Mỗi lần navigation trader thấy banner. Sau N visit có thể disturb. Phase 28 cookie/LocalStorage dismiss + show-once mode. Hiện tại trade-off OK vì hand-off lần đầu — trader cần thấy disclaimer mỗi page.

- **Medium — Sanity floor `1e9 VND` false-positive cho test/demo data.** [feature_service._warn_total_assets_range](../../../mvp/code/app/services/feature_service.py) sẽ warn-log khi pytest run với synthetic financials (test fixtures dùng `total_assets=60e9` = 60 tỷ — pass). Demo seed dùng `total_assets=10e10` (= 100 tỷ — pass). Nhưng MOCK ticker trong seed.py có thể có row với 1e6 → spam log. Phase 26 nâng floor lên 1e10 (10 tỷ) hoặc add ticker pattern exclude MOCK%.

- **Medium — Pre-handoff script không validate response shape của `/api/refresh/all/status`.** [pre-handoff-refresh.sh](../../../script/pre-handoff-refresh.sh) parse `data.status` trực tiếp. Nếu BE response thay đổi shape (envelope đổi name field), curl JSON parsing sẽ crash. Defer — script là 1-shot operator tool, không CI guard.

- **Medium — Sanity guard warn-log không có aggregation hoặc retention.** Mỗi screening run gặp 26+ ticker → log có thể chứa 26 warning line. Operator phải `grep "below sanity floor" structlog` để filter. Defer Phase 28 — `_PRODUCTION_FORBIDDEN_FILES` extensible cùng pattern.

- **Low — Banner i18n VI text dùng "Tin demo cố định" không match exact `tFilter`/`tNews` namespace.** [vi.json:357](../../../frontend/src/messages/vi.json#L357) — nằm dưới `news.disclaimer` đúng namespace. Translator/native VN reviewer có thể đề xuất "Demo: 150 bài tin cố định anchor 2026-05" gọn hơn. Hiện text dài (140 ký tự). Acceptable cho trader nhanh đọc.

- **Low — `StockListItem` standalone interface mất `name` từ shared `StockStaticInfo` extend.** Phase 25 copy 4 field (`ticker`, `name`, `exchange`, `sector`) sang `StockListItem` mới. Nếu future BE thêm `status` hoặc field common, sync 2 nơi. Mitigation: Comment "Phase 25 schema rename" trong types.ts. Defer extract `StockBase` interface chỉ khi 3+ shape divergence.

- **Low — `InfoBanner` không có `aria-live` hoặc focus-trap.** `role="note"` OK cho purely informational, không cần focus. Screen reader sẽ đọc khi tab tới. Acceptable cho MVP a11y.

- **Low — Playwright test 04 KPI exact-match fix là band-aid.** Banner copy bao gồm "VN-Index" — substring collision. Tốt hơn: scope test 04 bằng `within(kpiSection)` selector. Hiện `{ exact: true }` đủ unblock; defer cleanup khi refactor test 04 cho cluster 7+.

## Đã kiểm chứng

- Đã đọc [Phase 24 REVIEW High finding](../phase-24-fe-next16-security-upgrade/REVIEW.md) carry "schema rename `latest_price`→`latest`" + [Phase 22 REVIEW High finding](../phase-22-financial-unit-scaling/REVIEW.md) carry "feature_service range sanity check".
- Đã verify schema rename comprehensive — `rg latest_price src/` chỉ còn matches trong comment hoặc mock fixture compute (non-runtime path).
- Đã verify decouple `StockListItem` khỏi `StockStaticInfo` — Stock Detail flow (`/api/runs/{id}/stocks/{ticker}` với `static: {current_price, reference_price}`) vẫn intact (4 component đọc `static.current_price` không bị break).
- Đã verify 3 banner render trên đúng page qua Playwright trace (test 04 dashboard banner expose strict-mode collision).
- Đã verify TODAY runtime — `grep "2026-05-07" HoldingFormModal.tsx` empty.
- Đã verify feature_service sanity warn-log:
  - 6/6 unit test pass cover above/below/zero/None/non-numeric/boundary.
  - Real test_features.py + screening_lifecycle tests pass cùng 288 cũ (294 total).
- Đã verify pre-handoff script syntax — `bash -n`.
- Regression suite:

```bash
cd /Users/ngominhtu/Projects/stock-v2

# FE
cd frontend
npx tsc --noEmit                              # clean
CI=1 npx playwright test                      # 8 passed (42.1s)

# BE
cd ../mvp/code
uv run pytest -q                              # 294/294 passed
uv run ruff check app tests                   # All checks passed
```

## Điểm làm tốt

- **Schema rename comprehensive 1 pass** — Phase 24 patch-only được Phase 25 follow-up triệt để (types + 4 file consumer + fixture + test setup). KHÔNG để debt tích thêm.
- **Page-level filter narrowed type** (`RowWithPrice`) — TypeScript narrow guard `row is RowWithPrice` giúp PriceBoardTable không cần `?.` chain noisy trong 25 accessor.
- **`InfoBanner` reusable** — 1 component, 3 page, i18n-driven. Future add banner cho settings page hoặc shared view chỉ 1 dòng JSX.
- **TODAY useMemo** — đơn giản nhất, không over-engineer `useState + useEffect` cho 1 form lifecycle.
- **Sanity guard helper-extracted** (`_warn_total_assets_range`) — testable standalone (6 case), không nhồi vào compute() làm khó test.
- **Pre-handoff script defensive** — backup TRƯỚC destructive ops, confirm prompt, env var validation, status poll loop. Acceptable cho 1-shot operator tool.
- **i18n VI + EN sync ngay lập tức** — không drift. Vietnamese text concise + technical.
- **E2E test fix bằng `{ exact: true }`** — minimal diff, không scope refactor.
- **Tests added BE-side (`test_feature_sanity.py`)** — guard regression cho future scaling change Phase 26+.

## Cần revisit

- **Phase 26 (post-trader feedback if needed):**
  - KBS bvps compute fallback (`total_equity / shares_outstanding` khi vnstock community-tier không trả field).
  - Period suffix collapse rule (`2025-Q4_1` vs `2025-Q4` — prefer audited/restated).
  - KBS raw DataFrame snapshot fixture cho 3 ticker đại diện (regression schema drift detector).
  - Add unit assertion test cho price flow (raw VND DB → ngàn đồng API → FE display).
- **Phase 27 (production deploy):**
  - Docker build + reverse proxy + crontab + secret manager.
  - Turbopack migration (drop `--webpack` flag).
  - `useExportPdf` blob refactor.
  - PriceBoard "Chưa có dữ liệu" placeholder row cho ticker null-latest (hoặc count summary "Showing X/Y tickers").
- **Phase 28 (UX + Telegram polish):**
  - `InfoBanner` dismiss + LocalStorage persist.
  - Telegram broadcast Settings UI toggle.
  - Bot API 429 retry trong `_post_message`.
  - `_PRODUCTION_FORBIDDEN_FILES` set extensible.
  - Sanity floor raise to 1e10 hoặc exclude MOCK% ticker pattern.
- **Pre-handoff DB refresh** — operator run thực sau Phase 25 đóng. Verify 26/26 ticker đạt ≥4/5 core BCTC.
- **Telegram real-bot end-to-end** verify sau pre-handoff refresh (Phase 23 REVIEW carry).
- **`StockBase` extract** — nếu Phase 26+ thêm shape divergence (status, sector full, etc.), extract common interface.
