# Phase 9 — FE Swap MSW → Real Backend

**Status:** COMPLETED 2026-05-11
**Estimate vs actual:** 0.5d / ~2.5h
**Spec ref:** [PLAN.md §2 + §3 row 9](../../PLAN.md), [TAD g08 §FE Prototype Precedes Packages](../../../docs/tad/g08-coding-packages.md), [TAD g02 §5 apiFetch](../../../docs/tad/g02-api.md), Phase 6+7+8 SUMMARY hand-offs.

## 1. Scope

Frontend `frontend/` (forked 2026-05-09) chuyển từ MSW handlers sang FastAPI backend Phase 0-8 thực, KHÔNG rebuild UI. Three swap surfaces:

**A. Network layer** (must do):
- `apiFetch` prepend `NEXT_PUBLIC_API_BASE_URL` cho `/api/...` paths.
- `.env.local` ship default `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` + `NEXT_PUBLIC_ENABLE_MSW=false`.
- `MswBootstrap` gate via `NEXT_PUBLIC_ENABLE_MSW === 'true'` (opt-in only).

**B. Schema drift fixes** (priority — runtime crash without):
- `SharedViewResponse` shape — TAD g02 §9.2 vs prototype mock divergence.
- `BacktestStatusResponse` — drop `progress_percent`/`current_step` (backend Phase 8 không có column).
- `BacktestMetrics.roi_curve[].week` (NOT `date`).
- `BacktestResultRow.actual_return_3m` (NOT `actual_return_3m_pct`); drop `name` field.
- `BacktestResultsResponse` shape: `{results}` only (no top-level `backtest_id`).
- `RunResultsResponse` shape: `{results, total}` only — backend Phase 6 has separate `/excluded` endpoint.
- Excluded list field rename `reason → reason_text` để match FE consumer.

**C. Page-level adaptation** (where shape diverges):
- Red Flags page: 2 useApiResource (results + excluded) instead of 1.
- SharedView component: consume `data.data.{summary,dashboard,top_mua}` instead of `data.run.{summary,dashboard,results}`.
- Backtest progress block (run-history page): swap percent bar → spinner (no progress field).
- BacktestRoiChart: `dataKey="week"`.
- BacktestDetailTable: rename column accessor.

## 2. Pre-code spec audit (drift report)

