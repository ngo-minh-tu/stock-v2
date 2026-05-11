# Phase 7 — Portfolio CRUD REVIEW

**Done:** ~2026-05-10 (~2h, estimate 1d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: `buy_price` unit invariant khác Phase 6, validation order, ticker immutable schema-level.

## Surprises / non-obvious

- **`buy_price` ngàn đồng KHÔNG convert** — khác Phase 6 `current_price` (raw VND ÷ 1000 = ngàn đồng at API boundary). TAD g02 §8.2 + SRS f11 chốt `buy_price` là ngàn đồng cả model lẫn API → backend store + return y nguyên. Phase 9 fixed test invariant. Dễ miss vì Phase 6 đã thiết lập convention "÷ 1000 at API boundary" — Portfolio break quy tắc đó.
- **Backend `today` anchor = `datetime.now(UTC).date()` thực**: SRS g03 §S note rõ "Backend phase: thay MOCK_FIXTURE_TODAY bằng datetime.now(UTC) thực — frontend KHÔNG cần đổi". Phase 7 không hardcode `2026-05-07`. FE prototype mock dùng anchor cố định; backend dùng real today.
- **Backend return raw rows, FE compute derived**: TAD §8.2. Backend KHÔNG compute `current_price/cost_basis/market_value/unrealized_pnl`. FE join với `/api/stocks` snapshot trong `useMemo`. AC-11-05/06 verify frontend-side, no backend test.
- **`ticker` immutable trong PUT**: SRS f11 UC-11-02 edit mode disables ticker input. Backend enforce qua `PortfolioUpdateRequest` schema — KHÔNG có `ticker` field. Schema-level guard, không cần service check. Pattern hay: dùng schema constraints thay vì logic guard.
- **`_ensure_quantity` bool guard**: `True == 1` trong Python. `isinstance(quantity, bool)` reject explicit để tránh accidental `{quantity: true}` lọt qua int check.
- **`_ensure_price` NaN guard**: `v != v` self-inequality. NaN không bị `v <= 0` catch — phải check riêng.
- **Pydantic strict-mode reject decimal int**: `{quantity: 10.5}` → 422 ERR-VALIDATION (NOT ERR-11-02). Test accept cả 400/422 phòng version drift.
- **`updated_at` granularity 1 giây**: SQLite DATETIME. Test `>=` thay `>` — update trong cùng giây = equal acceptable.

## Key decisions (why)

- **Validation order**: ticker → quantity → price → date. Match SRS f11 §Client-side rule order. First-fail return — UX user thấy error đầu tiên rồi fix dần.
- **List ordering DESC by `created_at`**: most recent first cho timeline UI. FE sort lại client-side theo `pnl_pct DESC` sau khi join với /api/stocks.
- **DELETE 200+envelope** `{id, deleted: true}`: match Phase 5/6 pattern + TAD §8.1 rationale.
- **`created_at/updated_at` set application-side** thay vì `server_default`: KHÔNG cần SELECT lại sau insert. Explicit `datetime.now(UTC).replace(tzinfo=None)` vì model dùng `DateTime` (no TZ).
- **`db.refresh()` sau commit trong API layer**: pick up Numeric → float coercion + DB-side fields.

## To revisit

- `STOP_LOSS_PCT=0.10` SRS f11 vs `STOP_LOSS_DEFAULT_PCT=-0.10` thresholds.py — frontend-derived field, backend chỉ store. KHÔNG đụng.
- `Transaction` table reserved (Phase 1 model) — KHÔNG endpoint dùng. Post-MVP wire khi cần transaction history (buy/sell log).
- Portfolio import/export bulk: post-MVP. Hiện chỉ CRUD single row.
- Settings `default_capital` integration: SRS f15 + Phase 2 endpoint đã có, FE consume cluster 5.
