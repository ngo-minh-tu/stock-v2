# Phase 22 — Financial Unit Scaling + Production Guards

**Started:** 2026-05-21 · **Closed:** 2026-05-21
**Roadmap:** Mốc 4 step 2 — đóng Phase 21 REVIEW High finding (financial unit scaling blocker cho trader audit) + 2 production-safety hygiene fix.

## 1. Scope

3 fix song hành, all driven by Phase 21 REVIEW + Phase 20 Codex review:

1. **Financial unit scaling** (Phase 21 REVIEW High): VCI trả raw VND, KBS trả ngàn đồng — DB lưu hỗn hợp đơn vị nên trader so sánh với CafeF/Vietstock thấy giá trị KBS-ticker 1000× nhỏ hơn thực tế. Phase 22 apply **source-aware scaling**: `_apply_source_scaling(rows, source)` ×1000 chỉ cho KBS-rows, giữ nguyên VCI-rows.
2. **`.env.telegram` production guard** (Phase 20 REVIEW Medium): startup fail-fast nếu `APP_ENV=production` + file `.env.telegram` tồn tại trong working dir. Bảo đảm dev secret không leak lên container production.
3. **Log scrub audit** (Phase 20 REVIEW High): grep `logger.warning(..., %s, ..., exc)` toàn `app/services/` + `app/crawlers/` để xác định không còn exception path nào leak URL có chứa token sau Phase 20 fix.

Out of scope: production `/refresh/all` rerun (đã document carry cho operator); KBS `bvps` workaround compute (Phase 21 §6 backlog); HoldingFormModal TODAY runtime (Phase 19 §6 backlog).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 22-01 | Pre-scaling check trên real data: VCI VHM balance Q4 2025 trả `current_assets=4.97e14` (raw VND, khớp 497T VND thực). KBS NLG balance Q1 2026 trả `total_assets=2.65e10` (ngàn đồng, ×1000 → 26.5T VND thực). Hai source khác đơn vị. | `vnstock_client.py` | Source-aware scaling — chỉ KBS apply ×1000, VCI giữ nguyên. Không scale `eps/bvps` (per-share VND) hay `shares_outstanding/audit_opinion` (count/categorical). |
| 22-02 | Phase 22 ý ban đầu là scale tại parser (`_extract_*_frame`) nhưng parser không biết source. Chuyển sang scale ở post-process trong `fetch_financials` multi-source loop, có biến `source` rõ ràng. | `vnstock_client.py` | Thêm helper `_apply_source_scaling(rows, source)` chỉ scale khi `source != "VCI"` (currently chỉ KBS). |
| 22-03 | `.env.telegram` chain-load qua pydantic-settings (Phase 20). Nếu file vô tình deploy vào container production sẽ override env vars từ secret manager. | `app/main.py` | Thêm `_enforce_production_secret_isolation()` chạy trong `create_app()` — raise RuntimeError nếu `APP_ENV=production` + `.env.telegram` exists. Demo/dev/test giữ nguyên hành vi. |
| 22-04 | Log scrub: chỉ `telegram_service.py:54` từng leak URL qua exception. Đã fix Phase 20. Other services (`refresh_service`, `screening_service`) chỉ log VnstockUnavailable/generic exception, không có auth token trong URL public vnstock guest. | (audit only) | Không có file thay đổi cho audit này; document trong SUMMARY §6 outcome. |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `mvp/code/app/crawlers/vnstock_client.py` | `_FINANCIAL_VND_FIELDS` set (11 fields needing ×1000 scaling); `_apply_source_scaling(rows, source)` helper; `fetch_financials` gọi sau mỗi source rows nhận về. |
| `mvp/code/app/main.py` | `_enforce_production_secret_isolation()` chạy trong `create_app()`. |
| `mvp/code/tests/unit/test_vnstock_client.py` | Update 5 test hiện có để reflect source-aware scaling (VCI raw / KBS ×1000); existing tests vẫn pass. |
| `mvp/code/tests/unit/test_main_prod_guard.py` (new) | 3 test cho production guard: production+file → raise; production+no-file → OK; demo+file → no-op. |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| Source-aware scaling apply đúng (KBS ×1000, VCI raw) | ✅ | Real NLG verify: revenue Q1 2026 = 1.279T VND (match real ~1.3T); total_assets = 25.894T VND (match real ~26T); EPS = 679 VND/share (per-share, NOT scaled). |
| Production guard fail-fast khi file leak | ✅ | `test_production_guard_raises_when_env_telegram_present` pass. |
| Production guard không block dev/demo | ✅ | `test_production_guard_noop_in_non_production` pass. |
| Backend pytest pass | ✅ | 266/266 (3 mới prod guard, parser tests updated). |
| Ruff clean | ✅ | `uv run ruff check app tests` — All checks passed. |
| Multi-source merge logic vẫn đúng sau scaling | ✅ | `test_fetch_financials_merges_multiple_sources` verify VCI raw 100 wins over KBS scaled 105000; KBS-only fields scale correctly. |

## 5. Quyết định khoá trong phase này