| # | Drift | Resolution |
|---|---|---|
| 1 | **MSW gating logic**: prototype default `NODE_ENV === 'development' \|\| NEXT_PUBLIC_ENABLE_MSW === '1'` always enabled MSW in dev. Phase 9 deployment runs FE+BE separate origins → MSW would intercept same-origin calls → backend bypassed. | ✅ Inverted gate: MSW only when `NEXT_PUBLIC_ENABLE_MSW === 'true'` explicit. Doc rationale in MswBootstrap docstring. Default `.env.local` ships `false`. |
| 2 | **`SharedViewResponse` shape mismatch**: FE prototype shape `{link, shared_by, run: {summary, dashboard, results}}` vs TAD g02 §9.2 backend `{token, run_id, expires_at, data: {summary, dashboard, top_mua}}`. | ✅ Adopted backend (TAD) shape. SharedView component consumes new shape. `shared_by` dropped (single-user MVP). `link.created_at` countdown swapped to `expires_at`-only. |
| 3 | **`top_mua` shape gap**: backend Phase 8 `_top_mua_rows` returns 9-field subset; FE TopMuaTable needs full ScreeningResult (`recommendation`, `warning_badges`, `reasons`, `radar`, `confidence_raw`, etc.). | ✅ Updated [export_service.build_share_data](../../code/app/services/export_service.py) to use `results_service.to_result_row` filter rec=MUA top 10 — full ScreeningResult shape. SharedView TopMuaTable renders identical to authenticated Top MUA page. |
| 4 | **Backtest status `progress_percent` + `current_step`**: FE expected per cluster 5 prototype but backend Phase 8 has no DB columns. Phase 8 status response only `{status, started_at, completed_at}`. | ✅ FE BacktestStatusResponse type updated; run-history page progress bar swap → simple spinner. `useBacktest` hook unchanged (only reads `status` enum). |
| 5 | **Backtest roi_curve `date` vs `week`**: TAD g02 §8.6 explicit `week: string` ISO label. FE chart `dataKey="date"`. | ✅ FE type + BacktestRoiChart updated to `week`. MSW backtest-store also emits ISO-week label for prototype consistency. |
| 6 | **Backtest result row `actual_return_3m_pct` vs `actual_return_3m`**: TAD §8.6 spec is `actual_return_3m` (no `_pct` suffix); `name` field doesn't exist in backend output. | ✅ FE type + BacktestDetailTable column accessor renamed; `name` column dropped. MSW handlers updated to match. |
| 7 | **`/runs/{id}/results` shape `{run_id, results, excluded, warnings}` vs backend `{results, total}`**: Phase 6 SUMMARY drift #1 documented — excluded served at separate endpoint `/api/runs/{id}/excluded`. | ✅ Red Flags page now uses 2 `useApiResource` calls. `RunResultsResponse` type simplified. MSW handler reflects new shape. |
| 8 | **Excluded item field `reason` (backend) vs `reason_text` (FE table)**: Phase 6 emit `reason`; `RedFlagsExcludedTable` accessor `reason_text`. | ✅ Backend `/api/runs/{id}/excluded` rename emit field `reason_text` (one-line diff). Phase 6 ExcludedItem schema doc note. |
| 9 | **Static reference data imports `@/mocks/data/*`**: FE components import `STOCK_FIXTURE`, `WARNING_BADGE_META`, `feature-dict`, `reason-codes`, `FIXTURE_NOW_MS` từ mocks. These are constants, NOT API mocks. | ✅ KEEP as-is — pure static reference data unchanged across MSW/real backend. Documented as accepted drift in §6. Post-MVP có thể move sang `/lib/constants/*`. |
| 10 | **CORS allow-origin**: backend [main.py:18](../../code/app/main.py) wires CORSMiddleware với `allow_origins=[settings.frontend_origin]` default `http://localhost:3000`. | ✅ No change needed — CORS preflight verified working. |

**Conventions locked Phase 9:**

- **MSW = legacy fallback**: gated `NEXT_PUBLIC_ENABLE_MSW=true` opt-in for prototype demo without backend. Production never enables.
- **Schema canonical = TAD g02**: backend follows TAD; FE drift gets reconciled toward TAD/backend. Future spec changes cluster reconciliation cascade FE → backend.
- **Static reference imports**: `@/mocks/data/{stocks-fixture, warning-badges, reason-codes, feature-dict, news-fixture}` stays — they're domain dictionaries, not network mocks.

## 3. Deliverables

Tất cả path relative tới repo root.

