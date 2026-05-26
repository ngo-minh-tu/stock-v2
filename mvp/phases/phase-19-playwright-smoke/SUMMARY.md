# Phase 19 — Playwright Critical-Path Smoke

**Started:** 2026-05-20 · **Closed:** 2026-05-20
**Roadmap:** Mốc 3 step 8 (release hardening) — last gate before MVP public release.

## 1. Scope

Cài Playwright trong `frontend/` và viết một spec smoke **8-path stateful journey** cover toàn bộ critical path browser của MVP:

`login → refresh → run → dashboard → portfolio → backtest → share → PDF`

Mục tiêu của phase: cover real Next-on-:3000 + FastAPI-on-:8000 dual-process setup mà BE unit/integration tests + FE typecheck không thể bắt được (CORS, schema mismatch, locale, modal a11y, base URL).

Out of scope (carry sang Phase 20): Telegram real-send với Bot token user cấp, Next 16 / next-intl 4.12 / postcss security upgrade, KBS alias gap, paid vnstock key.

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution trong Phase 19 |
|---|---|---|---|
| 19-01 | `POST /api/refresh/all` không có FE button — SRS f02 implicit auto-refresh trong screening flow, nhưng critical-path user yêu cầu kiểm "refresh" như 1 bước. | FE prototype | Playwright dùng `page.request.post('/api/refresh/all')` thay UI click; document trong test §02. |
| 19-02 | `_client_factory` test hook ở `refresh_service.py:25` chỉ hoạt động trong pytest monkeypatch — uvicorn process độc lập không inject được. | `app/crawlers/vnstock_client.py` | Thêm env `VNSTOCK_CLIENT_STUB=true` để `fetch_prices/financials` early-return `[]`. Demo + E2E mode bật flag; production giữ `false`. |
| 19-03 | **BE↔FE dashboard schema completely mismatched** — Phase 9 reconcile miss. BE return `kpis/index_trend/top_by_score/radar_avg`, FE expect `kpi/line.points/bar/radar`; KPI fields thiếu `avg_buy_score`, `top_upside`, `alpha_vs_vnindex_pct`. | `app/services/dashboard_service.py`, `app/schemas/result.py`, `app/components/dashboard/*` | Rename BE fields về FE shape + compute thêm `avg_buy_score`, `top_upside`. `test_dashboard.py` update đầy đủ asserts mới. |
| 19-04 | `CapitalModal.tsx` thiếu `role="dialog"` + `aria-modal="true"` (BacktestModal, PdfPreviewModal, HoldingFormModal, ShareLinkModal đã có). | `components/run/CapitalModal.tsx` | Thêm 2 attribute để Playwright + screen reader nhận diện modal. |
| 19-05 | `portfolio.modal.add` xung đột 2 type — JSON key cùng tên là object (`{title}`) **và** string (`"Add"`) → JSON parser lấy string, `t('add.title')` trả literal "add.title". | `messages/{en,vi}.json`, `components/portfolio/HoldingFormModal.tsx` | Rename submit-button key `add` → `submitAdd`; component cập nhật. |
| 19-06 | `useExportPdf.ts` dùng raw `fetch('/api/...')` không qua `apiFetch`, không prepend `NEXT_PUBLIC_API_BASE_URL` → request đập vào :3000 (không có route), 404; modal Download button kẹt disabled vĩnh viễn. Phase 8 close không bắt vì PDF mode local test dùng cùng origin (MSW). | `lib/api.ts`, `lib/hooks/useExportPdf.ts` | Export `resolveUrl` từ api.ts; `fetchPdf` dùng `resolveUrl` + đính `Authorization: Bearer`. |

