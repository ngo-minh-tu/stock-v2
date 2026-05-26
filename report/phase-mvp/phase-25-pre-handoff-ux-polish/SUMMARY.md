# Phase 25 — Pre-Handoff UX Polish + Disclaimers + Schema Rename + Sanity Guard

**Ngày:** 2026-05-21
**Mục tiêu thực hiện:** đóng pre-handoff checklist trước ngrok hand-off (Phase 24 đã clear FE critical CVE). 5 sub-task song hành: schema rename triệt để + HoldingFormModal TODAY runtime + 3 banner disclaimer + operator refresh script + feature_service sanity guard. Trader sẽ thấy disclaimer rõ ràng cho fixture/stub surface, không hiểu lầm "data hệ thống sai".
**Trạng thái:** COMPLETED 2026-05-21

## 1. Việc đã làm

- **25.0 — FE schema rename `latest_price` → `latest`** (Phase 24 REVIEW High carry):
  - BE serves `latest: LatestPrice | None` (TAD g02 §7.1 + BE schema). FE đã type `latest_price` từ Phase 7 — drift latent ~25 references trong PriceBoardTable, runtime crash khi BE thực serve real data.
  - Rename comprehensive trên: `types.ts`, `portfolio/page.tsx`, `price-board/page.tsx`, `PriceBoardTable.tsx`, `price-board-fixture.ts`.
  - Decouple `StockListItem` khỏi `StockStaticInfo` (BE 2 schemas khác biệt — Stock Detail vẫn cần `static.current_price`).
  - Page-level filter `row.latest !== null` với TypeScript narrow guard `RowWithPrice`.
- **25.1 — HoldingFormModal TODAY runtime** (Phase 19 REVIEW Low carry):
  - `const TODAY = '2026-05-07'` → `const TODAY = useMemo(() => new Date().toISOString().slice(0, 10), [])`.
  - Stable trong vòng đời mount; refresh khi reopen modal.
- **25.2 — 3 banner disclaimer**:
  - Tạo `<InfoBanner>` reusable component (theme tokens + Info icon + `data-testid` hook).
  - Dashboard banner: macro Q2 2026 hardcoded + alpha heuristic proxy.
  - News banner: fixture 150 articles 2026-05 + RSS crawler post-MVP.
  - Backtest banner: heuristic mock (MUA → return dương / GIU → −7..+12 / BAN → return âm).
  - i18n VI + EN: `dashboard.disclaimer`, `news.disclaimer`, `backtest.disclaimer`.
- **25.3 — `script/pre-handoff-refresh.sh`** (operator manual checklist):
  - 4-step: backup → WIPE financial_reports → POST `/refresh/all` → poll status → audit coverage.
  - Combine Phase 21 (parser KBS + no-downgrade upsert + multi-source merge) + Phase 22 (source-aware unit scaling) fix trên `prod-screener.db`.
  - Requires `API_PASSWORD` env. Confirm prompt trước destructive ops.
- **25.4 — `feature_service` total_assets sanity guard** (Phase 22 REVIEW High carry):
  - `_warn_total_assets_range()` warn-log nếu `0 < total_assets < 1e9 VND`.
  - Sentinel cho source-unit drift (post Phase 22 source-aware scaling) — KHÔNG block screening.
  - 6 unit test cover above/below/zero/None/non-numeric/boundary case.
- **E2E adjust**: Test 04 Dashboard KPI labels add `{ exact: true }` để tránh strict-mode collision với banner copy chứa "VN-Index".

## 2. File đã thêm

- `mvp/phases/phase-25-pre-handoff-ux-polish/SUMMARY.md` — audit trail 9-section.
- `mvp/phases/phase-25-pre-handoff-ux-polish/REVIEW.md` — self-critical review.
- `report/phase-mvp/phase-25-pre-handoff-ux-polish/SUMMARY.md` — file này.
- `frontend/src/components/common/InfoBanner.tsx` — reusable banner component.
- `mvp/code/tests/unit/test_feature_sanity.py` — 6 unit test cho sanity guard.
- `script/pre-handoff-refresh.sh` — operator 4-step refresh checklist.

## 3. File đã sửa

