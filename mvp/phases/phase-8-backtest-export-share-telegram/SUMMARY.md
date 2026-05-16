# Phase 8 — Backtest + Export + Share + Telegram

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 1.5d / ~3h
**Spec ref:** [PLAN.md §3 row 8](../../PLAN.md), [SRS f12](../../../docs/srs/f12-run-history-backtest.md), [SRS f13](../../../docs/srs/f13-export-share.md), [SRS f14](../../../docs/srs/f14-telegram-bot.md), [TAD g02 §1+§8.5-8.6+§9](../../../docs/tad/g02-api.md), [TAD c06](../../../docs/tad/c06-pdf-share.md), [TAD c07](../../../docs/tad/c07-telegram.md), [cluster-5-summary](../../../report/cluster-5-summary.md), [cluster-6-summary](../../../report/cluster-6-summary.md)

## 1. Scope

10 endpoints chia 4 nhóm tích hợp + xuất:

**Backtest (4 endpoints, prefix `/api/backtest`):**
- `POST /` → 202 `{backtest_id, status: PENDING}` — start mock backtest BG task
- `GET /{id}/status` → `{backtest_id, status, started_at, completed_at}` — polling 1.5s (TAD g02 §8.5)
- `GET /{id}` → BacktestMetricsResponse (accuracy, price_error, ROI, alpha, roi_curve 9-26 weekly)
- `GET /{id}/results` → per-ticker rows sort `price_error_pct DESC` (TAD g02 §8.6)

**Export PDF (1 endpoint):**
- `GET /api/export/pdf/{run_id}` → 200 binary với `Content-Type: application/pdf` + `Content-Disposition: attachment` (TAD g02 §9.1)

**Share Link (4 endpoints, prefix `/api/share`):**
- `POST /` → 201 `{token, run_id, url, created_at, expires_at}` (uuid v4 + 7-day TTL)
- `GET /` → list active (non-expired) sort newest first
- `GET /{token}` → **PUBLIC, no auth** — SharedViewResponse (summary + dashboard + top_mua); 404 nếu invalid/expired
- `DELETE /{token}` → 200 + envelope `{token, deleted: true}` (TAD g02 §8.1)

**Telegram (1 endpoint):**
- `POST /api/telegram/test` → 200 `{sent, error}` envelope (real httpx Bot API call)

## 2. Pre-code spec audit (drift report)

