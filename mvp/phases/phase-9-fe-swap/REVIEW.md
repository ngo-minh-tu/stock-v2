# Phase 9 — FE Swap MSW → Real Backend REVIEW

**Done:** 2026-05-11 (~2.5h, estimate 0.5d — over-run vì 8 schema drift FE↔backend tích lũy từ cluster prototype phase)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: 8 schema drift là kết quả của MSW làm source-of-truth cluster 5/6, không phải thiếu sót backend. MSW gate inversion. Verify nhưng chưa interactive smoke.

## Surprises / non-obvious

- **8 schema drift FE↔backend** từ cluster prototype phase — KHÔNG là thiếu sót Phase 0-8 mà là tích lũy mismatch khi MSW là source of truth cluster 5/6:
  1. `SharedViewResponse`: FE `{link, shared_by, run: {summary, dashboard, results}}` vs backend `{token, run_id, expires_at, data: {summary, dashboard, top_mua}}`. KHÔNG `shared_by` (single-user MVP).
  2. `BacktestStatusResponse`: FE `{progress_percent, current_step}` vs backend `{started_at, completed_at}` only. Backend schema không có progress columns.
  3. `BacktestMetrics.roi_curve[].week` chứ KHÔNG `.date` — TAD g02 §8.6 ISO label.
  4. `BacktestResultRow`: drop `name`, rename `actual_return_3m_pct → actual_return_3m`.
  5. `BacktestResultsResponse`: chỉ `{results}`, không top-level `backtest_id`.
  6. `RunResultsResponse`: backend `{results, total}` only. Excluded ở separate `/api/runs/{id}/excluded` endpoint (Phase 6 drift #1).
  7. Excluded field rename backend `reason → reason_text` để match FE accessor (cluster 6 convention).
  8. `top_mua` shape: backend `_top_mua_rows` 9-field subset KHÔNG đủ cho TopMuaTable (cần `recommendation/warning_badges/reasons/radar/confidence_raw`). Backend chuyển sang reuse `results_service.to_result_row` filter rec=MUA top 10 → full ScreeningResult shape.
- **MSW gate inversion**: prototype default `NODE_ENV==='development' || ENABLE_MSW==='1'` → MSW luôn enable trong dev. Phase 9 separate origins (FE :3000, BE :8000) → MSW would over-intercept same-origin paths. Inverted to opt-in only `NEXT_PUBLIC_ENABLE_MSW === 'true'`.
- **Static reference data imports KEEP `@/mocks/data/*`**: 7 components import `STOCK_FIXTURE`, `WARNING_BADGE_META`, `feature-dict`, `reason-codes`, `FIXTURE_NOW_MS`. Là pure constants, KHÔNG API mocks. Acceptable drift — post-MVP move sang `lib/constants/`.
- **Build compiled `enabled = "false" === "true"`**: Next.js inline `process.env.NEXT_PUBLIC_ENABLE_MSW` at build time. Compiled bundle inspection xác nhận env vars correctly baked in — verification trick mới.
- **Backtest progress UX downgrade**: cluster 5 prototype % bar (5→25→55→80%) cho 8.5s mock → Phase 8 simple spinner cho 1.2s real BG. Acceptable trade-off — restore nếu thêm DB column later.
- **MSW handlers phải update đồng bộ** để typescript pass: prototype mode opt-in vẫn cần compile. Phase 9 update [handlers.ts](../../../frontend/src/mocks/handlers.ts) + [backtest-store.ts](../../../frontend/src/mocks/data/backtest-store.ts) match new types.

## Key decisions (why)

- **Schema canonical = backend (TAD g02)**: FE adapts. Trade-off: FE refactor effort > backend doc gap. Long-term cleaner.
- **Backend rename `reason → reason_text`**: 1 line diff vs FE component update. Cheaper. Phase 6 SUMMARY §2 documents.
- **Backend `build_share_data` reuse `to_result_row`**: tránh duplicate field mapping. SharedView TopMuaTable render identical to authenticated Top MUA page.
- **`shared_by` DROP từ FE thay vì add vào backend**: single-user MVP. Backend không track owner — KHÔNG add field placeholder.
- **`relativeExpiry` countdown dùng `expires_at` only**: backend không emit `created_at` trong GET /share/{token} — Phase 9 SharedView omit created_at date display.
- **CORS verified working**: backend [main.py:18](../../code/app/main.py) `allow_origins=[settings.frontend_origin]` default `http://localhost:3000`. Preflight returns `access-control-allow-origin: http://localhost:3000` + credentials true.

## To revisit

- **Interactive smoke chưa làm**: Phase 9 verify qua `tsc + build + envelope curl + CORS preflight + compiled bundle inspection`. CHƯA click qua 8 pages thực tế trong browser. Phase 10 sẽ làm.
- **Stock Detail page**: type check pass nhưng cần real screening data để render. Phase 10 manual test với synthetic data.
- **MSW handlers schema drift maintained nhưng prototype-only**: devs flipping `MSW=true` cho demo offline phải re-verify scenarios. Production never hits MSW.
- **No FE unit tests**: chỉ tsc + build. Phase 10 nên thêm Playwright critical-path smoke (login → run → dashboard → portfolio CRUD → backtest → share → PDF download).
- **TAD g02 §1 registry doc gap** (carryover Phase 6): chưa list `/runs/{id}/excluded` + `/stocks/{ticker}/runs`. Phase 9 thêm rename `reason_text` cũng cần cluster reconcile.
- **PDF Vietnamese fonts**: Phase 10 Docker test. Nếu broken → `EXPORT_PDF_MODE=html_mock`.
- **`apiFetch` 401 redirect skip nếu đã ở `/login`**: handled. Tested không infinite loop.
- **Phase 10 hand-off**: user sẽ chạy tiếp Phase 10 trong tab khác. Tài liệu sẵn ở memory `project_mvp_backend.md` §Phase 10 hand-off.