### Mới tạo
| Path | Nội dung |
|---|---|
| [frontend/.env.local](../../../frontend/.env.local) | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` + `NEXT_PUBLIC_ENABLE_MSW=false`. Doc inline: opt-in MSW khi backend off. |

### Sửa — Network layer (3 files)
| Path | Thay đổi |
|---|---|
| [frontend/src/lib/api.ts](../../../frontend/src/lib/api.ts) | + `BASE_URL` constant strip trailing slash; + `resolveUrl(path)` helper prepend BASE_URL nếu set, leave path alone nếu absolute (http*://); apiFetch internal call `resolveUrl(path)` |
| [frontend/src/components/common/MswBootstrap.tsx](../../../frontend/src/components/common/MswBootstrap.tsx) | Inverted gate: `enabled = process.env.NEXT_PUBLIC_ENABLE_MSW === 'true'` (was `NODE_ENV==='development'`). Updated docstring rationale (separate-origin concern). |
| [frontend/next.config.js](../../../frontend/next.config.js) | UNCHANGED — msw/browser server-side alias `false` still needed (MSW dev mode opt-in). |

### Sửa — Schema reconcile (5 FE files + 2 BE files)
| Path | Thay đổi |
|---|---|
| [frontend/src/lib/types.ts](../../../frontend/src/lib/types.ts) | `RunResultsResponse` → `{results, total}`. `BacktestStatusResponse` → `{backtest_id, status, started_at, completed_at}` (drop progress_percent/current_step/error). `BacktestMetrics.roi_curve` items `{week, ...}` (was `{date, ...}`). `BacktestResultRow` rename `actual_return_3m_pct → actual_return_3m`, drop `name`. `BacktestResultsResponse` drop `backtest_id`. `SharedViewResponse` → `{token, run_id, expires_at, data: {summary, dashboard, top_mua: ScreeningResult[]}}` (was `{link, shared_by, run: {...}}`). |
| [frontend/src/components/share/SharedView.tsx](../../../frontend/src/components/share/SharedView.tsx) | Destructure removed; reference `data.run_id`, `data.expires_at`, `data.data.dashboard`, `data.data.top_mua` directly. Drop `shared_by` line, drop `formatDate(link.created_at)` (use Run id chip instead). |
| [frontend/src/components/backtest/BacktestRoiChart.tsx](../../../frontend/src/components/backtest/BacktestRoiChart.tsx) | XAxis `dataKey="week"`. |
| [frontend/src/components/backtest/BacktestDetailTable.tsx](../../../frontend/src/components/backtest/BacktestDetailTable.tsx) | Rename column accessor `actual_return_3m_pct → actual_return_3m`. Remove `title={row.original.name}` (no name field). |
| [frontend/src/app/(app)/run-history/page.tsx](../../../frontend/src/app/(app)/run-history/page.tsx) | Backtest progress bar (used `progress_percent`/`current_step`) replaced với simple Loader2 spinner + `tBack('button.running')` label. |
| [frontend/src/app/(app)/red-flags/page.tsx](../../../frontend/src/app/(app)/red-flags/page.tsx) | Add second `useApiResource<{items, total}>` cho `/api/runs/{run_id}/excluded`. Pass `excludedRes.data?.items ?? []` to `RedFlagsExcludedTable`. Loading guard includes excludedRes.loading. |
| [mvp/code/app/api/results.py](../../code/app/api/results.py) | Excluded endpoint: rename emit field `reason → reason_text` (match FE accessor). |
| [mvp/code/app/services/export_service.py](../../code/app/services/export_service.py) | `build_share_data` use `results_service.to_result_row` filter rec=MUA top 10 (full ScreeningResult shape) thay vì `_top_mua_rows` 9-field subset. |

### Sửa — MSW prototype consistency (3 files, OPTIONAL khi MSW=true)
| Path | Thay đổi |
|---|---|
| [frontend/src/mocks/data/backtest-store.ts](../../../frontend/src/mocks/data/backtest-store.ts) | roi_curve emit ISO `week` label; result rows drop `name`, rename `actual_return_3m_pct → actual_return_3m`. |
| [frontend/src/mocks/handlers.ts](../../../frontend/src/mocks/handlers.ts) | `/api/runs/{id}/results` emit `{results, total}`. `/api/backtest/{id}/status` emit `{backtest_id, status, started_at:null, completed_at:null}`. `/api/backtest/{id}/results` emit `{results}`. `/api/share/{token}` emit `{token, run_id, expires_at, data: {summary, dashboard, top_mua}}`. |

## 4. Exit criteria — all PASS

- `npx tsc --noEmit` (frontend) → No errors
- `npm run build` (frontend) → ✓ All 14 routes compile (8 app pages + login + share + 4 system)
- Backend regression: `uv run pytest tests/integration/test_results.py` → 11/11 pass; `tests/integration/test_share.py` → 10/10 pass (build_share_data refactor verified)
- Smoke E2E:
  - Backend uvicorn at :8000 + FE next dev at :3000
  - `curl /api/health` → envelope OK
  - CORS preflight from `Origin: localhost:3000` → 200 với `access-control-allow-origin: http://localhost:3000` + `access-control-allow-credentials: true`
  - `/api/runs?limit=2` envelope `{success, data: {items, total, limit, offset}}` ✓
  - `/api/portfolio` empty list `{success, data: {items: [], total: 0}}` ✓
  - `/api/share/badtoken` PUBLIC route 404 với CORS headers ✓
