# Phase 25 — Pre-Handoff UX Polish + Disclaimers + Schema Rename + Sanity Guard

**Started:** 2026-05-21 · **Closed:** 2026-05-21
**Roadmap:** Pre-handoff checklist trước ngrok hand-off (Phase 24 đã clear FE critical CVE blocker). 5 sub-task song hành: (a) FE schema rename `latest_price` → `latest` đồng bộ BE truth (Phase 24 REVIEW High carry), (b) HoldingFormModal TODAY runtime (Phase 19 REVIEW Low carry), (c) 3 banner disclaimer cho fixture/stub surface, (d) operator pre-handoff DB refresh script, (e) feature_service total_assets range sanity check (Phase 22 REVIEW High carry).

## 1. Scope

Tránh trader hiểu lầm "data hệ thống sai" khi gặp news 2026-05, macro stub Q2 2026, backtest heuristic, hoặc portfolio buy_date validation expire. Combine với schema rename (latent bug Phase 24 expose) + sanity guard cho unit drift sentinel.

5 sub-task:

1. **25.0** — FE schema rename `latest_price` → `latest`. BE `StockListItem.latest: LatestPrice | None` (TAD g02 §7.1). Phase 24 fix minimal optional-chain trên `portfolio/page.tsx`; Phase 25 rename comprehensive across types + PriceBoardTable + fixture. Decouple `StockListItem` khỏi `StockStaticInfo` (2 schemas khác biệt).
2. **25.1** — `HoldingFormModal.tsx:18` thay `const TODAY = '2026-05-07'` bằng `useMemo(() => new Date().toISOString().slice(0, 10), [])`. Form không expire khi clock vượt qua fixture anchor.
3. **25.2** — `<InfoBanner>` reusable component + 3 banner trên Dashboard / News / Backtest panel. Text i18n VI+EN. Surface MVP-limit cho trader trước khi tham chiếu số.
4. **25.3** — `script/pre-handoff-refresh.sh` operator checklist: backup → WIPE financial_reports → POST /refresh/all → poll status → audit 5/5 core BCTC fields per ticker. Phase 21+22 combined fix on `prod-screener.db`.
5. **25.4** — `feature_service._warn_total_assets_range()` warn-log nếu `0 < total_assets < 1e9 VND` (post-Phase-22 source-aware scaling sentinel). Drift detector — KHÔNG block screening.

