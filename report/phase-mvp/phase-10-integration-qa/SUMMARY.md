# Phase 10 — Integration QA + Bug Fixes

**Ngày:** 2026-05-11
**Mục tiêu thực hiện:** end-to-end Integration QA cho MVP backend Phase 0-8 + FE Phase 9 — full pytest + tsc/build regression, AC checklist 17 SRS files, curl smoke critical paths, fix mọi drift / runtime issue phát hiện trong QA, viết `report/mvp-build/SUMMARY.md`.
**Trạng thái:** COMPLETED 2026-05-11

## 1. Việc đã làm

- Subagent-driven AC coverage audit 17 SRS files vs backend implementation:
  - 16 SRS file ✅ Full coverage (f01-f15, f17, g01-g03).
  - 1 drift: f16 Authentication — Bug-1 `PUT /api/auth/password` shape FE/BE mismatch.
- **Bug-1 FIXED Phase 10:** Backend `PasswordChangeRequest` chốt `{current, new_password}` (alias `new`); FE `lib/types.ts` expected `{current_password, new_password}` + response `{changed: true, token}`. Symptom: curl PUT FE-shape body → 422 ERR-VALIDATION. Phase 9 schema reconcile sweep miss endpoint này (lower-traffic; MSW prototype luôn accept any shape).
- Bug-1 fix scope (3 FE file, FE adapts BE per memory rule):
  - `lib/types.ts`: `current_password → current`; drop `changed: true` từ response.
  - `components/settings/PasswordChangeForm.tsx`: body shorthand `{current, new_password: next}`.
  - `mocks/handlers.ts`: MSW handler đọc `body.current`; response drop `changed: true`.
- End-to-end curl smoke với uvicorn :8000 + 5-anchor seed: 30+ flow verified (login → run → dashboard/results/stock detail/excluded/portfolio CRUD/backtest/share/PDF/telegram/refresh/compare/news).
- State pollution recovery: manual cleanup script (delete share_links → backtest_results → backtest_runs → screening_results → excluded_stocks → screening_runs → portfolio_holdings → financial_reports → stock_prices theo FK order) — 34 ERROR ban đầu = 1 root cause (fixture teardown skip khi abort) = 0 backend bug.
- `report/mvp-build/SUMMARY.md` deliverable: build-wide drift register + post-MVP backlog + ship-readiness checklist.
- Documented: state pollution mitigation, `theme/classic_mode/language` không Pydantic enum (acceptable service-layer validate), AC-02-04 aggregate `feature_availability` (per-feature imputation flag derived FE-side).

## 2. File đã thêm

- `report/mvp-build/SUMMARY.md` — build-wide summary.
- `mvp/phases/phase-10-integration-qa/SUMMARY.md` — audit trail phase 10.

## 3. File đã sửa

- `frontend/src/lib/types.ts` — `PasswordChangeRequest.current_password → current`; drop `changed: true`.
- `frontend/src/components/settings/PasswordChangeForm.tsx` — body shorthand.
- `frontend/src/mocks/handlers.ts` — MSW handler align new shape.

## 4. Lệnh đã chạy

```bash
# === Backend pytest (full suite) ===
cd mvp/code
uv run pytest -q                           # 232/232

# === Cleanup script (chạy khi pytest fail UNIQUE constraint) ===
uv run python -c "
from app.db.session import SessionLocal
from app.models.financial import FinancialReport
from app.models.stock import StockPrice
from app.models.run import ScreeningResult, ExcludedStock, ScreeningRun
from app.models.share import ShareLink
from app.models.backtest import BacktestRun, BacktestResult
from app.models.portfolio import PortfolioHolding
from sqlalchemy import delete
with SessionLocal() as db:
    db.execute(delete(ShareLink))
    db.execute(delete(BacktestResult)); db.execute(delete(BacktestRun))
    db.execute(delete(ScreeningResult)); db.execute(delete(ExcludedStock))
    db.execute(delete(ScreeningRun)); db.execute(delete(PortfolioHolding))
    db.execute(delete(FinancialReport)); db.execute(delete(StockPrice))
    db.commit()
"

# === FE type + build ===
cd frontend
npx tsc --noEmit       # clean
npm run build          # 14 routes

# === Smoke curl new schema ===
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS -X PUT http://127.0.0.1:8000/api/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"current":"ChangeMe123!","new_password":"NewPwd123!"}'
# Expect: {"success":true,"data":{"token":"..."}}
```

