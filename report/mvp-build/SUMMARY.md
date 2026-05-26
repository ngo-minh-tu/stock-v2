# MVP Build Summary — VN Real Estate AI Screener

**Author:** Ngô Minh Tú · **Drafted:** 2026-05-11 · **Last updated:** 2026-05-24
**Phase scope:** 0 → 28 + post-Phase deferral closure (MVP core + Mốc 1+2+3+4 + Track 1+2+3+4+5+6) · **Source:** [plan/PLAN.md](../../plan/PLAN.md)
**Status:** ✅ Phase 0-28 đã đóng · Mốc 1+2+3+4 + Track 1-6 hoàn tất · Production deploy template ready (NOT live-deployed) — operator hand-off via ngrok

---

## 1. Ship state snapshot

| Layer | Artifact | Status |
|---|---|---|
| Backend | [mvp/code/](../../mvp/code/) FastAPI + SQLite + uv 0.11 | ✅ 311/311 pytest baseline · latest targeted deferral regression 55/55 · 39 endpoints · 0 known vulns |
| Frontend | [frontend/](../../frontend/) Next.js **16.2.6** App Router + next-intl 4.12.0 | ✅ tsc clean · Turbopack production build 14 routes pass · Playwright 8/8 · 0 critical vulns |
| DB | 16 tables · alembic 0001 initial schema · `prod-screener.db` real vnstock data | ✅ scored=17 · `vnstock_price=FRESH` (26/26) · `vnstock_financial=FRESH` (26/26) · NLG khớp CafeF |
| Infra | Dockerfile multi-stage uv + `docker-compose.yml` + `script/nginx.conf` + `docs/DEPLOY.md` | ✅ deploy template (Phase 27) — operator wires hosting + SSL |
| Scripts | `script/{run-frontend,run-backend,run-ngrok,backup-db,restore-db,cron-refresh,pre-handoff-refresh,e2e-start-backend}.sh` | ✅ Operator runbook ready |
| Docs | 28 phase SUMMARY + REVIEW + Vietnamese user-facing log + this report | ✅ Audit trail per phase |

**Acceptance:** All 17 SRS feature files covered. Critical drift = 0. Mốc 1+2+3+4 đóng thật trên `prod-screener.db`. FE Next 16 security upgrade cleared ngrok hand-off blocker.

---

## 2. Phase ledger

