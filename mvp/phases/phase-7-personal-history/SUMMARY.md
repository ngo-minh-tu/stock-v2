# Phase 7 — Personal & History (Portfolio CRUD)

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 1d / ~2h
**Spec ref:** [PLAN.md §3 row 7](../../PLAN.md), [SRS f11](../../../docs/srs/f11-portfolio-lite.md), [SRS g03 §S](../../../docs/srs/g03-appendix-enums-constants.md), [TAD g02 §1 + §8.1 + §8.2](../../../docs/tad/g02-api.md), [cluster-5-summary §3](../../../report/cluster-5-summary.md)

## 1. Scope

Phase 7 chốt **Portfolio CRUD backend** (4 endpoints). Run History list + DELETE /runs/{id} + Compare 4-section đã được Phase 5+6 deliver, KHÔNG re-implement ở đây.

**4 endpoints (prefix `/api/portfolio`):**

- `GET /api/portfolio` — list all holdings (DESC by `created_at`) + total
- `POST /api/portfolio` — create holding với 5-rule server-side `validateHolding` (mirror SRS f11 AC-11-02..06)
- `PUT /api/portfolio/{holding_id}` — partial update (qty/buy_price/buy_date/notes); `ticker` immutable per SRS f11 UC-11-02 edit mode
- `DELETE /api/portfolio/{holding_id}` — 200 + envelope `{id, deleted: true}` (TAD g02 §8.1)

**Đã có sẵn từ Phase trước (Phase 7 KHÔNG phải làm lại):**

- `DELETE /api/runs/{run_id}` 200+envelope — Phase 5 [screening.py:213-226](../../code/app/api/screening.py)
- `GET /api/runs/{a}/compare/{b}` 4-section — Phase 6 [results.py:102-117](../../code/app/api/results.py)
- `GET /api/runs` paginated với 12-field RunSummary — Phase 5 [screening.py:177-210](../../code/app/api/screening.py)

## 2. Pre-code spec audit (drift report)

| # | Drift / Gap | Resolution |
|---|---|---|
| 1 | **Backend `today` anchor**: SRS g03 §S `MOCK_FIXTURE_TODAY = '2026-05-07'` chỉ áp cho frontend prototype mock layer. Spec note rõ "Backend phase: thay bằng `datetime.now(UTC)` thực — frontend KHÔNG cần đổi". | ✅ `portfolio_service._today_utc()` dùng `datetime.now(UTC).date()` thực — KHÔNG hardcode `MOCK_FIXTURE_TODAY`. Test dùng `_today_str()/_yesterday_str()/_tomorrow_str()` helpers tương đối. |
| 2 | **buy_price unit drift potential**: TAD g02 §M cluster 4 chốt frontend nhận **ngàn đồng**. Phase 6 đã wire `_to_ngan_dong()` cho `current_price/target_price/...` (raw VND in DB → ngàn đồng tại API boundary). Portfolio thì khác: SRS f11 + TAD g02 §8.2 đều ghi `buy_price: number; // ngàn đồng` cả ở model **và** API. | ✅ Backend store + return y nguyên (không convert). Smoke verify: POST `buy_price=35.5` → DB `35.5` → GET `35.5`. Test `test_buy_price_unit_is_ngan_dong_not_raw` enforce. |
| 3 | **AC-11-05 (lãi/lỗ formula)**: SRS f11 yêu cầu `cost_basis/market_value/unrealized_pnl/stop_loss_price` đúng formula. TAD g02 §8.2 chốt: backend trả raw `PortfolioHolding`; frontend join với `/api/stocks` snapshot trong `useMemo` để build `HoldingRow`. | ✅ Backend KHÔNG compute derived fields. AC-11-05 verified ở frontend cluster 5 (test_portfolio.py document rõ "Backend chỉ trả raw rows; AC-11-05 không có backend assertion"). |
| 4 | **`STOP_LOSS_PCT = 0.10` ở SRS f11 §Derived vs `STOP_LOSS_DEFAULT_PCT = -0.10` ở [thresholds.py:29](../../code/app/constants/thresholds.py)** | n/a — `stop_loss_price` là frontend-derived (TAD g02 §8.2). Backend đã có constant đúng. KHÔNG đụng tới phase này. |
| 5 | **Pydantic vs custom error code mapping**: rule 5 (date format YYYY-MM-DD) Pydantic `date` validator catch trước khi vào service → 422 generic, không match ERR-11-05 ASCII string check ở SRS f11 rule 5. | ✅ Acceptable: Pydantic 422 ERR-VALIDATION cover invalid format; ERR-11-05 reserved nếu cần custom string parse downstream. Test `test_create_buy_date_invalid_format_returns_422` document trade-off. |
| 6 | **Ticker case sensitivity**: SRS f11 không nói rõ. FE prototype đã uppercase trong validateHolding. Backend nhận lowercase từ API (forgiving). | ✅ `_ensure_ticker_whitelisted()` `strip().upper()` trước khi `db.get(Stock, ...)`. Test `test_create_normalizes_ticker_uppercase` enforce. |