## 5. Kết quả

- Pytest: PASS — 232/232 (no regression vs Phase 9 baseline).
- `npx tsc --noEmit`: PASS, no errors.
- `npm run build`: PASS — 14 routes.
- End-to-end curl smoke verified:
  - POST /auth/login → 200 token; GET /health + /version OK.
  - POST /run 5-anchor → 202 PENDING → COMPLETED ~1s (5 scored, 76 excluded).
  - GET /runs/{id}/dashboard, results, stocks/VHM, excluded (verify `reason_text` field) OK.
  - Portfolio CRUD: POST 201 (ticker normalize uppercase), PUT 200 partial, DELETE 200+envelope. ERR-11-04 whitelist + ERR-11-02 qty=0 verified.
  - POST /backtest → 202 → COMPLETED ~2s; metrics + roi_curve `week` ISO + results `actual_return_3m` field (no `_pct`).
  - POST /share 7-day TTL → GET /share/{token} PUBLIC OK; DELETE 200+envelope.
  - POST /telegram/test empty creds → `{sent: false, error: "Telegram chưa cấu hình..."}`.
  - GET /export/pdf/{run_id} → 200 application/pdf 29KB, `file` reports valid PDF 1.7.
  - PUT /auth/password new schema → 200 fresh token; old shape → 422.
  - POST /refresh/prices + concurrent → 409 ERR-JOB-CONFLICT verified.
  - GET /runs/{id}/compare/{id} self → ERR-12-01.

## 6. Tồn đọng

- **State pollution from aborted tests:** `screening_data` fixture insert 16K rows; teardown skip khi Ctrl+C/TaskStop/OOM → next run UNIQUE constraint. Mitigation manual cleanup script; post-MVP add session-scope autouse fixture pre-clean.
- **No Pydantic enum on theme/classic_mode/language:** Settings schema accept arbitrary string; service layer validate. Acceptable; risk malformed value persist silently. Post-MVP tighten `Literal[...]`.
- **Backtest `extra="forbid"`** rejects wrong field names. FE uses correct schema; smoke OK.
- **AC-02-04 aggregate `feature_availability`** (count of present features) — per-feature `imputed: bool` not emitted. FE derives display từ feature value `null`/non-null.
- **Stock Detail interactive smoke** chưa run (carryover Phase 9 §6). Endpoint shape verified curl-level; FE compose pattern unchanged.
- **No FE unit tests / Playwright** — accepted post-MVP backlog (Phase 19 sẽ wire).
- **`@/mocks/data/*` static reference imports** — accepted, documented post-MVP backlog.
- **PDF Vietnamese fidelity visual** chưa diff (29KB binary check pass).
- **Telegram real-send chưa verify** — empty-creds path OK; user-provided creds Phase 20.
- **Backtest progress restore option:** thêm `progress_percent` column nếu UX cần.
- **TAD §1 endpoint registry doc patch:** 3 endpoint gap (Phase 6+9) — single doc patch post-MVP. Tracked `report/mvp-build/SUMMARY.md §4.C`.
- **Compare endpoint với 2 runs khác nhau** smoke chỉ test self-compare ERR-12-01. Integration test đã pass; curl manual chưa.
- **Refresh job lock 409 verified, ghost job on server restart chưa test** — TAD g05 logic có nhưng Phase 10 không test trực tiếp.