- Build artifact verify: `MswBootstrap` compiled với `enabled = "false" === "true"` (= false) — proves `.env.local` inlined correctly.
- 8 app pages routes successfully prerender:
  - `/` Dashboard, `/top-mua`, `/red-flags`, `/stock-detail`, `/price-board`, `/news`, `/portfolio`, `/run-history`, `/settings`
  - `/share/[token]` dynamic ƒ
  - `/login` static

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| MSW gate | `NEXT_PUBLIC_ENABLE_MSW === 'true'` opt-in | Phase 9 deployment FE+BE separate origins; MSW would otherwise over-intercept |
| BASE_URL strategy | env var prepend, empty = relative (legacy MSW) | Single-flag swap; preserves prototype demo mode |
| Schema canonical source | Backend (TAD) — FE adapts | Backend follows TAD g02 spec; FE drift được reconcile khi swap |
| `top_mua` in SharedView | Full ScreeningResult shape (filter rec=MUA top 10) | TopMuaTable component reuse; backend `to_result_row` đã có sẵn |
| Backtest status response | `{status, started_at, completed_at}` only | DB schema không có progress columns; FE spinner đủ UX |
| Excluded list field rename | `reason → reason_text` ở backend | FE component đã expect `reason_text` cluster 6; rename cheaper than FE update |
| Static reference data | KEEP `@/mocks/data/*` imports | Pure constants (whitelist, badges, codes, fixtures); not network-dependent |
| Backtest progress UI | Simple spinner | No progress data → don't fake it |
| `shared_by` field | DROP từ FE (KHÔNG add vào backend) | Single-user MVP — owner identity always = "Ngô Minh Tú", FE rendered display chỉ trang trí |
| `relativeExpiry` countdown | Keep với `data.expires_at` only (no `created_at`) | Backend không emit `created_at`; expires-only đủ render countdown |
| Recompile MSW handlers | YES, prototype mode parity | Devs có thể vẫn flip MSW=true để demo offline; types must match cả 2 codepath |

## 6. Issues / drift

- **`useFeatureDict`/`@/mocks/data/*` imports**: 7 components still import static dictionary data từ `mocks/data/`. KHÔNG phải runtime mock — pure constants. Phase 10 hoặc post-MVP có thể move sang `lib/constants/` cho cleanliness. Hiện tại không gây runtime issue.
- **Phase 6 endpoint registry doc gap**: TAD g02 §1 vẫn chưa list `GET /runs/{id}/excluded` + `GET /stocks/{ticker}/runs`. Phase 9 merge với reason_text rename → cluster 7+ reconcile cần update TAD §1 registry + Phase 6 ExcludedItem schema doc. Tracked trong Phase 6 SUMMARY §2 + Phase 9 §2 #8.
- **`reason_text` schema impact**: backend test_results.py không assert specific field name trong excluded shape — chỉ check `len(items) == 4`. Rename không break tests. FE tests don't exist in this monorepo. Verified runtime via build success only.
- **Backtest progress UX downgrade**: cluster 5 prototype showed % bar (5%→25%→55%→80%) cho ~8.5s mock. Phase 9 + Phase 8 backend = simple spinner cho ~1.2s real BG. Acceptable trade-off — UX đơn giản hơn cluster 5. Nếu sau này thêm `progress_percent` column vào BacktestRun, restore bar.
- **`run.run_at` không hiển thị trong SharedView**: cluster 6 prototype shows `formatDate(link.created_at)`. Backend `/api/share/{token}` không emit `created_at`. Phase 9 SharedView header chỉ hiển thị `Run: {run_id}` thay vì timestamp. Acceptable — token + expiry đủ context.
- **MSW handlers dev-only schema drift**: backtest-store + handlers updated to match new types nhưng prototype-only. Devs flipping MSW=true cho demo offline phải re-verify scenarios. Production never hits MSW.
- **Stock Detail page chưa verify với real backend**: Phase 9 type check + build pass nhưng chưa interactive smoke (backend cần data scored để render Stock Detail). Phase 10 (Integration QA) sẽ cover end-to-end với synthetic screening_data.
- **No FE unit tests**: chỉ tsc + build verify type safety. Phase 10 nên thêm critical-path Playwright/Cypress smoke (login → run → dashboard → portfolio CRUD → backtest → share → PDF download).
- **`apiFetch` 401 redirect nhưng login đang ở `/login` already**: handled — `clearTokenAndRedirect()` skip nếu pathname === '/login'. KHÔNG infinite loop.

