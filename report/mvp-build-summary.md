# MVP Build Summary — VN Real Estate AI Screener

**Author:** Ngô Minh Tú · **Drafted:** 2026-05-11
**Phase scope:** 0 → 10 (post-prototype build pack) · **Source:** [mvp/PLAN.md](../mvp/PLAN.md)
**Status:** ✅ Ready cho Phase 11 (README.md) + production handoff

---

## 1. Ship state snapshot

| Layer | Artifact | Status |
|---|---|---|
| Backend | [mvp/code/](../mvp/code/) FastAPI + SQLite + uv | ✅ 232/232 pytest pass · 41 endpoints stable |
| Frontend | [frontend/](../frontend/) Next.js 14 app router | ✅ tsc clean · 14 routes build · MSW opt-in fallback |
| DB | 16 tables · alembic 0001 initial schema | ✅ seeded 81 stocks + 150 news + 1 user + default settings |
| Infra | Dockerfile multi-stage uv | ✅ entrypoint.sh wires `alembic upgrade head` before uvicorn |
| Docs | 11 phase SUMMARY.md + this report | ✅ Audit trail per phase |

**Acceptance:** All 17 SRS feature files covered. Critical drift = 0. Acceptable drift documented per-phase §6 + below.

---

## 2. Phase ledger

| # | Phase | Estimate / Actual | Critical artifacts |
|---|---|---|---|
| 0 | Bootstrap | 1d / 0.5d | `pyproject.toml`, `Dockerfile`, `app/main.py`, `.env.example` |
| 1 | DB + Constants + Seed | 1d / 0.5d | 16 tables, `constants/{enums,features,thresholds,reason_codes}.py`, `db/seed.py` |
| 2 | Auth + Settings | 0.5d / 0.5d | JWT login, password change, /settings GET+PUT, version bump |
| 3 | Refresh layer | 1.5d / 1d | vnstock client 0.5s rate-limit, source-level cache, async refresh job |
| 4 | Engines + Features + Risk | 2d / 2d | 4-round filter, 38 feature calc, baseline scoring + entry + risk |
| 5 | Screening Orchestrator | 1d / 1d | POST /run async, job_lock 409, lifecycle PENDING→COMPLETED |
| 6 | Read APIs | 1d / 1d | /runs/{id}/{results,dashboard,stocks/{t},excluded,compare/{b}}, /stocks, /news |
| 7 | Personal & History | 1d / 1d | Portfolio CRUD, DELETE /run/{id} cascade, /stocks/{t}/runs |
| 8 | Backtest + Export + Share + Telegram | 1.5d / 1.5d | 2-stage polling, WeasyPrint+html_mock, share token + public view, telegram test |
| 9 | FE swap | 0.5d / 0.5d | MSW gated, BASE_URL env, schema reconcile 7 surfaces |
| 10 | Integration QA | 1d / ~0.5d | AC checklist 17 SRS, full smoke, Bug-1 fix |
| **Total** | | **~10.5d est / ~9d actual** | |

Phase 11 (README) chưa start — deferred theo PLAN convention.

---

## 3. 41 endpoints implemented (TAD g02 §1 registry)

### Auth (2)
- `POST /api/auth/login` · `PUT /api/auth/password` ✓ (Phase 10 fix)

### Settings (2)
- `GET /api/settings` · `PUT /api/settings`

### Health (2)
- `GET /api/health` · `GET /api/version`

### Refresh (3)
- `POST /api/refresh/all` · `POST /api/refresh/prices` · `GET /api/refresh/{id}/status`

### Screening (4)
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

### B. Accepted MVP-scope (post-MVP backlog)

| # | Drift | Rationale | Suggested fix |
|---|---|---|---|
| 1 | `@/mocks/data/*` static reference imports (whitelist, badges, codes, fixtures) | Pure constants, not network mocks; FE imports compile fine | Post-MVP: move to `lib/constants/*` for cleanliness |
| 2 | AC-02-04 `feature_availability` as bitmask (no per-feature `imputed` flag) | MVP UI doesn't render per-feature imputation badge | Add `feature_imputed: dict[str, bool]` if XGBoost stage needs it |
| 3 | No Pydantic enum on `theme/classic_mode/language` settings fields | Service validates; risk low for single-user MVP | Tighten to `Literal[...]` in Phase 12+ |
| 4 | `shared_by` field dropped from SharedView | Single-user MVP — owner identity always = Ngô Minh Tú | Re-add if multi-user RBAC ships |
| 5 | Backtest UX downgrade (spinner vs % bar) | Phase 8 backend has no progress column | Add `progress_percent` column + driver tick if backtest job grows past current ~2s |
| 6 | Stock Detail page interactive smoke pending | No browser automation harness | Post-MVP Playwright/Cypress smoke pack |
| 7 | Telegram real-send not verified end-to-end | No production bot token available | User must provide creds + verify in production setup |
| 8 | WeasyPrint font fidelity for Vietnamese | Docker image embeds Inter + Noto; rendered PDF visual not pixel-verified | Visual diff test post-MVP |
| 9 | No FE unit tests | Type/build suffices for MVP scope | Add Vitest + critical-path Playwright in Phase 12+ |
| 10 | `screening_data` fixture state pollution on abort | Cleanup happens in fixture teardown; interrupt skips it | Add session-scope autouse fixture pre-clean (Phase 11+) |