| # | Drift / Gap | Resolution |
|---|---|---|
| 1 | **Backtest mock vs PRD §4.5 strict**: SRS f12 AC-12-23 + cluster-5-summary chốt prototype dùng heuristic (MUA: return>0, GIU: -7..+12, BAN: return<0). PRD §4.5 strict cần per-ticker VN-Index reference — backend chưa track. | ✅ Phase 8 implement heuristic per `_is_correct(rec, return)` trong [backtest_service.py](../../code/app/services/backtest_service.py). PRD §4.5 strict = post-MVP. Document trade-off trong service docstring. |
| 2 | **`total_count = scored_count latest run`**: TAD g02 §8.6 explicit "NOT 81". | ✅ `start_backtest()` requires `screening_repo.latest_completed(db)` non-None; results generated từ `results_repo.list_by_run(db, baseline_run_id)`. ERR-12-03 nếu chưa có run COMPLETED. |
| 3 | **Backtest progress_percent missing trong DB schema**: model có status nhưng KHÔNG có progress_percent/current_step. Phase 5 screening tracker live duration via run_at delta. | ✅ Status response chỉ trả `{status, started_at, completed_at}` — frontend poll status enum (PENDING → RUNNING → COMPLETED). KHÔNG progress field per-state — UX vẫn render "Đang chạy..." spinner đủ dùng. |
| 4 | **Share `url` field**: TAD c06 §3.3 store mock `https://app.example/share/{token}`. TAD c06 §4 production guidance = trả relative `/share/{token}` để FE prepend `window.location.origin` runtime. | ✅ Backend store relative `/share/{token}` (không hardcode domain). Document drift: TAD c06 §3.3 spec "store URL" sẽ cần update khi cluster reconcile next round. |
| 5 | **PDF mode dual-track**: TAD c06 §1.2 prototype HTML serve as `application/pdf`; production WeasyPrint. Config có `EXPORT_PDF_MODE=weasyprint` default. | ✅ [export_service.py](../../code/app/services/export_service.py) ship cả 2 modes: `weasyprint` (default — render PDF binary thật) + `html_mock` (HTML string). Lazy import weasyprint để tránh load nặng nếu mode=html_mock. WeasyPrint render fail (font missing, libpango) → auto-fallback html_mock + log warning. Frontend KHÔNG đổi (Content-Type stable). |
| 6 | **PDF Vietnamese font**: WeasyPrint cần font fallback cho diacritics. Dockerfile chưa wire Inter+Noto Sans Vietnamese. | ⚠️ Phase 8 dùng `Inter, Helvetica, sans-serif` font stack — Helvetica fallback OK cho prototype testing local nhưng sản xuất docker cần `apt-get install fonts-noto-cjk fonts-noto-core` hoặc embed `.ttf` files. Document trong Phase 9+ Dockerfile review. |
| 7 | **Telegram credentials priority**: TAD c07 §1.1 lists "Settings: telegram_chat_id + telegram_token". TAD g07 deployment lists `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` env vars. | ✅ `_resolve_credentials()` settings table priority over env var per TAD c07 §1.1; env var fallback when settings empty. Test `test_settings_priority_over_env_var` enforce. |
| 8 | **Telegram error envelope**: TAD §9.4 + c07 §4 chốt envelope `{success: true, data: {sent: false, error}}` — KHÔNG `success: false`. App-level error trong data. | ✅ `send_test_message()` return dict — luôn wrapped qua `success()` helper ở router. Test `test_telegram_api_failure_returns_envelope_with_error` enforce. |
| 9 | **Share GET /{token} bypass auth**: TAD c06 §5 + g02 §1 registry chốt PUBLIC route. FastAPI router-level auth không phù hợp; cần per-route deps. | ✅ [api/share.py](../../code/app/api/share.py) endpoint `get_shared_view` KHÔNG có `CurrentUser` parameter; các endpoint khác trong cùng router có. Test `test_public_view_does_NOT_require_auth` enforce. |
| 10 | **Backtest job_lock collision**: Phase 5 screening dùng singleton `job_lock` với active_type='screening'. Phase 8 backtest cũng heavy → dùng cùng lock with active_type='backtest'. | ✅ `run_backtest()` `try_acquire(f"backtest_{id}", "backtest")`; finally release. Nếu lock fail → mark FAILED + early-return. Trade-off: 2 backtest concurrent → 2nd fails. Acceptable per TAD g05 §1 "1 heavy job tại 1 thời điểm". |

**Conventions locked:**

- **Backtest universe**: scored results của latest COMPLETED run (NOT 81 ticker whitelist) per TAD §8.6.
- **Heuristic correctness**: `BACKTEST_HOLD_RETURN_MIN=-7.0`, `BACKTEST_HOLD_RETURN_MAX=12.0` constants ở [thresholds.py](../../code/app/constants/thresholds.py).
- **Mock state machine**: 4 transitions PENDING → RUNNING → RUNNING → COMPLETED|FAILED, ~1.2s total (`BACKTEST_MOCK_STEP_DELAY_S=0.3` × 4). Frontend polling 1.5s tick 4-5 lần thấy progression smooth (TAD §8.5 rationale).
- **Token format**: standard `uuid.uuid4()` 36-char string. Stored unique constraint per [share.py model:21](../../code/app/models/share.py).
- **TTL default**: 7 days, override 1-365 via `expires_in_days` request body. Constant `SHARE_DEFAULT_EXPIRES_DAYS=7`.
- **PDF Vietnamese disclaimer**: hardcode trong template — KHÔNG cần i18n cho PDF (cluster 6 prototype pattern).
- **Telegram timeout**: 5s. `httpx.TimeoutException` mapped sang `{sent: false, error: 'Telegram API timeout'}`.