3 trên 6 drift là **bug production**, chỉ E2E mới catch được — đây là giá trị chính của Phase 19.

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `frontend/playwright.config.ts` | Playwright config: 1 chromium project, baseURL `localhost:3000`, webServer array bật BE + FE prod build (`npm run build && npm start`), trace/video/screenshot retain-on-failure. |
| `frontend/tests/e2e/smoke.spec.ts` | 8-path stateful journey trong 1 `test.describe` serial, shared `BrowserContext + Page` qua `beforeAll`, `addInitScript` force `localStorage.locale='en'`. |
| `frontend/package.json` | DevDep `@playwright/test`; npm scripts `e2e`, `e2e:headed`, `e2e:ui`, `e2e:report`. |
| `frontend/src/components/run/CapitalModal.tsx` | Thêm `role="dialog"` + `aria-modal="true"`. |
| `frontend/src/components/portfolio/HoldingFormModal.tsx` | `t('add')` → `t('submitAdd')`. |
| `frontend/src/messages/en.json`, `vi.json` | Rename xung đột `add` (string) → `submitAdd`; giữ `add.title` object. |
| `frontend/src/lib/api.ts` | Export `resolveUrl`. |
| `frontend/src/lib/hooks/useExportPdf.ts` | `fetchPdf` dùng `resolveUrl` + Bearer header. |
| `script/e2e-start-backend.sh` | Khởi động uvicorn ở mode `APP_ENV=demo`, `DB_PATH=./data/demo-screener.db`, `VNSTOCK_CLIENT_STUB=true`, `EXPORT_PDF_MODE=html_mock`; auto run `demo_seed` nếu DB chưa tồn tại. |
| `mvp/code/app/config.py` | Settings field mới `vnstock_client_stub: bool = False`. |
| `mvp/code/app/crawlers/vnstock_client.py` | Early-return `[]` trong `fetch_prices` + `fetch_financials` khi stub flag bật. |
| `mvp/code/app/services/dashboard_service.py` | Reshape response về FE convention: `kpi/treemap/pie(list)/radar/line{points}/bar`; tính `avg_buy_score`, `top_upside`. |
| `mvp/code/app/schemas/result.py` | `DashboardKpi` (rename), `PieSlice`, `DashboardLineSeries`, `TopUpsideRef`; `DashboardResponse` mới. |
| `mvp/code/tests/integration/test_dashboard.py` | Assert shape mới (key set + nested types + 3-element pie list). |
| `mvp/code/tests/unit/test_vnstock_client.py` | Test `VNSTOCK_CLIENT_STUB=true` short-circuit cả 2 fetch path. |
| `mvp/code/.env.example`, `env.demo.example` | Document `VNSTOCK_CLIENT_STUB` (default false / demo true). |
| `.gitignore` | Bỏ qua `frontend/test-results/`, `playwright-report/`, `playwright/.cache/`. |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| Cả 8 critical-path step pass | ✅ | `CI=1 npx playwright test --reporter=list` → `8 passed (41.3s)`. |
| BE pytest 257/257 pass sau drift fix | ✅ | `cd mvp/code && uv run pytest -q` → 257 dots. |
| Ruff sạch | ✅ | `uv run ruff check app tests` → All checks passed. |
| TypeScript check sạch | ✅ | `cd frontend && npx tsc --noEmit` → no output (clean). |
| Playwright webServer auto-start BE+FE prod build | ✅ | playwright.config.ts khởi động `bash ../script/e2e-start-backend.sh` + `npm run build && npm start`. |
| Không phá vỡ contract hiện có | ✅ | Phase 9 SUMMARY chỉ chứa "FE swap done" — không có assertion về `kpis/index_trend` ngoài test_dashboard.py (đã update). |

## 5. Quyết định khoá trong phase này

- **Locale strategy cho E2E**: `addInitScript` set `localStorage.locale='en'` trên context level. Không thay đổi `DEFAULT_LOCALE` (giữ `vi` cho user thực).
- **Shared BrowserContext**: 1 context + 1 page sử dụng chung qua `beforeAll`/`afterAll`. Tests theo `test.describe.configure({ mode: 'serial' })`. Tránh storageState boilerplate cho stateful journey.
- **Next.js build mode for E2E**: dùng `npm run build && npm start` thay `npm run dev` để tránh Fast Refresh tear down DOM giữa test (đã quan sát flakiness ở test 5 & 6 với dev mode). Trade-off: cold build ~30s thêm vào tổng thời gian E2E.
- **Refresh path = page.request, không phải UI click**: FE prototype không có refresh button. Playwright gọi thẳng API + poll status; cập nhật critical path để reflect actual UX. **Backlog:** thêm refresh button vào FE nếu sau này muốn cover qua UI.
- **vnstock stub flag = settings field, không phải factory swap**: minimal scope. `VnstockClient.fetch_*` early-return `[]` khi `settings.vnstock_client_stub == True`. Refresh stats sẽ ghi `empty=N` cho mọi ticker, status terminal vẫn `COMPLETED`. Cache không bị mark FRESH (đảm bảo screening không dùng nhầm).
- **Portfolio test idempotency**: thay vì assume DB trống, test DELETE tất cả holdings qua API ở đầu test 5. Demo DB persist giữa runs nhưng test luôn quy về empty trước khi add VHM.
- **Dashboard shape source-of-truth**: align BE → FE (không thêm FE adapter). Lý do: FE đã deep-coupled với shape này qua DashboardResponse type và 6 chart components; thêm adapter làm 2 chỗ phải maintain. SharedView dùng cùng type nên cũng được hưởng lợi.
- **JSON i18n key naming convention**: tránh dùng cùng key cho cả namespace object lẫn flat string trong cùng level. `submitAdd`/`save`/`cancel` thay vì `add`/`save`/`cancel` khi đã có `add: {title}` sibling.