| # | Phase | Estimate / Actual | Critical artifacts |
|---|---|---|---|
| 0 | Bootstrap | 1d / 0.5d | `pyproject.toml`, `Dockerfile`, `app/main.py`, `.env.example` |
| 1 | DB + Constants + Seed | 1d / 0.5d | 16 tables, `constants/{enums,features,thresholds,reason_codes}.py`, `db/seed.py` |
| 2 | Auth + Settings | 0.5d / 0.5d | JWT login, password change, /settings GET+PUT, version bump |
| 3 | Refresh layer | 1.5d / 1d | vnstock client configurable rate-limit, source-level cache, async refresh job |
| 4 | Engines + Features + Risk | 2d / 2d | 4-round filter, 38 feature calc, baseline scoring + entry + risk |
| 5 | Screening Orchestrator | 1d / 1d | POST /run async, job_lock 409, lifecycle PENDING→COMPLETED |
| 6 | Read APIs | 1d / 1d | /runs/{id}/{results,dashboard,stocks/{t},excluded,compare/{b}}, /stocks, /news |
| 7 | Personal & History | 1d / 1d | Portfolio CRUD, DELETE /run/{id} cascade, /stocks/{t}/runs |
| 8 | Backtest + Export + Share + Telegram | 1.5d / 1.5d | 2-stage polling, WeasyPrint+html_mock, share token + public view, telegram test |
| 9 | FE swap | 0.5d / 0.5d | MSW gated, BASE_URL env, schema reconcile 7 surfaces |
| 10 | Integration QA | 1d / ~0.5d | AC checklist 17 SRS, full smoke, Bug-1 fix |
| 11 | README | 0.5d / ~1h | Root, backend, and frontend README handoff docs |
| 12 | Production Data QA | ~1d / ~1d | vnstock quota/SystemExit hardening, Phase 12 audit report |
| 13 | Demo Stability / DB Isolation | ~0.5d / ~0.5d | Test DB isolation, demo seed, report folder convention (**Mốc 1**) |
| 14 | Production Data Hardening | ~0.5d / ~0.5d | Refresh stats, partial commit, resume failed/empty, Quote API migration (**Mốc 2 prices code**) |
| 15 | Financial Data Ingestion | ~0.5d / ~0.5d | `fetch_financials()` thật, upsert `financial_reports`, financial cache/stats (**Mốc 2 BCTC code**) |
| 16 | MVP Data Readiness Closure | ~0.5d / ~0.5d | `_scale_vnd()` ×1000 boundary fix + `list_active_tickers()` MOCK filter; `vnstock_price=FRESH`; scored>0 (**Mốc 2 đóng thật**) |
| 17 | Financial Source Fallback | ~0.3d / ~0.3d | `Finance(source=VCI→KBS)` chain; per-sub-call gating; coverage 12→20 ticker (**Mốc 3 step 1**) |
| 18 | MVP Release Hardening | ~0.5d / ~0.5d | Per-sub-call rate-limit; `bulk_upsert` normalize; `env.production.example`; backup/restore/cron scripts; idna CVE fix; `vnstock_financial=FRESH` 26/26 (**Mốc 3 steps 2-7**) |
| 19 | Playwright Critical-Path Smoke | ~1d / ~1d | `tests/e2e/smoke.spec.ts` 8-path stateful journey; lộ + fix 4 production bug (dashboard schema, modal a11y, JSON i18n conflict, useExportPdf BASE_URL) (**Mốc 3 step 8**) |
| 20 | Telegram Real-Send Verify | ~0.3d / ~0.3d | `.env.telegram` gitignored chain-load; user confirm receive; pytest 257/257 (**Mốc 3 step 9**) |
| 21 | Financial Quality + No-Downgrade Upsert | ~0.5d / ~0.5d | KBS parser strip prefix + blocklist + skip NaN; COALESCE no-downgrade upsert; multi-source merge VCI+KBS; real NLG values populated (**Mốc 4 step 1**) |
| 22 | Financial Unit Scaling + Production Guards | ~0.4d / ~0.4d | VCI raw / KBS ×1000 source-aware scaling; `_enforce_production_secret_isolation()`; NLG revenue 1.279T VND khớp CafeF (**Mốc 4 step 2**) |
| 23 | Telegram Run-Summary Broadcast | ~0.4d / ~0.4d | `broadcast_run_summary` wired vào `screening_service` finalize; AC-14-01..04; 10-test `test_config_env_chain.py`; 288/288 pytest (**Track 2**) |
| 24 | FE Next 16 Security Upgrade | ~0.5d / ~0.5d | Next 14.2.15 → **16.2.6** + next-intl 4.12.0 + eslint 9; share/[token] async params; portfolio schema drift fix; 0 critical vulns (**Track 1 — BLOCKING ngrok cleared**) |
| 25 | Pre-Handoff UX Polish | ~0.7d / ~0.7d | FE schema `latest_price`→`latest` rename; HoldingFormModal TODAY runtime; 3 InfoBanner disclaimer; `script/pre-handoff-refresh.sh`; total_assets sanity guard; 294/294 (**Track 5**) |
| 26 | KBS Data Polish | ~0.5d / ~0.5d | bvps fallback `total_equity / shares_outstanding`; period suffix lock + collision log; `tests/fixtures/kbs_snapshot.py` 13-field golden; 299/299 (**Track 3**) |
| 27 | Deploy Polish + Equity Sanity Guard | ~0.6d / ~0.6d | `useExportPdf` magic-byte binary-safe; PriceBoard placeholder; `_warn_total_equity_range`; `docker-compose.yml` + `script/nginx.conf` + `docs/DEPLOY.md`; 304/304 (**Track 4 baseline**) |
| 28 | Polish Batch | ~0.6d / ~0.6d | `InfoBanner` dismiss + LocalStorage persist; Telegram 429 retry với `Retry-After`; `_warn_all_sanity_fields` consolidate; `_PRODUCTION_FORBIDDEN_FILES` frozenset; period suffix log DEBUG; `test_compare` flake fix; 311/311 (**Track 6**) |
| 28.1 | Post-Phase Deferral Closure | ~0.5d / ~0.5d | `macro_crawler.py` real-source best-effort + `news_rss` + `news_crawl_service`; backtest strict PRD §4.5 với VN-Index benchmark từ M05; Turbopack default (bỏ `--webpack`); targeted 55/55 |
| **Total** | | **~19.5d est / ~17d actual** | |