**Conventions locked:**

- **Server-side validation order**: ticker → quantity → price → date (matches client-side rule order trong SRS f11 §Client-side Validation table). Test mỗi rule fail trả đúng `ERR-11-XX` riêng.
- **Partial update**: PUT cho phép `quantity/buy_price/buy_date/notes` optional độc lập. Field nào omit thì giữ nguyên. `ticker` KHÔNG trong `PortfolioUpdateRequest` schema → ngăn user đổi mã (reuse SRS f11 UC-11-02 edit-mode disable rule).
- **List ordering**: `ORDER BY created_at DESC` — most recent first cho timeline UI. (FE cluster 5 sort default theo `pnl_pct DESC` nhưng đó là client-side sort sau khi join `/api/stocks`).
- **Envelope cho DELETE**: `{id: <holding_id>, deleted: true}` — match Phase 5 `delete_run` và Phase 6 cluster 6 share-delete pattern.

## 3. Deliverables

Tất cả path relative tới `mvp/code/`.

### Mới tạo
| Path | Nội dung |
|---|---|
| [app/repositories/portfolio_repo.py](../../code/app/repositories/portfolio_repo.py) | `list_all`, `get`, `create`, `update`, `delete`. `now()` UTC naive (consistent với DB schema không có TZ-aware columns) |
| [app/schemas/portfolio.py](../../code/app/schemas/portfolio.py) | `PortfolioHoldingResponse` (8 fields, `from_attributes=True`), `PortfolioListResponse` (`{items, total}`), `PortfolioCreateRequest` (5 fields), `PortfolioUpdateRequest` (4 fields, all optional), `PortfolioDeleteResponse` |
| [app/services/portfolio_service.py](../../code/app/services/portfolio_service.py) | `list_holdings`, `create_holding`, `update_holding`, `delete_holding` + 4 `_ensure_*` validators (whitelisted ticker, quantity int>0, price float>0 NaN-safe, date ≤ today UTC). Raises `AppError(ERR-11-XX, http_status=400)` |
| [app/api/portfolio.py](../../code/app/api/portfolio.py) | 4 endpoints với `CurrentUser` dependency. POST → 201, các endpoint khác → 200. `db.commit()` + `db.refresh()` trong API layer (Phase 6 pattern) |
| [tests/integration/test_portfolio.py](../../code/tests/integration/test_portfolio.py) | 24 cases: 4 auth, 6 CRUD lifecycle, 9 validation (qty/price/ticker/date), 2 not-found, 3 list shape/order/unit |

### Sửa
| Path | Thay đổi |
|---|---|
| [app/api/__init__.py](../../code/app/api/__init__.py) | + `from app.api import portfolio` + `router.include_router(portfolio.router)` (đặt cuối — sau news) |

### Tests mới (1 file integration, +24 cases)
| Path | Cases |
|---|---|
| [tests/integration/test_portfolio.py](../../code/tests/integration/test_portfolio.py) | **Auth (4):** list/create/update/delete đều 401 khi không token. **CRUD (6):** empty list, create+list, ticker uppercase normalize, partial update bumps `updated_at`, DELETE envelope, 2× not-found. **Validation (9):** qty=0/<0/decimal, price=0/<0, ticker not whitelist (ERR-11-04 + message contains ticker), buy_date future (ERR-11-06), buy_date today accepted, invalid format → 422, update qty=0 (ERR-11-02). **Shape (3):** list ordering DESC by `created_at`, response shape exact 8-key set (TAD §8.2), buy_price unit no /1000 conversion. |