## 3. Deliverables

Tất cả path relative tới `mvp/code/`.

### Mới tạo
| Path | Nội dung |
|---|---|
| [app/repositories/backtest_repo.py](../../code/app/repositories/backtest_repo.py) | `create_run`, `get`, `update_status`, `mark_completed`, `mark_failed`, `insert_results` (bulk), `list_results` sort `price_error_pct DESC` |
| [app/repositories/share_repo.py](../../code/app/repositories/share_repo.py) | `create`, `get_by_token`, `list_active(now)` (filter `expires_at > now`), `delete` |
| [app/schemas/backtest.py](../../code/app/schemas/backtest.py) | `BacktestStartRequest`, `BacktestAcceptedResponse`, `BacktestStatusResponse`, `RoiCurvePoint`, `BacktestMetricsResponse`, `BacktestResultRow`, `BacktestResultsResponse` |
| [app/schemas/share.py](../../code/app/schemas/share.py) | `ShareCreateRequest` (`expires_in_days` 1-365), `ShareLinkItem`, `ShareCreateResponse`, `ShareListResponse`, `SharedViewResponse`, `ShareDeleteResponse` |
| [app/schemas/telegram.py](../../code/app/schemas/telegram.py) | `TelegramTestResponse` `{sent, error}` |
| [app/services/backtest_service.py](../../code/app/services/backtest_service.py) | `validate_period` → ERR-12-02; `start_backtest` validates baseline run + creates DB row + commits; `run_backtest` BG task with state machine + mock heuristic results + metrics aggregation + roi_curve sin-wobble; `_is_correct` per recommendation; `_build_roi_curve` 9-26 ISO-week labels |
| [app/services/export_service.py](../../code/app/services/export_service.py) | `_build_html` Vietnamese template (Cover + Tổng quan + Top 10 MUA + Red Flags 20 + Disclaimer + Footer); `render_pdf` dual-mode (`weasyprint` lazy import + auto-fallback `html_mock`); `build_share_data` reuse cho `/share/{token}` |
| [app/services/share_service.py](../../code/app/services/share_service.py) | `create_link` (uuid v4 + 7-day TTL), `list_active_links`, `get_active_link` (404 invalid/expired), `delete_link`. Token URL relative `/share/{token}` per TAD c06 §4 production guidance |
| [app/services/telegram_service.py](../../code/app/services/telegram_service.py) | `_resolve_credentials` (settings priority over env), `send_test_message` real httpx.post Bot API + map status_code/timeout/HTTPError sang `{sent, error}` shape |
| [app/api/backtest.py](../../code/app/api/backtest.py) | 4 endpoints prefix `/backtest`. POST `bg.add_task(run_backtest, ...)` |
| [app/api/export.py](../../code/app/api/export.py) | `GET /export/pdf/{run_id}` returns `Response(media_type='application/pdf')` + `Content-Disposition: attachment; filename="run-{id}.pdf"` |
| [app/api/share.py](../../code/app/api/share.py) | 4 endpoints. `get_shared_view` (`GET /share/{token}`) KHÔNG có `CurrentUser` dep — public route. Other 3 require auth |
| [app/api/telegram.py](../../code/app/api/telegram.py) | `POST /telegram/test` |
| [tests/integration/test_backtest.py](../../code/tests/integration/test_backtest.py) | 13 cases: 4 auth, 3 period validation, 1 no-baseline, 1 lifecycle full shape, 3 not-found, 1 heuristic correctness verify |
| [tests/integration/test_export.py](../../code/tests/integration/test_export.py) | 5 cases: auth, 404 unknown run, ERR-13-01 no data, response headers + body, html_mock mode (monkeypatch settings) |
| [tests/integration/test_share.py](../../code/tests/integration/test_share.py) | 10 cases: 4 auth (3 protected + 1 public bypass), full CRUD lifecycle, 404 unknown run, expired token returns 404, list excludes expired, default 7-day TTL, delete unknown 404 |
| [tests/integration/test_telegram.py](../../code/tests/integration/test_telegram.py) | 6 cases: auth, unconfigured, API success (httpx mock), API failure with error, timeout, settings priority over env |