Mốc 1 (Phase 13) · Mốc 2 (Phase 14-16) · Mốc 3 (Phase 17-20) · Mốc 4 (Phase 21-22) đều đóng thật trên `prod-screener.db`. Track 1-6 đóng tại Phase 23-28. Post-Phase deferral closure (Phase 28.1) đóng 3 deferred items còn lại từ PLAN §6. Chi tiết Vietnamese user-facing log mỗi phase nằm ở [report/phase-mvp/](..).

---

## 3. 39 endpoints implemented (TAD g02 §1 registry)

### Auth (2)
- `POST /api/auth/login` · `PUT /api/auth/password` ✓ (Phase 10 fix)

### Settings (2)
- `GET /api/settings` · `PUT /api/settings`

### Health (2)
- `GET /api/health` · `GET /api/version`

### Refresh (3)
- `POST /api/refresh/all` · `POST /api/refresh/prices` · `GET /api/refresh/{id}/status`

### Screening (5)
- `POST /api/run` · `GET /api/runs` · `GET /api/runs/{id}` · `GET /api/runs/{id}/status` · `DELETE /api/run/{id}`

### Results (5)
- `GET /api/runs/{id}/results` · `/dashboard` · `/stocks/{t}` · `/excluded` · `/compare/{b}`

### Stocks (4)
- `GET /api/stocks` · `/stocks/{t}` · `/stocks/{t}/prices` · `/stocks/{t}/runs`

### Portfolio (4)
- `GET /api/portfolio` · `POST` · `PUT /{id}` · `DELETE /{id}`

### News (2)
- `GET /api/news` · `GET /api/news/sentiment/{ticker}`

### Backtest (4)
- `POST /api/backtest` · `/status` · `GET /{id}` · `/results`

### Export (1)
- `GET /api/export/pdf/{run_id}` (Content-Disposition attachment)

### Share (4)
- `POST /api/share` · `GET /api/share` (list, auth) · `GET /api/share/{token}` (**PUBLIC**) · `DELETE /api/share/{token}`

### Telegram (1)
- `POST /api/telegram/test`

**All endpoints return TAD g02 §6 envelope** `{success, data?, error?}`. DELETE returns 200 + body (NOT 204). 5xx wrapped via global `AppError` handler.

---

## 4. Drift register (consolidated across phases)

### A. Resolved within MVP

| # | Drift | Phase resolved | Resolution |
|---|---|---|---|
| 1 | `reason → reason_text` field for /excluded | 9 | Renamed backend emit field; FE accessor unchanged |
| 2 | `SharedViewResponse` shape (run vs data wrapper) | 9 | Adopted TAD shape `{token, run_id, expires_at, data:{summary,dashboard,top_mua}}` |
| 3 | Backtest `progress_percent` removed | 9 | FE shows spinner; backend has no progress column |
| 4 | `roi_curve.date` → `roi_curve.week` | 9 | TAD §8.6 explicit ISO week label |
| 5 | `actual_return_3m_pct` → `actual_return_3m` | 9 | TAD §8.6 canonical |
| 6 | `/runs/{id}/results` flatten to `{results,total}` | 9 | Excluded lives at separate `/excluded` endpoint |
| 7 | MSW gating inverted (opt-in) | 9 | `NEXT_PUBLIC_ENABLE_MSW='true'` explicit |
| 8 | `top_mua` full ScreeningResult shape | 9 | export_service `build_share_data` reuses `to_result_row` |
| 9 | **PUT /auth/password** `current_password` → `current` + drop `changed: true` | **10** | **FE adapted to backend (TAD g02 §9.5 canonical)** |

### B. Accepted MVP-scope (post-MVP backlog) — status updated 2026-05-24