Out of scope: production deploy (Phase 27); Turbopack migration (Phase 27); KBS bvps compute fallback (Phase 26 data polish); Telegram broadcast UI toggle (Phase 28).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 25-01 | BE serves `latest` field, FE type+access `latest_price`. Phase 24 chỉ patch `portfolio/page.tsx` optional-chain. `PriceBoardTable.tsx` ~25 refs vẫn TypeScript-accept nhưng runtime crash trên real BE data. Pre-existing Phase 7 scaffold drift. | `types.ts` + `PriceBoardTable.tsx` + `price-board/page.tsx` + `price-board-fixture.ts` | Rename comprehensive. `StockListItem` standalone interface (KHÔNG extend `StockStaticInfo` — 2 schema khác). `LatestPrice \| null` nullable per BE. Page-level filter rows có `latest === null` trước khi pass vào table (narrow type `RowWithPrice`). |
| 25-02 | `StockStaticInfo.current_price` + `reference_price` cần thiết cho Stock Detail (BE serves `static.current_price` qua `/api/runs/{run_id}/stocks/{ticker}` — TAD g02 §4). KHÔNG remove. | `types.ts` | Giữ nguyên `StockStaticInfo` original. Chỉ decouple từ `StockListItem`. |
| 25-03 | `HoldingFormModal.tsx:18` `const TODAY = '2026-05-07'` — vào 2026-05-08 trader sẽ thấy validation "Future date" cho hôm nay. | `HoldingFormModal.tsx` | `const TODAY = useMemo(() => new Date().toISOString().slice(0, 10), [])`. Stable trong vòng đời modal mount; refresh khi reopen. |
| 25-04 | Memory roadmap spec "Dashboard Macro card" — không có `MacroCard` component. KPI cards có "Alpha vs VN-Index" computed bằng heuristic proxy (Phase 6 `DASHBOARD_VNINDEX_3M_PROXY_PCT = mean MUA upside − 5%`), KHÔNG so sánh real VN-Index. | `app/(app)/page.tsx` | Banner page-level đặt sau header — disclaim macro stub + alpha heuristic. |
| 25-05 | E2E Playwright test 04 `getByText('Alpha vs VN-Index')` strict-mode collision với banner text "Macro inputs (...VN-Index)". | `tests/e2e/smoke.spec.ts:120` | Add `{ exact: true }` to KPI label lookups. Banner text khác substring nên không collision sau. |
| 25-06 | `feature_service` không có sanity check trên `total_assets`. Nếu Phase 22 source-aware scaling miss-route cho ticker mới (vd KBS schema variant), F03/F04/inv_ta sẽ compute từ raw ngàn đồng silent. | `feature_service.py` | `_warn_total_assets_range()` warn-log only (false-positive cho ticker mới list không có BCTC chấp nhận được). Floor 1e9 VND = 1 tỷ — lowest plausible cho real BĐS niêm yết. |
| 25-07 | Operator chưa có 1-shot script để combine Phase 21 + 22 fix trên prod DB. | `script/pre-handoff-refresh.sh` (new) | Backup → WIPE financial_reports → POST /refresh/all → poll → audit. Requires `API_PASSWORD` env. Confirm prompt trước destructive ops. |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `frontend/src/lib/types.ts` | `StockListItem` standalone interface với `latest: LatestPrice \| null`; `StockStaticInfo` giữ nguyên cho Stock Detail. |
| `frontend/src/app/(app)/portfolio/page.tsx` | `stock?.latest?.close` (Phase 24 optional-chain → Phase 25 final shape rename). |
| `frontend/src/app/(app)/price-board/page.tsx` | Filter `row.latest !== null` + narrow `RowWithPrice` type guard. |
| `frontend/src/components/price-board/PriceBoardTable.tsx` | Rename `latest_price` → `latest` × 25 refs; `PriceBoardRow` narrowed prop type. |
| `frontend/src/mocks/data/price-board-fixture.ts` | Fixture field `latest_price` → `latest`; drop unused `current_price` + `reference_price` flat fields. |
| `frontend/src/components/portfolio/HoldingFormModal.tsx` | Runtime `TODAY` qua `useMemo`. |
| `frontend/src/components/common/InfoBanner.tsx` (new) | Reusable card-style banner với Info icon + i18n text + `data-testid` hook. |
| `frontend/src/app/(app)/page.tsx` | Wire Dashboard banner. |
| `frontend/src/app/(app)/news/page.tsx` | Wire News banner. |
| `frontend/src/app/(app)/run-history/page.tsx` | Wire Backtest banner (in active backtest section). |
| `frontend/src/messages/en.json` + `vi.json` | 3 new keys: `dashboard.disclaimer`, `news.disclaimer`, `backtest.disclaimer`. |
| `frontend/tests/e2e/smoke.spec.ts` | Add `{ exact: true }` to KPI label lookups. |
| `mvp/code/app/services/feature_service.py` | `_warn_total_assets_range()` helper + invocation trong `compute()`. |
| `mvp/code/tests/unit/test_feature_sanity.py` (new) | 6 unit test cho sanity guard (above floor / below / zero / None / non-numeric / boundary). |
| `script/pre-handoff-refresh.sh` (new) | Operator 4-step script — backup + WIPE + refresh + audit. |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| Schema rename comprehensive — KHÔNG còn `latest_price` access ở runtime path | ✅ | `rg latest_price src/` → chỉ còn references trong comment hoặc test name; runtime code dùng `latest`. |
| `StockListItem` decoupled khỏi `StockStaticInfo` (BE shape khác) | ✅ | `types.ts:310-320` standalone interface; `StockStaticInfo` giữ nguyên cho Stock Detail. |
| `HoldingFormModal` runtime TODAY | ✅ | `useMemo(() => new Date().toISOString().slice(0,10), [])` — verify `grep "2026-05-07" HoldingFormModal.tsx` empty. |
| 3 banner render trên đúng page | ✅ | `InfoBanner testId="dashboard-disclaimer"` / `news-disclaimer` / `backtest-disclaimer`. |
| i18n VI+EN sync | ✅ | 3 keys × 2 locales. Playwright forced EN locale verifies. |
| `feature_service` sanity guard log warning | ✅ | 6/6 unit test pass. |
| Pre-handoff script bash syntax valid + executable | ✅ | `bash -n script/pre-handoff-refresh.sh` OK; `chmod +x` set. |
| TypeScript clean | ✅ | `npx tsc --noEmit` no errors. |
| Playwright 8/8 pass | ✅ | `CI=1 npx playwright test` → 8 passed (42.1s) sau KPI exact-match fix. |
| BE pytest pass | ✅ | `uv run pytest -q` → 294/294 passed (288 cũ + 6 new sanity test). |
| Ruff clean | ✅ | `uv run ruff check app tests` — All checks passed. |

## 5. Quyết định khoá trong phase này