## 7. Test commands (reproducible)

```bash
# === Frontend type + build ===
cd frontend
npx tsc --noEmit                          # No errors
npm run build                              # 14 routes ✓

# === E2E smoke (2 terminals) ===
# Terminal 1 — backend
cd mvp/code
uv run uvicorn app.main:app --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev                                # http://localhost:3000

# Verify CORS + envelope
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl -sS "http://127.0.0.1:8000/api/runs?limit=2" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Origin: http://localhost:3000'

# Browser flow
# 1. http://localhost:3000/login → password ChangeMe123! → redirect /
# 2. /run-history → click "Run Backtest" (cần ít nhất 1 run COMPLETED — chạy /api/run trước hoặc chờ)
# 3. /portfolio → "+ Thêm" → tạo 1 holding VHM (validate ticker uppercase)
# 4. /share/[token] (sau khi tạo share link từ Settings) → public view không cần đăng nhập
# 5. Settings → Telegram → "Gửi tin thử" → toast (sent=false vì creds rỗng)

# === Toggle MSW prototype mode (offline demo) ===
# In frontend/.env.local: NEXT_PUBLIC_ENABLE_MSW=true
# Stop backend; restart npm run dev → MSW handlers serve all /api/* paths
```

## 8. Hand-off cho Phase 10

Phase 10 (Integration QA + bug fixes — 1d) sẽ:
- Run AC checklist 17 SRS files end-to-end với real backend
- Regression theo cluster summaries §11 manual test
- Bug fix nhỏ phát sinh khi user duyệt 8 page routes + 4 themes + VIE/EN
- Generate `report/mvp-build/SUMMARY.md` document drift / TODO post-MVP

Đã sẵn sàng:
- 39 backend endpoints (Phase 0-8) — full TAD g02 §1 registry covered
- All envelopes consistent
- DELETE 200+envelope across portfolio/runs/share
- Public route `/share/{token}` bypass auth
- PDF download Content-Disposition stable
- MSW opt-in fallback

⚠️ **Phase 10 phải audit**:
- 17 SRS files acceptance criteria — interactive verify trong browser
- Stock Detail page với real screening data (need 1 COMPLETED run first)
- Backtest 2-stage polling 1.5s tick — verify smooth progression
- PDF download mở được trong browser (test cả 2 modes: weasyprint + html_mock fallback)
- Telegram settings UI điền + save settings + test send với real Bot API (cần credentials thật để verify success path)
- Theme + i18n không broken sau swap
- Run History delete → cascade results + excluded ✓ (Phase 5)
- Compare panel 4-section render từ real /api/runs/{a}/compare/{b}
- Portfolio CRUD → backend persist; reload page giữ nguyên (KHÔNG reset như prototype mock)
- News page 150 articles seed — verify pagination + filter
- Phase 10 generate `report/mvp-build/SUMMARY.md`

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 9 sau khi phase đã đóng)*