| # | Drift | Status | Notes |
|---|---|---|---|
| 1 | `@/mocks/data/*` static reference imports (whitelist, badges, codes, fixtures) | ⏭ Deferred | Pure constants, not network mocks; FE imports compile fine. Still valid post-MVP cleanup. |
| 2 | AC-02-04 `feature_availability` as bitmask (no per-feature `imputed` flag) | ⏭ Deferred | MVP UI doesn't render per-feature imputation badge. Re-add when XGBoost ships. |
| 3 | No Pydantic enum on `theme/classic_mode/language` settings fields | ⏭ Deferred | Service validates; risk low for single-user MVP. |
| 4 | `shared_by` field dropped from SharedView | ⏭ Deferred | Single-user MVP — re-add if multi-user RBAC ships. |
| 5 | Backtest UX downgrade (spinner vs % bar) | ⏭ Deferred | Backtest ~2s — % bar low-value at current job size. |
| 6 | Stock Detail page interactive smoke pending | ✅ Resolved Phase 19 | Playwright 8-path smoke covers stock detail load via run flow. |
| 7 | Telegram real-send not verified end-to-end | ✅ Resolved Phase 20 | Bot token via `.env.telegram` gitignored; user-confirmed receive; Phase 23 broadcast wired vào run finalize; Phase 28 add 429 retry. |
| 8 | WeasyPrint font fidelity for Vietnamese | ⏭ Deferred | Visual diff test post-MVP. Phase 27 added `useExportPdf` magic-byte binary-safe. |
| 9 | No FE unit tests | ✅ Partial (Phase 19) | Critical-path Playwright pack ships 8/8; Vitest unit suite still deferred. |
| 10 | `screening_data` fixture state pollution on abort | ⏭ Deferred (rare) | Documented workaround in Phase 10. `test_compare_full_shape` flake fixed Phase 28. |

### C. Spec gaps (TAD g02 §1 doc not yet updated)

| # | Gap | Endpoint | Phase added |
|---|---|---|---|
| 1 | `GET /runs/{id}/excluded` not in TAD §1 registry | Red Flags page | Phase 6 (drift §1) |
| 2 | `GET /stocks/{ticker}/runs` not in TAD §1 registry | Stock Detail helper | Phase 6 |
| 3 | `reason_text` field in ExcludedItem schema | Phase 6+9 | Phase 9 §2 #8 — doc note pending |

→ TAD §1 registry update suggested as a single doc patch ("Phase 10 spec reconcile") post-MVP. Backend ships ahead of doc; functionally complete.

---

## 5. Out-of-MVP backlog (PRD/TAD intentional defers)

From [plan/PLAN.md §6](../../plan/PLAN.md):

**Still deferred (post-MVP / optional scale):**
- **XGBoost training pipeline + scoring_xgboost real** — baseline ships, ABC interface ready (`app/engines/scoring_xgboost.py` stub)
- **LSTM training + price_lstm real** — naive trend price_baseline ships (`app/engines/price_lstm.py` stub)
- **Sentiment ML pipeline real** — RSS/news crawler ships Phase 28.1; classifier remains rule-based (`app/services/sentiment_rule.py`)
- **Macro source expansion (SBV/GSO direct)** — World Bank + VN-Index via vnstock best-effort ships Phase 28.1; deeper historical depth + SBV/GSO direct scraping remains optional scale work
- **Multi-user, RBAC** — single-user MVP via 1 row in `user_profiles`
- **Frontend rebuild per TAD-only spec** — explicit DO-NOT (prototype approved)

**Closed during MVP build pack:**
- ✅ **News RSS crawler real** — Phase 28.1 (`crawlers/news_rss.py` + `news_sources.py` + `services/news_crawl_service.py`)
- ✅ **Macro crawler real-source best-effort** — Phase 28.1 (`crawlers/macro_crawler.py` + `repositories/macro_repo.py`)
- ✅ **Backtest strict PRD §4.5** — Phase 28.1 (`services/backtest_service.py` so với VN-Index benchmark từ M05)
- ✅ **Telegram real-send** — Phase 20 + 23 (broadcast on run finalize) + Phase 28 (429 retry)
- ✅ **FE Playwright critical-path smoke** — Phase 19 (8/8) + 4 production bug fix
- ✅ **FE Next 16 + Turbopack migration** — Phase 24 + Phase 28.1 (security CVE chain + Turbopack default)
- ✅ **Production deploy template** — Phase 27 (`docker-compose.yml` + `script/nginx.conf` + `docs/DEPLOY.md`)
- ✅ **Real production data** — Phase 16 (prices) + Phase 18 (BCTC) + Phase 22 (unit scaling NLG khớp CafeF)