## 4. Exit criteria — all PASS

- `uv run pytest` → **198/198 pass** (Phase 0-6: 174, Phase 7 mới: 24)
- `uv run ruff check app tests` → All checks passed
- 4 endpoints cover SRS f11 UC-11-01 AC-11-01..06 + TAD g02 §8.2:
  - AC-11-01 (CRUD) ✓ `test_list_*`, `test_create_*`, `test_update_*`, `test_delete_*`
  - AC-11-02 (qty>0 int) ✓ `test_create_quantity_zero/negative/decimal`, `test_update_quantity_zero`
  - AC-11-03 (price>0) ✓ `test_create_price_zero/negative`
  - AC-11-04 (whitelist) ✓ `test_create_ticker_not_in_whitelist`, normalize case
  - AC-11-05 (formula) — frontend-side per TAD g02 §8.2
  - AC-11-06 (stop_loss) — frontend-derived per TAD g02 §8.2
  - + buy_date ≤ TODAY (TAD g02 §8.2 step 5) ✓ `test_create_buy_date_future/today/invalid_format`
- DELETE returns 200 + envelope `{id, deleted: true}` (TAD g02 §8.1)
- buy_price unit invariant: ngàn đồng cả ở DB store + API in/out (no `_to_ngan_dong` conversion)
- Smoke uvicorn: 4 endpoints + 2 validation paths return đúng envelope/status code

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Backend `today` anchor | `datetime.now(UTC).date()` thực | SRS g03 §S note "Backend thay MOCK_FIXTURE_TODAY bằng datetime.now(UTC) thực" — fixed-anchor là frontend mock concern |
| `buy_price` unit | ngàn đồng cả store + API | TAD g02 §8.2 chốt rõ — KHÔNG convert (khác `current_price` Phase 6 raw→ngàn) |
| Backend response shape | Raw `PortfolioHolding` (8 fields) | TAD g02 §8.2: frontend join `/api/stocks` để build HoldingRow client-side. Backend không compute pnl/cost_basis |
| `ticker` immutable trong PUT | `PortfolioUpdateRequest` không có `ticker` field | SRS f11 UC-11-02 edit-mode disable rule mirror server |
| Validation order | ticker → quantity → price → date | Matches SRS f11 §Client-side Validation rule order — first-fail returned |
| List ordering | `ORDER BY created_at DESC` | Most recent first cho timeline UI; FE sort lại client-side theo `pnl_pct DESC` sau khi join |
| DELETE response | `{id, deleted: true}` 200 | Match Phase 5/6 pattern + TAD §8.1 |
| Quantity decimal | Pydantic 422 (KHÔNG ERR-11-02) | `int` field strict-mode reject 10.5 trước khi vào service. Test accept 400/422 cả hai phòng version drift |
| `_ensure_quantity` bool guard | `isinstance(qty, bool)` reject | `True == 1` trong Python — protect khỏi accidental `quantity: true` |
| `_ensure_price` NaN guard | `v != v` self-inequality | NaN không bị `<= 0` catch — explicit check |
| `db.refresh()` sau commit trong API | Yes | Pick up DB-side `created_at`/`updated_at` defaults (Numeric → float coercion) |
| `created_at`/`updated_at` set application-side | `datetime.now(UTC).replace(tzinfo=None)` | Model dùng `DateTime` (no TZ); explicit set thay vì rely on `server_default` để test không phải SELECT lại |

## 6. Issues / drift

