# Phase 12 — Production Data QA

**Status:** COMPLETED 2026-05-18 — local smoke + first production-data finding handled
**Started:** 2026-05-17
**Spec ref:** Post-MVP handoff from [Phase 11](../phase-11-readme/SUMMARY.md) and [MVP build summary](../../../report/mvp-build/SUMMARY.md).

## 1. Scope

Phase 12 started and closed the first production-data QA lane after MVP close:

- Re-run backend and frontend verification from the current workspace.
- Sync the MVP build summary so Phase 11 README is no longer marked pending.
- Exercise local runtime smoke against real FastAPI + SQLite.
- Touch vnstock refresh against the real library and record production-data blockers.
- Create a standalone implementation/audit report.

## 2. Verification Run

| Check | Command / Surface | Result |
|---|---|---|
| Backend full suite | `cd mvp/code && uv run pytest -q` | PASS — 247/247 (after wrapper unit tests added) |
| Backend refresh regression | `uv run pytest tests/integration/test_refresh.py -q` | PASS — 9/9 |
| VnstockClient wrapper unit | `uv run pytest tests/unit/test_vnstock_client.py -q` | PASS — 3/3 (SystemExit/Exception/KeyboardInterrupt boundary) |
| Backend lint | `uv run ruff check app/ tests/` | PASS |
| Frontend build | `cd frontend && npm run build` | PASS — 15 generated app pages |
| Migration | `uv run alembic upgrade head` | PASS — idempotent |
| Seed | `uv run python -m app.db.seed` | PASS — existing seed skipped |
| Health | `GET /api/health` | PASS |
| Version | `GET /api/version` | PASS |
| Login | `POST /api/auth/login` | PASS |
| Screening run | `POST /api/run` + status poll | PASS — `COMPLETED_WITH_WARNINGS` |
| Dashboard/results | `/runs/{id}/dashboard`, `/results` | PASS envelope; current local DB returned 0 scored rows |
| Telegram empty creds | `POST /api/telegram/test` | PASS expected disabled response |
| vnstock prices refresh | `POST /api/refresh/prices` | Found quota/runtime issue; fixed defensive handling |

## 3. Production-Data Finding

`POST /api/refresh/prices` reached the real vnstock library and exposed two production-runtime issues:

- Project was configured with `VNSTOCK_RATE_LIMIT_S=0.5`, but observed guest quota is 20 requests/minute.
- vnstock quota path can call `sys.exit()`, raising `SystemExit`; this bypassed normal `Exception` handling in the background task and logged an ASGI exception.

Fix applied:

- Default `VNSTOCK_RATE_LIMIT_S` changed to `6.5` in config and `.env.example`.
- `VnstockClient.fetch_prices()` now converts recoverable external `SystemExit` into `VnstockUnavailable`.
- `refresh_service` now guards background refresh jobs so recoverable external aborts reach terminal `FAILED` status and release the global job lock.
- Added regression test `test_refresh_prices_recovers_when_vnstock_calls_system_exit`.

## 4. Files Changed

- [report/mvp-build/SUMMARY.md](../../../report/mvp-build/SUMMARY.md) — Phase 11 marked complete, test count updated to 247.
- [mvp/README.md](../../README.md) — vnstock rate-limit and test count updated.
- [mvp/code/.env.example](../../code/.env.example) — `VNSTOCK_RATE_LIMIT_S=6.5`.
- [mvp/code/app/config.py](../../code/app/config.py) — default `vnstock_rate_limit_s=6.5`.
- [mvp/code/app/crawlers/vnstock_client.py](../../code/app/crawlers/vnstock_client.py) — catch vnstock `SystemExit` quota path.
- [mvp/code/app/services/refresh_service.py](../../code/app/services/refresh_service.py) — terminal failure + lock release guard for recoverable external aborts.
- [mvp/code/tests/integration/test_refresh.py](../../code/tests/integration/test_refresh.py) — regression coverage at service level.
- [mvp/code/tests/unit/test_vnstock_client.py](../../code/tests/unit/test_vnstock_client.py) — wrapper unit tests covering SystemExit / RuntimeError / KeyboardInterrupt paths.
- [report/phase-mvp/phase-12-production-data-qa/IMPLEMENTATION.md](../../../report/phase-mvp/phase-12-production-data-qa/IMPLEMENTATION.md) — implementation/audit report.

## 5. Open Items

- Full 81-ticker real refresh was not completed after the rate-limit fix because the conservative guest-safe delay makes the job intentionally slow.
- Current vnstock logs show the installed library is `4.0.2` and `4.0.3` is available.
- vnstock logs also warn the old `Vnstock().stock(...)` API is deprecated; migration to `vnstock.api.quote.Quote` should be reviewed as the next production hardening task.
- Telegram real-send remains unverified until bot token and chat ID are provided.
- Local smoke run completed with 0 scored results because the current SQLite state still lacks enough usable refreshed price/financial data for screening output.

## 6. Next Recommended Work

1. Migrate `VnstockClient.fetch_prices()` from deprecated `Vnstock().stock(...)` to the current `vnstock.api.quote.Quote` API after checking official vnstock docs.
2. Add resumable/partial refresh behavior so rate-limit failures keep successful ticker rows and expose partial completion stats.
3. Run full production-data refresh with either a vnstock API key or the conservative 6.5s delay, then re-run screening and UI smoke.
4. Verify Telegram with real credentials.
5. Add Playwright smoke for login → refresh/run → dashboard → results → share/export.

## 7. Close-Out

Phase 12 is closed with code, docs, regression coverage, and external review follow-up incorporated. Remaining items are intentionally carried forward as production hardening work, not blockers for this phase.