---

## 6. Test inventory

**Baseline 311/311 pass** sau Phase 28; latest targeted deferral regression (Phase 28.1) 55/55 pass.

| Suite group | Count (approx) | Coverage |
|---|---|---|
| `tests/unit/` (engines + features + risk + scoring + entry + filters) | ~70 | 4 filter rounds, 38 features, scoring/entry/risk baseline |
| `tests/unit/test_cache_manager.py` | 13 | TTL + per-source fresh check + STUB fallback (Phase 16) |
| `tests/unit/test_job_lock.py` | 8 | asyncio Lock + 409 conflict |
| `tests/unit/test_vnstock_client.py` | 5+ | Wrapper boundary: prices + financials, SystemExit → VnstockUnavailable |
| `tests/unit/test_config_env_chain.py` | 10 | `.env` + `.env.telegram` chain-load precedence + cache_clear semantics (Phase 23) |
| `tests/unit/test_feature_sanity.py` | 6+ | `_warn_total_assets_range` + `_warn_total_equity_range` + consolidated `_warn_all_sanity_fields` (Phase 25 + 27 + 28) |
| `tests/unit/test_kbs_snapshot.py` | 5 | KBS golden 13-field snapshot regression (Phase 26) |
| `tests/unit/test_main_prod_guard.py` | 3+ | Production secret-file guard `_PRODUCTION_FORBIDDEN_FILES` frozenset extensible (Phase 22 + 28) |
| `tests/unit/test_news_rss.py` | — | RSS parser + source registry (Phase 28.1) |
| `tests/unit/test_telegram_broadcast.py` | 3+ | `broadcast_run_summary` compose + 429 retry với `Retry-After` (Phase 23 + 28) |
| `tests/integration/test_*` | ~190 | 20+ integration files end-to-end (auth, settings, refresh, db isolation, screening, results, stocks, portfolio, news, backtest, export, share, telegram, health, pragmas, seed, dashboard, compare, financial_repo, run_telegram_broadcast) |
| **Total** | **311** | All pass · 311/311 green baseline |

Run: `cd mvp/code && uv run pytest -q` · Targeted regression: `uv run pytest tests/unit/test_news_rss.py tests/unit/test_telegram_broadcast.py tests/integration/test_backtest.py tests/integration/test_refresh.py -q`

**FE E2E (Phase 19):** `cd frontend && CI=1 npx playwright test` → 8/8 pass trên Next 16.2.6 production build.

---

## 7. Operational notes

### Local dev startup
```bash
cd mvp/code
uv sync
cp env.demo.example .env
uv run python -m app.db.demo_seed
uv run uvicorn app.main:app --port 8000
# In separate terminal:
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_ENABLE_MSW=false" >> .env.local
npm run dev
# Login: ChangeMe123!
```

### Docker
```bash
cd mvp/code
docker build -t vn-re-screener .
docker run -p 8000:8000 -v $(pwd)/data:/app/data --env-file .env vn-re-screener
```

### Reset (clean smoke state if pytest aborted)
Documented in [mvp/phases/phase-10-integration-qa/SUMMARY.md §7](../../mvp/phases/phase-10-integration-qa/SUMMARY.md).

---

## 8. Ship-readiness checklist