## 6. Issues / drift còn open

- **PDF preview dual-fetch 401**: log E2E cho thấy fetch thứ 2 của `/api/export/pdf/{run}` trả 401 (download trigger sau preview load). Test 8 pass vì file đã download từ blob đã cache trong hook state, nhưng audit chain xem có cần xử lý fetch repeat không. Low priority — preview mode chỉ fetch 1 lần qua `fetchPdf`, download trigger reuse cached blob (`useExportPdf.confirmDownload`).
- **`addInitScript` không chạy khi Next.js Fast Refresh full-reload**: đã workaround bằng switch sang prod build. Nếu cần chạy E2E trên dev mode để debug, locale có thể revert về VI giữa tests. Phase 20 có thể thêm fixture inject token + locale qua `storageState`.
- **Demo DB stale state across runs**: portfolio cleanup hiện trong test 5. Backtest/share/PDF không có cleanup — log E2E thấy `option "20/05/26 08:17 — 26 mã"` plus 7 runs cũ từ smoke trước. Nếu cần snapshot reset, thêm `demo_reset.py` (xoá runs > 1 ngày, giữ `run_demo_latest`).
- **HoldingFormModal `TODAY=2026-05-07` hard-coded**: Phase 7 chốt nhưng đã trượt — hôm nay là 2026-05-20. Test phải dùng `buyDate` mặc định để pass. **Carry to Phase 20**: convert TODAY thành `useMemo(() => new Date().toISOString().slice(0,10), [])`.

## 7. Test commands (reproducible)

```bash
# Pre-req: demo DB seeded once
cd mvp/code
APP_ENV=demo DB_PATH=./data/demo-screener.db uv run python -m app.db.demo_seed

# Full BE regression (257 tests) — must pass before E2E
uv run pytest -q
uv run ruff check app tests

# E2E smoke — auto starts BE (demo+stub) + FE (prod build) on :8000/:3000
cd ../../frontend
npm install                    # 1st time
npx playwright install chromium  # 1st time
CI=1 npx playwright test --reporter=list

# Inspection (run in dev mode, headed browser)
npm run e2e:headed
npm run e2e:report
```

Expected: 8 passed (~40-60s wall time).

## 8. Hand-off cho Phase 20

Còn lại từ Mốc 3 hand-off (sau Phase 19):

1. **Telegram real-send live verify** — user cấp Bot token + chat_id. Verify cả `/api/telegram/test` (success envelope `{sent:true}`) lẫn actual Telegram message arrival. Cập nhật `env.production.example`.
2. **Next 16 + next-intl 4.12 + postcss security upgrade** — Phase 18 defer; FE security audit còn 1 critical + 2 moderate. Phase 20 chạy regression FE đầy đủ (Playwright smoke + manual nav 9 page) sau upgrade.
3. **HoldingFormModal `TODAY` hard-coded** (Issue 6.4) — convert sang runtime date.
4. **KBS alias mapping** — `total_assets`, `revenue`, `total_liabilities` về 0 trong fallback path; cần map thêm.
5. **Vnstock paid API key** (optional) — giảm refresh từ 14m → ~3m.
6. **Production deploy actuals** — Docker build + provision + HTTPS reverse proxy + crontab wire (tooling Phase 18 đã sẵn).

## 9. Post-phase fixes

*Reserved cho user-requested fix sau khi phase này đóng. Theo memory feedback_post_fix_cluster_log, mỗi fix phải append §9 với date + scope.*
