# Phase 9 — FE Swap MSW → Real Backend

**Ngày:** 2026-05-11
**Mục tiêu thực hiện:** chuyển `frontend/` từ MSW handlers sang FastAPI backend Phase 0-8 thực, KHÔNG rebuild UI; reconcile 8 schema drift FE↔BE tích lũy từ cluster prototype phase.
**Trạng thái:** COMPLETED 2026-05-11

## 1. Việc đã làm

- Pre-code drift audit 10 mục — 8 schema drift FE↔BE từ cluster prototype + MSW gate + static reference data:
  - MSW gate inversion: `enabled = process.env.NEXT_PUBLIC_ENABLE_MSW === 'true'` opt-in (was always-on dev).
  - `SharedViewResponse`: backend canonical `{token, run_id, expires_at, data: {summary, dashboard, top_mua}}`; FE drop `shared_by` (single-user MVP).
  - `BacktestStatusResponse`: drop `progress_percent`/`current_step` (backend không có column).
  - `BacktestMetrics.roi_curve[].week` (not `date`) — TAD g02 §8.6 ISO label.
  - `BacktestResultRow.actual_return_3m` (not `_pct`); drop `name` field.
  - `BacktestResultsResponse {results}` only — no top-level `backtest_id`.
  - `RunResultsResponse {results, total}` only — excluded served at separate `/runs/{id}/excluded`.
  - Excluded item field rename backend `reason → reason_text` để match FE accessor cluster 6.
  - `top_mua` shape: backend chuyển sang reuse `results_service.to_result_row` filter rec=MUA top 10 (full ScreeningResult) thay 9-field subset.
  - Static reference imports `@/mocks/data/*` KEEP — pure constants, không API mocks.
- Network layer: `apiFetch` thêm `BASE_URL` constant + `resolveUrl(path)` helper; `.env.local` ship default `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` + `NEXT_PUBLIC_ENABLE_MSW=false`.
- 5 FE file sửa shape: `lib/types.ts`, `components/share/SharedView.tsx`, `BacktestRoiChart.tsx`, `BacktestDetailTable.tsx`, `red-flags/page.tsx` (2 useApiResource).
- 1 FE file UX downgrade: `run-history/page.tsx` backtest progress bar → Loader2 spinner.
- 2 BE file: `app/api/results.py` rename emit `reason → reason_text`; `app/services/export_service.py` `build_share_data` reuse `to_result_row`.
- MSW handlers + backtest-store update đồng bộ types để prototype mode opt-in vẫn compile (`MSW=true` cho devs offline demo).
- CORS verified: backend `main.py` `allow_origins=[settings.frontend_origin]` default `http://localhost:3000` — preflight 200 với `access-control-allow-credentials: true`.

## 2. File đã thêm

- `frontend/.env.local` — `NEXT_PUBLIC_API_BASE_URL` + `NEXT_PUBLIC_ENABLE_MSW=false`.

## 3. File đã sửa

- `frontend/src/lib/api.ts` — `BASE_URL` + `resolveUrl(path)`.
- `frontend/src/components/common/MswBootstrap.tsx` — gate inverted `=== 'true'`.
- `frontend/src/lib/types.ts` — 6 type shape reconcile.
- `frontend/src/components/share/SharedView.tsx` — consume new `{data: {...}}` shape.
- `frontend/src/components/backtest/BacktestRoiChart.tsx` — `dataKey="week"`.
- `frontend/src/components/backtest/BacktestDetailTable.tsx` — rename accessor + drop name.
- `frontend/src/app/(app)/run-history/page.tsx` — spinner thay percent bar.
- `frontend/src/app/(app)/red-flags/page.tsx` — 2 useApiResource (results + excluded).
- `frontend/src/mocks/data/backtest-store.ts`, `frontend/src/mocks/handlers.ts` — MSW prototype consistency.
- `mvp/code/app/api/results.py` — `reason → reason_text` emit.
- `mvp/code/app/services/export_service.py` — `build_share_data` reuse `to_result_row` rec=MUA top 10.

## 4. Lệnh đã chạy

```bash
# === Frontend type + build ===
cd frontend
npx tsc --noEmit                          # No errors
npm run build                              # 14 routes

# === E2E smoke (2 terminals) ===
# Terminal 1 — backend
cd mvp/code
uv run uvicorn app.main:app --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev                                # http://localhost:3000

# Backend regression
cd mvp/code
uv run pytest tests/integration/test_results.py    # 11/11
uv run pytest tests/integration/test_share.py      # 10/10

# Verify CORS + envelope
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS "http://127.0.0.1:8000/api/runs?limit=2" \
  -H "Authorization: Bearer $TOKEN" -H 'Origin: http://localhost:3000'
```

## 5. Kết quả

- `npx tsc --noEmit`: PASS, no errors.
- `npm run build`: PASS — 14 routes compile (8 app pages + login + share dynamic + 4 system).
- Backend regression: 11/11 + 10/10 PASS.
- Smoke verified:
  - `curl /api/health` envelope OK.
  - CORS preflight `Origin: localhost:3000` → 200 + `access-control-allow-origin: http://localhost:3000` + credentials true.
  - `/api/runs?limit=2` envelope `{success, data: {items, total, limit, offset}}`.
  - `/api/portfolio` empty list `{items: [], total: 0}`.
  - `/api/share/badtoken` PUBLIC route 404 với CORS headers.
- Build artifact: `MswBootstrap` compiled với `enabled = "false" === "true"` — `.env.local` inline đúng.
- 8 app pages routes successfully prerender: Dashboard, top-mua, red-flags, stock-detail, price-board, news, portfolio, run-history, settings + `/share/[token]` dynamic ƒ + `/login` static.

## 6. Tồn đọng

- **`@/mocks/data/*` imports** — 7 components còn import static dictionary data. Pure constants, không runtime mock. Phase 10 hoặc post-MVP move sang `lib/constants/`.
- **TAD g02 §1 registry doc gap (carryover Phase 6):** chưa list `/runs/{id}/excluded` + `/stocks/{ticker}/runs` + `reason_text` rename. Cluster 7+ reconcile.
- **`reason_text` schema impact:** backend test_results.py không assert specific field — chỉ check `len == 4`. FE tests không có. Verified runtime via build success only.
- **Backtest progress UX downgrade:** từ % bar (cluster 5 prototype ~8.5s) → spinner (Phase 8 real ~1.2s). Acceptable; restore nếu thêm `progress_percent` column.
- **`run.run_at` không hiển thị trong SharedView:** backend không emit `created_at`; header hiển thị `Run: {run_id}` thay timestamp.
- **MSW handlers dev-only schema drift maintained nhưng prototype-only** — devs flipping `MSW=true` phải re-verify scenarios.
- **Stock Detail page chưa verify với real backend** — type check + build pass nhưng chưa interactive smoke. Phase 10 (Integration QA) cover end-to-end.
- **No FE unit tests** — chỉ tsc + build. Phase 10 nên thêm Playwright critical-path smoke.
- **`apiFetch` 401 redirect** skip nếu pathname === '/login' — không infinite loop, đã handled.
- **PDF Vietnamese fonts Docker:** Phase 10 test. Nếu broken → `EXPORT_PDF_MODE=html_mock`.
- **Interactive smoke chưa làm:** Phase 9 verify qua tsc + build + envelope curl + CORS preflight + compiled bundle. Click qua 8 pages thực tế Phase 10 sẽ làm.