- [x] 311 backend tests pass (baseline)
- [x] FE tsc clean + Turbopack production build 14 routes pass (Next 16.2.6)
- [x] Playwright critical-path 8/8 pass (Phase 19)
- [x] All 39 endpoints exercised via curl smoke + integration suite
- [x] CORS verified `localhost:3000` ↔ `localhost:8000`
- [x] Public route `/api/share/{token}` bypass auth verified
- [x] DELETE 200+envelope across portfolio + runs + share
- [x] Error envelope consistent (g01 + g02)
- [x] Password change schema reconciled (Phase 10 fix)
- [x] PDF download `Content-Disposition: attachment` + `application/pdf` MIME + binary-safe magic-byte detection (Phase 27)
- [x] Job lock 409 ERR-JOB-CONFLICT on concurrent jobs
- [x] Telegram empty-creds path returns `{sent:false, error}` envelope + real-send verified Phase 20 + broadcast wired Phase 23 + 429 retry Phase 28
- [x] Settings version bump on PUT
- [x] Validation errors typed `ERR-XX-XX` per SRS g01
- [x] **Phase 11 README.md** — root + backend + frontend docs complete (updated through Phase 28)
- [x] Phase 13 demo DB isolation — pytest uses `test-screener.db`, demo uses `demo-screener.db`, prod uses `prod-screener.db`
- [x] Production data Mốc 2: `vnstock_price=FRESH` (26/26) + `vnstock_financial=FRESH` (26/26) on `prod-screener.db`
- [x] Production data Mốc 4: real NLG values khớp CafeF (revenue 1.279T VND, total_assets 25.894T VND, eps 679 VND)
- [x] FE Next 16 security upgrade — 0 critical CVE (Phase 24)
- [x] Production deploy template — `docker-compose.yml` + `script/nginx.conf` + `docs/DEPLOY.md` (Phase 27)
- [x] Operator pre-handoff runbook — `script/pre-handoff-refresh.sh` (Phase 25)
- [x] Backtest strict PRD §4.5 — VN-Index benchmark từ M05 (Phase 28.1)
- [x] News RSS real-source crawler + rule-based sentiment (Phase 28.1)
- [x] Macro real-source crawler best-effort — World Bank + VN-Index via vnstock (Phase 28.1)
- [ ] Production live deploy — operator wires hosting + SSL + ngrok hand-off (NOT done by build pack)
- [ ] Trader feedback từ ngrok hand-off — pending operator deploy

---

## 9. Conclusion

MVP Phase 0-28 + post-Phase deferral closure (Phase 28.1) đã ship đầy đủ phạm vi đã triển khai:

- **Backend stable** — 311/311 pytest baseline · 39 endpoints stable · 0 known vulns
- **Frontend stable** — Next.js 16.2.6 + next-intl 4.12.0 · Turbopack build 14 routes · Playwright 8/8 · 0 critical vulns
- **Production data** — `prod-screener.db` scored=17 với real vnstock 26 RE ticker · NLG khớp CafeF qua Mốc 4 source-aware unit scaling
- **17 SRS feature files covered** — critical drift = 0
- **Mốc 1+2+3+4 + Track 1+2+3+4+5+6 đóng** trên thực data, không phải stub
- **Phase summaries hoàn chỉnh** — `mvp/phases/<phase>/{SUMMARY.md,REVIEW.md}` (engineering audit trail) + `report/phase-mvp/<phase>/SUMMARY.md` (Vietnamese user-facing log)
- **Production deploy template** ready (`docker-compose.yml` + nginx + `docs/DEPLOY.md`) — operator wires hosting + SSL
- **Pre-handoff runbook** ready (`script/pre-handoff-refresh.sh`) — operator chạy ~22 phút refresh trước khi ngrok hand-off

**Next:** operator deploy via Phase 27 template + `script/pre-handoff-refresh.sh` → ngrok hand-off → trader feedback → Phase 29+ optional polish (post-feedback hoặc post-deploy).

**Post-MVP roadmap còn lại:** XGBoost/LSTM training, sentiment ML classifier upgrade, macro source expansion (SBV/GSO direct + historical depth), multi-user RBAC — đều ABC-interface ready cho hoán đổi.

---

## 10. Report organization note

Từ 2026-05-18, report được tổ chức theo folder chủ đề. Hiện trạng (2026-05-24):

- `report/cluster-prompts/` — Cluster 1-6 (prototype)
- `report/mvp-build/SUMMARY.md` — file này
- `report/phase-mvp/phase-1-db-constants-seed/` … `phase-28-polish-batch/` — Vietnamese user-facing log cho tất cả 28 phase

Quy ước chi tiết nằm ở [report/README.md](../README.md). Audit trail engineering (`SUMMARY.md` 9-section + `REVIEW.md` Codex 2nd-opinion) song song ở `mvp/phases/<phase>/`. Report mới viết bằng tiếng Việt.

---

*— End of MVP Build Summary v2 (refreshed 2026-05-24 for Phase 0-28 closure + post-Phase deferral) —*