- **Schema rename comprehensive — NOT incremental.** Phase 24 patch chỉ `portfolio/page.tsx` (4 lines). Phase 25 rename PriceBoardTable (25 refs) + page filter + fixture. Trade-off: bigger diff nhưng kill latent bug toàn route /price-board.
- **`StockListItem` standalone interface** thay vì extend `StockStaticInfo`. BE 2 schemas khác biệt: List endpoint = `{ticker,name,exchange,sector,newly_listed,latest}`; Stock Detail = `{static: {ticker,name,exchange,sector,current_price,reference_price?}}`. Forcing single interface tạo `current_price` field FE-fiction.
- **`LatestPrice | null` nullable per BE** + page-level filter `row.latest !== null` trước khi pass vào table. UX cleaner — TTCK board chỉ hiển thị ticker có price snapshot (row trống dễ gây hiểu lầm). Trade-off: 81 ticker fixture có thể bị filter nếu MSW gen `latest` null — kiểm fixture vẫn populate.
- **TODAY useMemo locked trong vòng đời mount**, KHÔNG re-compute khi user mở modal hôm sau. Đây là semi-stable behavior — modal re-mount sẽ pickup new date. Trade-off acceptable vì rare case (user mở modal qua nửa đêm).
- **InfoBanner reusable component** thay vì inline 3 disclaimer JSX. Tránh duplicate style. `<Info>` icon + theme tokens + role="note" (a11y).
- **Banner placement page-level (TRƯỚC content)** thay vì cuối page hoặc inline trong card. Trader scan top-down — disclaimer trên cùng = nhìn thấy trước number.
- **`_warn_total_assets_range` warn-log only**, KHÔNG raise. False-positive cho ticker mới list / fixture chấp nhận được. Operator grep log để detect drift cumulative.
- **Floor 1e9 VND (= 1 tỷ)** thay vì 1e6 hoặc 1e12. Lowest BĐS niêm yết VN có `total_assets` realistic ~10 tỷ; 1 tỷ là tổng tài sản startup-tier (impossible cho HOSE listed). Mức này catch unit-drift mọi tier real ticker, miss positive cho fixture-only synthetic.
- **Pre-handoff script ASK confirm trước WIPE** — `read -r -p`. KHÔNG run unattended (cron). Operator phải verify backup file + API_PASSWORD env trước.
- **E2E test exact-match cho KPI label** — `{ exact: true }`. Banner copy có thể chứa substring → strict-mode collision. Alternative: scope qua `within(kpiSection)` nhưng exact:true minimal diff.

## 6. Issues / drift còn open

- **`script/pre-handoff-refresh.sh` chưa chạy live** — Phase 25 chỉ ship script. Operator chạy thực trên prod DB trước hand-off. Expected ~22 phút.
- **Real bot verify broadcast end-to-end** (Phase 23 REVIEW High carry) — vẫn chưa run. Operator manual trigger `POST /api/run` sau pre-handoff-refresh.sh để kiểm Telegram nhận message thực.
- **Turbopack migration** (Phase 24 REVIEW Medium carry) — vẫn dùng `--webpack` flag. Phase 27.
- **`useExportPdf` blob.text() raw fetch** (Phase 19 REVIEW Low carry) — Phase 27.
- **KBS bvps + period_suffix data polish** — Phase 26 nếu trader feedback yêu cầu.
- **Telegram broadcast UI toggle + 429 retry** — Phase 28 optional.
- **`feature_service` sanity floor có thể false-positive** cho fixture/anchor mock — log noise. Acceptable: log filter qua `grep "below sanity floor"` của operator.
- **`InfoBanner` không có dismiss/persist** — banner luôn show. Trader feedback nếu UX disturb sẽ tính sau (cookie + LocalStorage dismiss). Phase 28.
- **Phase 19 Playwright test setup TODAY=2026-05-07 hard-code dependency** đã bị remove khi 25.1 fix. Test 05 vẫn pass nhờ runtime TODAY ≥ default buy_date logic. Comment trong smoke.spec.ts:153 đề cập "HoldingFormModal hardcodes TODAY=2026-05-07" giờ stale — cleanup defer.

## 7. Test commands (reproducible)

```bash
cd /Users/ngominhtu/Projects/stock-v2

# FE TypeScript + Playwright
cd frontend
npx tsc --noEmit                  # clean
CI=1 npx playwright test          # 8/8 pass (sau KPI exact-match fix)

# BE pytest + ruff
cd ../mvp/code
uv run pytest tests/unit/test_feature_sanity.py -v   # 6/6 pass
uv run pytest -q                                       # 294/294 pass (288 cũ + 6 mới)
uv run ruff check app tests                            # All checks passed

# Pre-handoff script syntax check (no live run trong phase)
bash -n /Users/ngominhtu/Projects/stock-v2/script/pre-handoff-refresh.sh
```

## 8. Hand-off cho phase tiếp theo

**Operator pre-handoff checklist (thực hiện ngoài Phase 25):**
1. `bash script/pre-handoff-refresh.sh` (~22 phút) — clean DB + refresh + audit ≥4/5 core fields per ticker.
2. Manual `POST /api/run` để verify Telegram broadcast end-to-end với real bot.
3. Smoke 8 page routes trên FE production build (login → dashboard → top-mua → red-flags → stock-detail → price-board → news → portfolio → run-history → settings).
4. `bash script/run-ngrok.sh` (nếu có) hoặc setup ngrok manual → public URL → hand-off trader.

**Phase 26+ (post-trader-feedback):**
- Phase 26: KBS data polish (bvps compute fallback + period suffix rule + raw KBS fixture snapshot).
- Phase 27: Production Docker deploy + Turbopack migration + useExportPdf blob refactor.
- Phase 28: Telegram broadcast UI toggle + 429 retry + `_PRODUCTION_FORBIDDEN_FILES` extensible.

## 9. Post-phase fixes

_(Empty — Phase 25 vừa đóng.)_
