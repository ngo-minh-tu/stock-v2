# Phase 7 — Personal & History (Portfolio CRUD)

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** chốt 4 endpoint Portfolio CRUD với 5-rule server-side `validateHolding`; `ticker` immutable trong PUT; `buy_price` lưu + trả ngàn đồng (KHÔNG convert, khác Phase 6).
**Trạng thái:** COMPLETED 2026-05-10

## 1. Việc đã làm

- Pre-code drift audit 6 mục:
  - Backend `today` anchor = `datetime.now(UTC).date()` thực, KHÔNG hardcode `MOCK_FIXTURE_TODAY` (frontend-only concern per SRS g03 §S).
  - `buy_price` ngàn đồng cả store + API — TAD g02 §8.2 + SRS f11 — KHÔNG convert. Test enforce.
  - AC-11-05 (lãi/lỗ): backend return raw rows; frontend compute derived qua join `/api/stocks` snapshot.
  - `STOP_LOSS_PCT` SRS f11 vs `STOP_LOSS_DEFAULT_PCT` thresholds — frontend-derived, không đụng.
  - Pydantic vs custom ERR-11-05 (date format): Pydantic `date` catch trước → 422 ERR-VALIDATION; acceptable.
  - Ticker case: `_ensure_ticker_whitelisted()` `strip().upper()`.
- 4 endpoint (`/api/portfolio` prefix):
  - `GET /api/portfolio` — list all DESC by `created_at` + total.
  - `POST /api/portfolio` — create với 5-rule validation (ticker → quantity → price → date order, first-fail).
  - `PUT /api/portfolio/{holding_id}` — partial update qty/buy_price/buy_date/notes; `ticker` immutable (schema không có field).
  - `DELETE /api/portfolio/{holding_id}` — 200+envelope `{id, deleted: true}` (TAD g02 §8.1).
- Repository `portfolio_repo`: list_all/get/create/update/delete; `now()` UTC naive (consistent DB schema không TZ-aware).
- Schemas: `PortfolioHoldingResponse` (8 fields, `from_attributes=True`), `PortfolioListResponse {items, total}`, `PortfolioCreateRequest` (5 fields), `PortfolioUpdateRequest` (4 optional, no ticker), `PortfolioDeleteResponse`.
- Service `portfolio_service`: list/create/update/delete + 4 `_ensure_*` validators (whitelist ticker, qty int>0 + bool guard `isinstance(qty, bool)`, price float>0 + NaN guard `v != v`, date ≤ today UTC). Raise `AppError(ERR-11-XX, http_status=400)`.
- API router: 4 endpoints với `CurrentUser` dep. POST → 201; khác → 200. `db.commit()` + `db.refresh()` trong API layer.
- 1 file integration test, +24 cases.

## 2. File đã thêm

- `mvp/code/app/repositories/portfolio_repo.py`
- `mvp/code/app/schemas/portfolio.py`
- `mvp/code/app/services/portfolio_service.py`
- `mvp/code/app/api/portfolio.py`
- `mvp/code/tests/integration/test_portfolio.py`

## 3. File đã sửa

- `mvp/code/app/api/__init__.py` — register `portfolio.router` cuối list (sau news).

## 4. Lệnh đã chạy

```bash
cd mvp/code
uv run pytest tests/integration/test_portfolio.py -v   # 24 pass
uv run pytest                                          # 198/198
uv run ruff check app tests                            # clean

# Smoke
uv run uvicorn app.main:app --port 8013 &
TOKEN=$(curl -sS -X POST http://127.0.0.1:8013/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl -sS -X POST http://127.0.0.1:8013/api/portfolio -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"VHM","quantity":1000,"buy_price":35.5,"buy_date":"2026-04-15","notes":"core"}'
curl -sS -X PUT http://127.0.0.1:8013/api/portfolio/1 -H "Authorization: Bearer $TOKEN" \
  -d '{"quantity":2000,"notes":"doubled"}'
curl -sS -X DELETE http://127.0.0.1:8013/api/portfolio/1 -H "Authorization: Bearer $TOKEN"

# Validation paths
curl -sS -X POST http://127.0.0.1:8013/api/portfolio -H "Authorization: Bearer $TOKEN" \
  -d '{"ticker":"ZZZZ","quantity":100,"buy_price":10,"buy_date":"2026-04-15"}'   # ERR-11-04
curl -sS -X POST http://127.0.0.1:8013/api/portfolio -H "Authorization: Bearer $TOKEN" \
  -d '{"ticker":"KDH","quantity":100,"buy_price":10,"buy_date":"2030-01-01"}'    # ERR-11-06
```

## 5. Kết quả

- Pytest: PASS — 198/198 (Phase 0-6: 174, Phase 7 mới: 24).
- Ruff: PASS.
- 4 endpoints cover SRS f11 UC-11-01 + AC-11-01..06 + TAD g02 §8.2:
  - AC-11-01 (CRUD) ✓
  - AC-11-02 (qty>0 int) ✓
  - AC-11-03 (price>0) ✓
  - AC-11-04 (whitelist + uppercase normalize) ✓
  - AC-11-05/06 — frontend-derived per TAD g02 §8.2
  - buy_date ≤ TODAY ✓
- DELETE 200+envelope verified.
- `buy_price` unit invariant: ngàn đồng cả store + API (no convert).

## 6. Tồn đọng

- **Pre-existing DB pollution (carryover Phase 6):** chạy full pytest có thể fail `UNIQUE constraint failed: financial_reports.ticker, financial_reports.period`. Workaround manual cleanup. Long-term fixture defensive try/finally.
- **2 background pytest collide:** lần test đầu launch 2 bg pytest đè nhau → DB partial state. Chạy 1 lần sau cleanup → 198/198 pass.
- **`updated_at` granularity 1 giây SQLite** → test assert `>=` thay vì `>`.
- **Pydantic strict-mode int** trên `quantity=10.5` → 422 (Pydantic v2 default reject decimal-int).
- **`Transaction` table reserved** — Post-MVP wire khi cần transaction history.
- **Portfolio không có `default_capital` integration:** SRS f15 settings đã có field từ Phase 2. FE consume cluster 5; backend Phase 7 không wire thêm.
- **Portfolio import/export bulk:** post-MVP.