- `frontend/src/lib/types.ts` — `StockListItem` standalone interface với `latest: LatestPrice | null`.
- `frontend/src/app/(app)/portfolio/page.tsx` — `stock?.latest?.close` (rename hoàn tất).
- `frontend/src/app/(app)/price-board/page.tsx` — filter `row.latest !== null` + narrow `RowWithPrice`.
- `frontend/src/components/price-board/PriceBoardTable.tsx` — rename `latest_price` → `latest` × 25 refs; `PriceBoardRow` prop type.
- `frontend/src/mocks/data/price-board-fixture.ts` — field rename + drop vestigial `current_price`/`reference_price`.
- `frontend/src/components/portfolio/HoldingFormModal.tsx` — runtime TODAY.
- `frontend/src/app/(app)/page.tsx` — wire Dashboard banner.
- `frontend/src/app/(app)/news/page.tsx` — wire News banner.
- `frontend/src/app/(app)/run-history/page.tsx` — wire Backtest banner.
- `frontend/src/messages/en.json` + `vi.json` — 3 disclaimer key × 2 locale.
- `frontend/tests/e2e/smoke.spec.ts` — KPI exact-match.
- `mvp/code/app/services/feature_service.py` — `_warn_total_assets_range()` helper + invocation.

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2

# Frontend
cd frontend
npx tsc --noEmit
# (clean)

CI=1 npx playwright test
# 8 passed (42.1s)

# Backend
cd ../mvp/code
uv run pytest tests/unit/test_feature_sanity.py -v
# 6 passed

uv run pytest -q
# 294/294 passed (288 cũ + 6 mới)

uv run ruff check app tests
# All checks passed

# Pre-handoff script syntax (KHÔNG chạy live trong phase này)
bash -n /Users/ngominhtu/Projects/stock-v2/script/pre-handoff-refresh.sh
# (syntax OK)
```

## 5. Kết quả

- **Tests:**
  | Suite | Trước Phase 25 | Sau Phase 25 |
  |---|---|---|
  | TypeScript | clean | clean ✅ |
  | Playwright E2E | 8/8 | 8/8 ✅ (sau KPI exact-match fix) |
  | BE pytest | 288/288 | **294/294** ✅ (+6 sanity test) |
  | Ruff | clean | clean ✅ |
- **Schema rename outcome**:
  - `rg latest_price src/` → chỉ còn matches trong comment + non-runtime path.
  - `PriceBoardTable.tsx` access `r.latest.close` (non-null) thay vì `r.latest_price.close` (runtime crash trên real BE data).
- **Disclaimer banner** render trên 3 page (testIds: `dashboard-disclaimer`, `news-disclaimer`, `backtest-disclaimer`).
- **HoldingFormModal TODAY** = `useMemo(() => new Date().toISOString().slice(0, 10), [])`.
- **Sanity guard** log warning khi `total_assets < 1e9 VND` cho ticker realistic — drift sentinel cho source-unit issue Phase 22+.
- **Pre-handoff script** syntax-valid, executable, backup-first, confirm-prompt.

## 6. Tồn đọng

- **Operator pre-handoff refresh** chưa chạy live — Phase 25 chỉ ship script. Trước ngrok hand-off, operator chạy `bash script/pre-handoff-refresh.sh` (~22 phút) trên prod DB.
- **Telegram broadcast real-bot verify** chưa run end-to-end — Phase 23 REVIEW carry. Operator manual `POST /api/run` sau refresh.
- **PriceBoard placeholder** cho ticker null-latest — hiện ẩn rows. Phase 27 thêm "Chưa có dữ liệu" row hoặc count summary.
- **Sanity guard floor 1e9 VND có thể false-positive** cho MOCK% ticker trong seed. Phase 26+ nâng lên 1e10 hoặc exclude pattern.
- **`InfoBanner` dismiss/persist** — Phase 28.
- **Turbopack migration** + `useExportPdf` blob refactor — Phase 27.
- **KBS bvps compute fallback + period suffix rule** — Phase 26 optional (post-trader feedback).
- **`StockBase` interface extract** — defer khi có 3+ shape divergence trong tương lai.
- **Smoke test comment stale** (`HoldingFormModal hardcodes TODAY=2026-05-07`) — cosmetic cleanup defer.

## 7. Pre-handoff checklist (operator next)

1. `bash script/pre-handoff-refresh.sh` (~22 phút) — backup + WIPE + refresh + audit ≥4/5 core BCTC field per ticker.
2. Manual `POST /api/run` — verify Telegram broadcast real-bot nhận message.
3. Smoke 8 page production build (login → dashboard → top-mua → red-flags → stock-detail → price-board → news → portfolio → run-history → settings).
4. `bash script/run-ngrok.sh` (hoặc setup ngrok manual) → public URL → hand-off trader test data thật so với CafeF/Vietstock.
