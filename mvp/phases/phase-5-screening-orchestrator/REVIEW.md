# Phase 5 — Screening Orchestrator REVIEW

**Done:** ~2026-05-10 (~4h, estimate 1d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: TestClient BG semantics, Decimal coercion bug, allocation timing, cascade DELETE app-level.

## Surprises / non-obvious

- **TestClient await BG semantics**: `client.post('/api/run')` → BG task COMPLETED **before response returns** trong sync TestClient. Tests trực tiếp check `status == 'COMPLETED'` sau POST, KHÔNG polling. Production uvicorn KHÁC — BG truly async. Bị nhầm 1 lần khi test compare flaky.
- **Decimal/Decimal float coercion**: Feature pipeline read `Numeric` column → Decimal. Math operations giữa Decimal/float fail or return wrong type. Fix universal: `float(row.target_price_3m)` ngay khi load. `_safe_div` cast cả 2 args.
- **Allocation TRƯỚC bulk_insert**: chạy allocation trên `scored[]` in-memory rồi insert ROW có `allocation_amount`. Nếu insert trước → 2 round-trip DB (insert without alloc → update with alloc). Pattern này quan trọng cho performance khi 70+ tickers.
- **Cascade DELETE app-level**: schema chưa wire `ON DELETE CASCADE` foreign key. `delete_run` → `results_repo.delete_by_run(...)` + `excluded_repo.delete_by_run(...)` + `screening_repo.delete_run(...)` theo thứ tự. Quên 1 step = orphan rows. Phase 10 audit.
- **`avg_score` computed at query time**: Phase 5 KHÔNG persist avg_score vào DB column → Phase 6 GET /runs query mỗi run + compute `mean(ai_score)` trên results. O(N×M) khi list. Acceptable cho MVP (FE pagination limit 10).

## Key decisions (why)

- **MODEL_VERSION = `"baseline_v2"` hardcoded**: cluster 5 spec. XGBoost = `v3` khi train ready, bump trong `screening_service.MODEL_VERSION` constant.
- **State machine progress phân khúc**:
  - PENDING 5% (DB row created, BG task pending)
  - CHECKING_DATA 5% (cache freshness check)
  - SCREENING 15% (4-round filter)
  - SCORING 30-95% (38 features × N tickers loop)
  - terminal 100% (COMPLETED | COMPLETED_WITH_WARNINGS | FAILED)
  - FE polling 2s tick smooth.
- **Bulk insert ScreeningResult**: 70+ rows mỗi run. Single transaction commit. Job lock đảm bảo 1 run/time, không concurrent insert collision.
- **`warnings_json` array stored as JSON string**: Phase 6 parse `json.loads(row.warnings_json) if row.warnings_json else []`. Avoid join table cho list nhỏ.

## To revisit

- `avg_score` persisted column: thêm vào schema sẽ tránh O(N×M) query Phase 6 list. Phase 10 hoặc post-MVP.
- Server restart ghost jobs: hiện không handle. PROCESSING run > timeout mark FAILED — code chưa wire (TAD g05).
- Allocation strategy `skip_allocation` flag: dev tool. UI checkbox post-MVP nếu user muốn screening pure score (no portfolio sizing).
- Backtest needs `latest_completed()` baseline run — Phase 8 đã wire qua `screening_repo.latest_completed()`.