- **Source-aware scaling ở `fetch_financials` post-process** thay vì parser-level. Parser stateless về source; scaling = boundary concern.
- **VCI = raw VND, KBS = ngàn đồng** locked cho mọi field trong `_FINANCIAL_VND_FIELDS` (11 field). Per-share fields (`eps`, `bvps`) NOT scaled (đã là VND/share). Counts (`shares_outstanding`) NOT scaled.
- **DB convention raw VND cho mọi financial field** — đồng nhất với prices Phase 16. Downstream consumers (`feature_service`, `filter_service`) đã dùng ratio (scale-invariant) ngoại trừ F11 `ocf_billion = float(latest.operating_cash_flow) / 1e9` — sau Phase 22 sẽ tính đúng (raw VND / 1e9 = billion VND).
- **Multi-source merge order: scale BEFORE merge into dict** — `_apply_source_scaling` chạy ngay sau khi rows nhận về từ source, before fields được merge vào primary `merged` dict. Bảo đảm khi VCI fields đã filled, KBS scaled values không override (no-downgrade policy).
- **Production guard chỉ check file existence**, không parse content. Nếu file rỗng vẫn raise — operator có thể nhanh chóng `rm .env.telegram` để pass guard.
- **Log scrub audit kết quả**: Phase 20 fix `telegram_service` là duy nhất; vnstock_client cho guest quota dùng URL public không chứa secret nên log exception OK. Document trong §6 thay vì code change.

## 6. Issues / drift còn open

- **Production refresh chưa rerun** — combined Phase 21 + Phase 22 fix cần `/refresh/all` (~22 phút) trên prod-screener.db để overwrite stale unscaled values. Operator chạy trước hand-off trader.
- **`feature_service.F11` validation** — ocf_billion = OCF / 1e9. Phase 22 raw VND scaling làm F11 output đúng theo intent (billion VND). Có thể cần re-tune scoring threshold nếu F11 đang dùng range (-2, +5) billion với OCF từ ngàn đồng cũ (range cũ 1000× nhỏ hơn → tất cả OCF tickers đạt full feature, bias scoring). Phase 23 verify.
- **DB hiện có row với mix unit** — production-screener.db chứa rows từ Phase 17/18 (no scaling, ngàn đồng cho KBS-ticker) lẫn rows mới (Phase 22 scaled). Nếu refresh không overwrite hết, screening sẽ mix unit. Operator phải full refresh + Phase 21 COALESCE no-downgrade sẽ giữ existing → cần wipe DB trước rerun cho clean state. Hoặc DELETE financial_reports trước refresh.
- **Phase 20 REVIEW Medium: config-layer pytest** cho multi-env-file precedence chưa add. Carry sang Phase 23.
- **Phase 19 REVIEW Low: HoldingFormModal TODAY hard-code** chưa fix. Carry sang Phase 23 (UX polish).

## 7. Test commands (reproducible)

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Targeted regression
uv run pytest tests/unit/test_vnstock_client.py tests/unit/test_main_prod_guard.py tests/integration/test_financial_repo.py -v
# 15 tests pass (10 vnstock + 3 prod guard + 2 financial_repo)

# Full BE regression
uv run pytest -q
# 266/266 passed

# Ruff
uv run ruff check app tests
# All checks passed

# Real verify scaling (1 KBS-ticker)
PYTHONPATH=. uv run python -c "
from app.crawlers.vnstock_client import VnstockClient
rows = VnstockClient(rate_limit_s=0.5).fetch_financials('NLG')
r = rows[0]
print(f\"period={r['period']}, revenue={r['revenue']/1e12:.3f}T VND, total_assets={r['total_assets']/1e12:.3f}T VND, eps={r['eps']} VND/share\")
"

# Production guard manual test (file present check)
APP_ENV=production uv run python -c "from app.main import _enforce_production_secret_isolation; _enforce_production_secret_isolation()"
# Expect: RuntimeError if .env.telegram tồn tại

# Operator pre-handoff full refresh on prod DB (~22 phút, run BEFORE ngrok)
cp env.production.example .env  # or copy your real .env
APP_ENV=production DB_PATH=./data/prod-screener.db uv run uvicorn app.main:app --port 8000 &
# In another terminal:
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"password":"...your-prod-password..."}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
# Wipe stale rows first to avoid mixed-unit DB:
PYTHONPATH=. uv run python -c "
from app.db.session import SessionLocal
from app.models.financial import FinancialReport
with SessionLocal() as db:
    db.query(FinancialReport).delete()
    db.commit()
    print('FinancialReport wiped')
"
# Then refresh:
curl -sS -X POST http://localhost:8000/api/refresh/all -H "Authorization: Bearer $TOKEN"
```

## 8. Hand-off cho Phase 23

1. **Operator chạy production `/refresh/all`** sau khi WIPE `financial_reports` (xem §7) để có clean state với Phase 21+22 fix combined.
2. **HoldingFormModal TODAY runtime** (Phase 19 §6 backlog) — convert hard-code `2026-05-07` sang `useMemo(new Date().toISOString().slice(0,10))`.
3. **F11 (OCF/1e9) threshold re-tune** — sau real refresh, check ROE distribution + OCF feature score range, có thể cần adjust scoring weights.
4. **Config-layer pytest** cho multi-env-file precedence (Phase 20 REVIEW Medium).
5. **Telegram broadcast on run COMPLETED** — TAD c07 §3 wire vào `screening_service` finalize.
6. **Pre-handoff disclaimers** — banner UI cho News (fixture), Macro (hardcoded), Backtest (mock heuristic).

## 9. Post-phase fixes

*Reserved. Mọi user-requested fix sau khi phase đóng append vào đây với date + scope.*