### Sửa
| Path | Thay đổi |
|---|---|
| [app/api/__init__.py](../../code/app/api/__init__.py) | + 4 router imports + include — backtest, export, share, telegram (cuối list) |
| [app/constants/error_codes.py](../../code/app/constants/error_codes.py) | + `ERR_BACKTEST_PERIOD_INVALID="ERR-12-02"`, `ERR_BACKTEST_NO_BASELINE_RUN="ERR-12-03"`, `ERR_EXPORT_NO_DATA="ERR-13-01"`, `ERR_SHARE_TOKEN_INVALID="ERR-13-02"`, `ERR_TELEGRAM_NOT_CONFIGURED="ERR-14-01"`, `ERR_TELEGRAM_API_FAIL="ERR-14-02"` |
| [app/constants/thresholds.py](../../code/app/constants/thresholds.py) | + `BACKTEST_HOLD_RETURN_MIN=-7.0`, `BACKTEST_HOLD_RETURN_MAX=12.0`, `BACKTEST_SELL_UNDERPERFORM=5.0`, `BACKTEST_MOCK_STEP_DELAY_S=0.3`, `SHARE_DEFAULT_EXPIRES_DAYS=7` |

## 4. Exit criteria — all PASS

- `uv run pytest` → **232/232 pass** (Phase 0-7: 198, Phase 8 mới: 34) — full suite 484s ≈ 8 min
- `uv run ruff check app tests` → All checks passed
- 10 endpoints cover SRS f12 UC-12-03 + SRS f13 UC-13-01..03 + SRS f14 UC-14-02:
  - AC-12-17 (period validation) ✓ ERR-12-02 (3 cases)
  - AC-12-18 (2-stage polling) ✓ POST 202 → status terminal → metrics + results
  - AC-12-19/20/21 (metrics shape + roi_curve length 9-26 + sort price_error_pct DESC) ✓
  - AC-12-23 (heuristic correctness MUA/GIU/BAN) ✓ explicit assertion
  - AC-13-01..03 (PDF chứa MUA, disclaimer, run meta) ✓ html_mock mode body sanity check
  - AC-13-08 (Content-Disposition + Content-Type) ✓
  - AC-13-09 (dual-mode html_mock vs weasyprint) ✓
  - AC-13-10..12 (share lifecycle + 7-day TTL) ✓
  - AC-13-15 (invalid/expired → 404, KHÔNG redirect login) ✓
  - AC-14-04..08 — frontend cluster 6 verifies; AC-NF telegram envelope success=true even sent=false ✓