- **Pre-existing DB pollution (Phase 6 §6 carryover)**: chạy full pytest lần đầu sau quá trình development có thể fail với `IntegrityError: UNIQUE constraint failed: financial_reports.ticker, financial_reports.period`. Nguyên nhân: dev DB shared, fixture `screening_data` không cleanup defensive trước insert. Workaround: chạy manual cleanup script trước full run. Long-term fix (Phase 8+): bọc fixture với `try/finally` + insert defensive `delete()` trước seed. KHÔNG phải bug Phase 7.
- **2 background pytest collide test**: lần test đầu launch 2 bg pytest đè nhau → DB partial state. Fix: chạy 1 lần duy nhất sau cleanup. Sau đó 198/198 pass clean.
- **`updated_at` granularity**: test `test_update_modifies_fields_and_bumps_updated_at` assert `>=` thay vì `>`. SQLite DATETIME granularity 1 giây có thể equal nếu update trong cùng giây. Acceptable cho test stability.
- **`Numeric` → float coercion**: SQLAlchemy trả `Decimal` cho `Numeric` columns. Pydantic `float` field coerce. Test verify `35.5` round-trip không loss.
- **Pydantic strict-mode `int` on `quantity=10.5`**: Pydantic v2 default coerce `10.5 → 10` cho `int` field nếu không strict. Test accept `400 hoặc 422` cho phòng hờ; thực tế observed 422 (Pydantic v2 reject decimal-int conversion bằng default).
- **`Transaction` table reserved**: model có sẵn từ Phase 1 nhưng không endpoint nào touch. Post-MVP per TAD g03 — Phase 7 KHÔNG implement.
- **Portfolio không có `default_capital` integration**: SRS f15 settings có `default_capital`, FE prototype dùng để pre-fill RunButton. Backend Phase 7 không làm extra wiring — `default_capital` đã có trong settings từ Phase 2 + GET/PUT settings từ Phase 2.

## 7. Test commands (reproducible)

```bash
cd mvp/code

# Phase 7 only
uv run pytest tests/integration/test_portfolio.py -v   # 24 pass

# Full suite (phase 0-7)
uv run pytest                                          # 198 pass

# Lint
uv run ruff check app tests                            # All checks passed

# Smoke với uvicorn
uv run uvicorn app.main:app --port 8013 &
TOKEN=$(curl -sS -X POST http://127.0.0.1:8013/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# CRUD lifecycle
curl -sS http://127.0.0.1:8013/api/portfolio -H "Authorization: Bearer $TOKEN"
curl -sS -X POST http://127.0.0.1:8013/api/portfolio -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"VHM","quantity":1000,"buy_price":35.5,"buy_date":"2026-04-15","notes":"core"}'
curl -sS -X PUT http://127.0.0.1:8013/api/portfolio/1 -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"quantity":2000,"notes":"doubled"}'
curl -sS -X DELETE http://127.0.0.1:8013/api/portfolio/1 -H "Authorization: Bearer $TOKEN"

# Validation paths
curl -sS -X POST http://127.0.0.1:8013/api/portfolio -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"ZZZZ","quantity":100,"buy_price":10,"buy_date":"2026-04-15"}'   # ERR-11-04
curl -sS -X POST http://127.0.0.1:8013/api/portfolio -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"KDH","quantity":100,"buy_price":10,"buy_date":"2030-01-01"}'    # ERR-11-06
```

## 8. Hand-off cho Phase 8

Phase 8 (Backtest + Export + Share + Telegram) sẽ wire:

- **Backtest**: POST /backtest 202 + 2-stage polling (status → metrics + results) — TAD g02 §8.5 1.5s interval
- **Export**: GET /export/pdf/{run_id} binary download với `Content-Disposition: attachment` — WeasyPrint render
- **Share**: POST/GET/GET-token/DELETE /share — public route `/share/{token}` no-auth, 7-day TTL UUID v4
- **Telegram**: POST /telegram/test (mock httpx + format validation)

Đã sẵn sàng:
- DELETE 200+envelope pattern ✓ (Phase 5+6+7 đã chốt)
- ApiSuccess[T] envelope pattern ✓
- AppError(ERR-XX-XX, http_status, message) → JSONResponse handler ✓ (Phase 0)
- CurrentUser dependency ✓
- Job lock (asyncio Lock + active_id/type tracking) ✓ (Phase 5)

⚠️ **Phase 8 phải audit**:
- `BacktestRun` + `BacktestResult` model đã có chưa? (Phase 1 model list có — verify FK constraints)
- `ShareLink` model có `token`/`run_id`/`expires_at`/`created_at`? Public route group `(public)` chưa có trong app/api
- `EXPORT_PDF_MODE=weasyprint|html_mock` env var đã có trong [config.py](../../code/app/config.py)?
- WeasyPrint Vietnamese font embed (Inter + Noto Sans) — Dockerfile cần update Phase 0+
- Telegram bot token env var format validation rules

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 7 sau khi phase đã đóng)*