### C. Spec gaps (TAD g02 §1 doc not yet updated)

| # | Gap | Endpoint | Phase added |
|---|---|---|---|
| 1 | `GET /runs/{id}/excluded` not in TAD §1 registry | Red Flags page | Phase 6 (drift §1) |
| 2 | `GET /stocks/{ticker}/runs` not in TAD §1 registry | Stock Detail helper | Phase 6 |
| 3 | `reason_text` field in ExcludedItem schema | Phase 6+9 | Phase 9 §2 #8 — doc note pending |

→ TAD §1 registry update suggested as a single doc patch ("Phase 10 spec reconcile") post-MVP. Backend ships ahead of doc; functionally complete.

---

## 5. Out-of-MVP backlog (PRD/TAD intentional defers)

From [mvp/PLAN.md §6](../mvp/PLAN.md):

- **XGBoost training pipeline + scoring_xgboost real** — baseline ships, ABC interface ready
- **LSTM training + price_lstm real** — naive trend price_baseline ships
- **News RSS crawler + sentiment ML pipeline real** — fixture seed 150 articles in DB
- **Macro crawler real (SBV/GSO scraping)** — hardcoded constants
- **Backtest strict per PRD §4.5** — current mock heuristic on screening output
- **Multi-user, RBAC** — single-user MVP via 1 row in `user_profiles`
- **Frontend rebuild per TAD-only spec** — explicit DO-NOT (prototype approved)

---

## 6. Test inventory

| Suite | Count | Coverage |
|---|---|---|
| `tests/unit/test_filters.py` | 13 | 4 filter rounds + edge cases |
| `tests/unit/test_features.py` | 9 | 38 feature calc + normalization |
| `tests/unit/test_scoring.py` | 9 | Baseline weighted-sum + bounds |
| `tests/unit/test_entry.py` | 12 | Priority order + reason codes |
| `tests/unit/test_risk.py` | 23 | Stop loss, allocation, badges, conf penalty |
| `tests/unit/test_cache_manager.py` | 6 | TTL + per-source fresh check |
| `tests/unit/test_job_lock.py` | 8 | asyncio Lock + 409 conflict |
| `tests/unit/test_models.py` | 2 | Schema sanity |
| `tests/integration/test_*` | 150 | 17 router files end-to-end (auth, settings, refresh, screening, results, stocks, portfolio, news, backtest, export, share, telegram, health, pragmas, seed, dashboard, compare) |
| **Total** | **232** | All pass · 232/232 green |

Run: `cd mvp/code && uv run pytest -q`

---

## 7. Operational notes

### Local dev startup
```bash
cd mvp/code
uv sync
uv run alembic upgrade head
uv run python -m app.db.seed     # idempotent — re-run safe
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
Documented in [mvp/phases/phase-10-integration-qa/SUMMARY.md §7](../mvp/phases/phase-10-integration-qa/SUMMARY.md).

---

## 8. Ship-readiness checklist

- [x] 232 backend tests pass
- [x] FE tsc clean + build succeeds (14 routes)
- [x] All 41 endpoints exercised via curl smoke
- [x] CORS verified `localhost:3000` ↔ `localhost:8000`
- [x] Public route `/api/share/{token}` bypass auth verified
- [x] DELETE 200+envelope across portfolio + runs + share
- [x] Error envelope consistent (g01 + g02)
- [x] Password change schema reconciled (Phase 10 fix)
- [x] PDF download `Content-Disposition: attachment` + `application/pdf` MIME
- [x] Job lock 409 ERR-JOB-CONFLICT on concurrent jobs
- [x] Telegram empty-creds path returns `{sent:false, error}` envelope
- [x] Settings version bump on PUT
- [x] Validation errors typed `ERR-XX-XX` per SRS g01
- [ ] **Phase 11 README.md** — pending (per PLAN.md "build last" rule)
- [ ] Production deploy guide — out of MVP scope
- [ ] Telegram bot token + chat_id — user-provided

---

## 9. Conclusion

MVP backend Phase 0-9 đã ship đúng spec. Phase 10 Integration QA confirm:
- Backend stable (232/232 tests, all endpoints curl-verified)
- FE/BE contract reconciled (1 schema drift in PUT /auth/password found + fixed)
- 17 SRS feature files covered (critical drift = 0)
- Phase summaries hoàn chỉnh — audit trail per phase

Phase 11 (README, 0.5d) là deliverable cuối còn lại trước khi MVP đóng và sẵn sàng cho integration testing với production data + Telegram bot real credentials.

Post-MVP roadmap đã document: XGBoost/LSTM training, RSS crawler real, macro crawler real, FE Playwright smoke pack, multi-user RBAC.

---

*— End of MVP Build Summary —*