- Smoke uvicorn:
  - POST `/api/telegram/test` no creds → 200 envelope `{sent: false, error: 'Telegram chưa cấu hình ...'}`
  - POST `/api/backtest` no baseline → 400 ERR-12-03
  - GET `/api/share/badtoken` (PUBLIC) → 404 ERR-13-02
  - GET `/api/export/pdf/unknown_run` → 404 ERR-NOT-FOUND

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Backtest correctness | Heuristic mock (NOT strict per PRD §4.5) | SRS f12 AC-12-23 + cluster-5-summary chốt; per-ticker VN-Index reference = post-MVP |
| Backtest universe | scored_count của latest COMPLETED run | TAD g02 §8.6 explicit "NOT 81 universe" |
| Backtest progress field | OMIT — chỉ trả status enum | Schema không có column; frontend polling status đủ render UI |
| Backtest job_lock key | `f"backtest_{id}"` + active_type='backtest' | Reuse Phase 5 singleton; collision với screening → 2nd job fail |
| Backtest BG step delay | 0.3s × 4 = 1.2s total mock | UX feedback non-instant; FE polling 1.5s tick smooth |
| Backtest heuristic ranges | MIN=-7%, MAX=12% (locked SRS g03 §K) | Constants từ spec — KHÔNG bake config-overridable |
| ROI curve length | `max(9, min(26, days // 7))` | TAD g02 §8.6 "9-26 weekly points" |
| ROI curve labels | `f"{iso_year}-W{iso_week:02d}"` ISO week | Match design.md / cluster-5-summary mock pattern |
| `target_price_3m` unit conversion | `/1000` if raw > 1000 else as-is | Phase 5 stores raw VND in DB; backtest mock data có thể là ngàn đồng |
| PDF dual-mode | `weasyprint` default + auto-fallback `html_mock` on render error | TAD c06 §1.2 prototype acceptable; production graceful degradation |
| PDF font stack | `Inter, Helvetica, sans-serif` | Phase 8 prototype — Phase 9 Docker review font embed |
| PDF Content-Disposition | `attachment; filename="run-{id}.pdf"` | TAD g02 §9.1 hardcoded; FE đoán filename qua header |
| Share token format | `uuid.uuid4()` 36-char | TAD c06 §3.1 spec |
| Share `url` field | Relative `/share/{token}` | TAD c06 §4 production guidance — FE prepend origin runtime |
| Share TTL default | 7 days, range 1-365 | SRS f13 + SHARE_DEFAULT_EXPIRES_DAYS constant |
| Share GET /{token} | NO `CurrentUser` dep | TAD c06 §5 PUBLIC route bypass auth |
| Share expired check | `expires_at <= now()` → 404 ERR-13-02 | TAD c06 §5.3 prototype check |
| Share data shape | summary + dashboard + top_mua | TAD g02 §9.2 spec; reuse Phase 6 dashboard_service + Phase 8 export `_top_mua_rows` |
| DELETE response | `{token, deleted: true}` 200 | Match Phase 5/6/7 pattern + TAD §8.1 |
| Telegram credentials priority | Settings table > env var | TAD c07 §1.1 spec; fallback support deployment via env |
| Telegram timeout | 5s `httpx.post(timeout=5.0)` | Reasonable cho probe message; frontend đợi qua polling pattern |
| Telegram envelope | `success: true` luôn, `data.sent` flag | TAD c07 §4 + g02 §9.4 — app-level error trong data |
| Telegram error mapping | Timeout → "Telegram API timeout"; HTTP non-200 → `description` từ Bot API; 401 → "Unauthorized" v.v. | Match cluster 6 mock messages cho FE i18n consistency |

## 6. Issues / drift

