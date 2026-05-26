# Phase 12 — Production Data QA REVIEW

**Started:** 2026-05-17
**Closed:** 2026-05-18
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

## Review Focus

This phase intentionally starts with verification and production-data smoke rather than feature expansion. The first real vnstock touch found a runtime behavior that tests had not modeled: quota handling can raise `SystemExit`, not a normal `Exception`.

## Findings

- `uv run pytest -q` and `npm run build` both pass from the current workspace.
- MVP build summary had stale text saying Phase 11 README was pending; that is now corrected.
- Real `refresh/prices` reached vnstock, but guest quota is stricter than the previous `0.5s` default.
- The old vnstock API path is now noisy and deprecated; it still works enough to expose quota behavior, but should be migrated before production reliance.
- The refresh job now has a regression test proving `SystemExit` does not leave `job_lock.active_job` stuck.

## To Revisit

- Decide whether the default `6.5s` delay is acceptable for first production refresh, or whether to require vnstock API credentials before full production-data QA.
- Review official vnstock 4.x migration docs before changing the client API shape.
- Consider persisting refresh job status if production refresh will take several minutes.

## Close-Out

Closed after external review fixes were incorporated:

- Drift docs synced to Phase 0-11 and 2026-05-17/18 state.
- Wrapper unit tests added for `SystemExit`, generic exception, and `KeyboardInterrupt`.
- `VnstockClient` catch boundary clarified to `except (Exception, SystemExit)`.
- Final targeted verify: `uv run pytest -q tests/unit/test_vnstock_client.py tests/integration/test_refresh.py` → 12/12 PASS.