- **Pre-existing DB pollution (Phase 6+7 §6 carryover)**: chạy full pytest lần đầu sau dev session có thể fail với `IntegrityError`. Workaround đã document — chạy cleanup script trước full suite. Không phải bug Phase 8.
- **Full suite 484s ≈ 8 phút**: mỗi backtest test có BG task `time.sleep(0.6s)` × 2 = 1.2s + screening_data fixture insert/delete 16k rows. 13 backtest tests × ~14s = 182s overhead. Acceptable cho integration suite. Phase 9+ cân nhắc parallel test execution.
- **ISO week label cross-year**: `iso_year` có thể khác `period_from.year` ở cuối tháng 12 (ISO calendar). Acceptable cho FE rendering.
- **WeasyPrint fonts**: Phase 8 KHÔNG embed Vietnamese fonts trong Dockerfile. Production deploy cần `apt-get install fonts-noto-cjk` hoặc download Inter/Noto Sans Vietnamese vào `/app/fonts/`. Phase 9+ Dockerfile review đang TODO.
- **WeasyPrint warnings on macOS**: local development có thể log warning về Cairo/Pango. Acceptable cho dev — production Docker Linux không có vấn đề. Test `test_export_returns_pdf_response_headers` pass cả 2 nền tảng.
- **Mock heuristic accuracy variance**: random.Random(seed=backtest_id) deterministic per backtest_id nhưng giá trị thay đổi mỗi backtest mới. Test verify shape + invariants thay vì exact values.
- **`run_backtest` exception handler**: catch broad `Exception` rồi mark FAILED + release lock. KHÔNG re-raise (BG task không có caller listening). Document drift Phase 9+ logging review.
- **`screening_data` fixture không cleanup `BacktestRun`/`BacktestResult`**: backtest tests insert backtest rows, fixture cleanup chỉ delete screening tables. Trong test isolation, trace residual rows accumulate. Phase 9+ extend fixture cleanup. Hiện tại không gây test failure vì backtest tests dùng numeric id, không collide.
- **Telegram chat_id trong DB**: Phase 2 settings model có `telegram_chat_id`/`telegram_token` columns. Phase 8 đọc + ghi qua settings_repo. Nhưng PUT settings telegram_enabled=true vẫn yêu cầu chat_id+token (Phase 2 validation). Phase 8 telegram/test KHÔNG check `telegram_enabled` — chỉ check chat_id+token có giá trị. Acceptable: test send là probe action manual, không phụ thuộc enable state.

## 7. Test commands (reproducible)

```bash
cd mvp/code

# Phase 8 only
uv run pytest tests/integration/test_backtest.py tests/integration/test_export.py \
  tests/integration/test_share.py tests/integration/test_telegram.py -v   # 34 pass

# Full suite (phase 0-8)
uv run pytest                                          # 232 pass

# Lint
uv run ruff check app tests                            # All checks passed

# Smoke với uvicorn
uv run uvicorn app.main:app --port 8014 &
TOKEN=$(curl -sS -X POST http://127.0.0.1:8014/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# Telegram test (no creds)
curl -sS -X POST http://127.0.0.1:8014/api/telegram/test -H "Authorization: Bearer $TOKEN"

# Backtest start (cần ít nhất 1 run COMPLETED)
curl -sS -X POST http://127.0.0.1:8014/api/run -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"total_capital":500000000}'
# đợi terminal, lấy run_id, sau đó:
curl -sS -X POST http://127.0.0.1:8014/api/backtest -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"period_from":"2026-02-01","period_to":"2026-04-01"}'
# poll status:
curl -sS http://127.0.0.1:8014/api/backtest/1/status -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8014/api/backtest/1 -H "Authorization: Bearer $TOKEN"
curl -sS http://127.0.0.1:8014/api/backtest/1/results -H "Authorization: Bearer $TOKEN"

# Export PDF
curl -sS -OJ http://127.0.0.1:8014/api/export/pdf/{run_id} -H "Authorization: Bearer $TOKEN"

# Share lifecycle
TOKEN_SHARE=$(curl -sS -X POST http://127.0.0.1:8014/api/share -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"run_id":"{run_id}"}' | jq -r '.data.token')
curl -sS http://127.0.0.1:8014/api/share/$TOKEN_SHARE       # PUBLIC, no auth
curl -sS http://127.0.0.1:8014/api/share -H "Authorization: Bearer $TOKEN"
curl -sS -X DELETE http://127.0.0.1:8014/api/share/$TOKEN_SHARE -H "Authorization: Bearer $TOKEN"
```

## 8. Hand-off cho Phase 9

Phase 9 (FE swap full) sẽ:

- Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api` + `NEXT_PUBLIC_ENABLE_MSW=false` trong `frontend/.env.local`
- Disable MSW worker bootstrap (gate qua env var trong [MswBootstrap.tsx](../../../frontend/src/components/common/MswBootstrap.tsx))
- Smoke test 8 page routes + 4 themes + VIE/EN
- Verify backtest 2-stage polling FE consume backend `/api/backtest/*` đúng
- Verify share `/share/{token}` page strip `${origin}/share/{token}` từ relative URL backend trả

Đã sẵn sàng:
- 10 endpoints Phase 8 + 4 endpoints Phase 7 + 11 endpoints Phase 6 + Phase 0-5 = full TAD g02 §1 registry covered.
- All envelopes consistent `{success: true, data: ...}` — apiFetch parse OK.
- DELETE 200+envelope pattern across portfolio/runs/share.
- Public route `/share/{token}` đã wired bypass auth.
- PDF Content-Disposition + Content-Type stable cho FE download trigger.

⚠️ **Phase 9 phải audit**:
- FE `apiFetch` đã handle envelope chuẩn chưa? (theo cluster prompt — đã tốt từ cluster 1).
- FE backtest polling interval: 1.5s match TAD g02 §8.5 (không 2s như run polling).
- FE share URL build: `${window.location.origin}` + relative `url` từ backend. KHÔNG hardcode `https://app.example/...`.
- Telegram settings UI điền chat_id + token → save settings (Phase 2 endpoint), KHÔNG cần Phase 8 endpoint riêng.
- PDF download: browser nhận `application/pdf` + attachment header → tự download. Test thử mở file: `weasyprint` mode → real PDF; `html_mock` mode → file `.pdf` mở bằng PDF reader sẽ broken (HTML inside) — acceptable cho prototype.
- Phase 8 KHÔNG implement UC-14-01 (auto send sau run completion). Frontend vẫn dùng pattern: run COMPLETED → user tự click "Gửi tin thử" trong Settings → /telegram/test. Auto-send post-run = post-MVP wiring (cần thêm vào screening_service.run_screening Step 13).
- WeasyPrint Vietnamese font: nếu FE smoke thấy diacritics broken trong PDF, switch `EXPORT_PDF_MODE=html_mock` env var để fallback.

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 8 sau khi phase đã đóng)*

### 2026-05-16 — Backtest `terminal_status` pattern (reviewer round 2)

**Bug:** `run_backtest()` [backtest_service.py:223-225](../../code/app/services/backtest_service.py#L223-L225) hard-code
`job_lock.release(job_key, status="COMPLETED")` trong `finally`. Hai nhánh
early-return không raise — (a) `scored` rỗng [line 182-185](../../code/app/services/backtest_service.py#L182-L185) và (b) `row is None`
[line 178-180](../../code/app/services/backtest_service.py#L178-L180) — đều mark DB row FAILED rồi return, nhưng finally vẫn release
job_lock COMPLETED → state mismatch: GET /backtest/{id}/status (DB) trả FAILED,
GET /jobs/{id} (job_lock) trả COMPLETED → UI inconsistency.

**Fix:** Refactor sang `terminal_status: str = "COMPLETED"` + `error_msg: str | None`
biến mutable. Mỗi nhánh thất bại set 2 biến này trước khi `return`, finally release
một lần duy nhất với giá trị đúng. Loại bỏ `job_lock.release(... FAILED ...)` cũ
trong `except` (chuyển vào finally) → single source of release, không còn risk
double-release.

**Tests ([test_backtest.py](../../code/tests/integration/test_backtest.py)):** Thêm 3 test:
- `test_post_backtest_returns_409_when_job_lock_held` — pre-acquire lock, POST trả
  409 ERR-JOB-CONFLICT (đối xứng với POST /run).
- `test_run_backtest_releases_lock_failed_when_no_scored_rows` — call run_backtest
  trực tiếp với baseline_run_id không có results → assert job_lock FAILED + DB FAILED.
- `test_run_backtest_releases_lock_failed_on_exception` — monkeypatch
  `_generate_results` raise → assert job_lock FAILED với error truyền qua.

**Files:** [backtest_service.py](../../code/app/services/backtest_service.py) +12 / -7 LOC; [test_backtest.py](../../code/tests/integration/test_backtest.py) +110 LOC.
