# Phase 11 — README

**Status:** COMPLETED 2026-05-11
**Estimate vs actual:** 0.5d / ~1h
**Spec ref:** [PLAN.md §3 row 11](../../PLAN.md), Phase 10 hand-off [SUMMARY.md §8](../phase-10-integration-qa/SUMMARY.md).

## 1. Scope

Viết documentation cuối cùng để dev/tester clone repo có thể start dev + run trong < 15 phút. Per user discussion, scope expanded từ PLAN spec (1 file `mvp/README.md`) → 3 files:

- [README.md](../../../README.md) (root) — monorepo intro + pointers (~80 dòng)
- [mvp/README.md](../../README.md) — backend setup chi tiết (~270 dòng, PLAN row 11 spec)
- [frontend/README.md](../../../frontend/README.md) — replace cluster-1-era prototype README với post-Phase 9 reality (~190 dòng)

Lý do expand: monorepo có 4 active surface (frontend, mvp backend, prototype frozen, docs/report). Không có root README → dev clone về không biết bắt đầu đâu; FE README outdated từ cluster 1 era không phản ánh post-Phase 9 setup.

## 2. Pre-code spec audit (drift report)

| # | Drift | Resolution |
|---|---|---|
| 1 | PLAN.md row 11 ghi "poetry install" — reality Phase 0 chốt `uv sync` (User locked 2026-05-10) | ✅ README dùng `uv sync` + `uv run` xuyên suốt. Tại Phase 11, PLAN.md được giữ như build-time doc; ghi chú này đã được supersede ngày 2026-05-19 khi PLAN.md được cập nhật ledger Phase 0-15. |
| 2 | PLAN.md spec chỉ định 1 file `mvp/README.md` — nhưng monorepo có 4 surface | ✅ User chốt expand sang 3 files (option B trong câu hỏi user) |
| 3 | `frontend/README.md` hiện hữu là cluster-1 prototype-era (2026-XX-XX): nội dung "cụm 1: Shell & Foundation", "MSW mocks", "Mock API qua MSW", "8 placeholder pages = ComingSoon" — đã obsolete sau cluster 2-6 + Phase 9 swap | ✅ Replace toàn bộ với post-Phase 9 reality (real backend default, MSW opt-in, 14 routes, 17 component dirs) |
| 4 | `script/run-prototype.sh` trỏ `cd prototype` — nhưng `prototype/` đã frozen 2026-05-08 | ⚠️ KHÔNG touch trong Phase 11 — script vẫn dùng được khi cần xem prototype cũ. Documented trong root README §2 (`prototype/` = frozen reference). |
| 5 | TAD §1 endpoint registry còn gap (`/runs/{id}/excluded`, `/stocks/{ticker}/runs`, `reason_text`) | ⚠️ Documented trong [report/mvp-build/SUMMARY.md §4.C](../../../report/mvp-build/SUMMARY.md) — TAD doc patch defer post-MVP, backend ships ahead |

## 3. Deliverables

### Mới tạo
| Path | Nội dung | LOC |
|---|---|---|
| [README.md](../../../README.md) (root) | Monorepo intro + pointers + stack tóm tắt + phase ledger + author/license | ~110 |
| [mvp/README.md](../../README.md) | Backend setup 5-phút + env vars table + curl examples (login, run lifecycle, portfolio, share, PDF) + Docker + troubleshooting + layout + giới hạn MVP | ~270 |

### Replace
| Path | Old | New |
|---|---|---|
| [frontend/README.md](../../../frontend/README.md) | Cluster 1 era ("Shell & Foundation", MSW mocks, 8 ComingSoon pages) | Post-Phase 9 (2 modes real/MSW opt-in, 14 routes, schema reconcile note, 17 component dirs) |

## 4. Exit criteria — all PASS

Smoke verify README commands chính xác:

- `cd mvp/code && uv sync` → "Resolved 86 packages" ✓
- `uv run alembic upgrade head` → clean (idempotent re-run sau Phase 0-10) ✓
- `uv run python -m app.db.seed` → idempotent, all skip with "already seeded" ✓
- `uv run uvicorn app.main:app --port 8000` → serves ✓
- `curl /api/health` → `{success:true, data:{status:ok}}` ✓
- `curl /api/version` → full version envelope (app/prd/srs/tad/model) ✓
- `curl -X POST /api/auth/login` → 200 token ✓
- `curl -X PUT /api/auth/password` với schema mới `{current, new_password}` → 200 fresh token ✓ (Phase 10 fix verified)
- Restore password back → 200 ✓
- `cd frontend && npx tsc --noEmit` → clean ✓
- Tất cả markdown link relative paths verified (using `[name](../path)` per VSCode extension context)
- Root README link to `mvp/README.md` + `frontend/README.md` working
- mvp/README link to `../report/mvp-build/SUMMARY.md` + `../frontend/` working
- frontend/README link to `../mvp/` + `../report/` + `../prototype/` working

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Scope | 3 README files (root + mvp + frontend) | User chọn option B; cost +20 phút mang lại UX onboarding tốt hơn cho monorepo 4-surface |
| Ngôn ngữ | Tiếng Việt primary, English technical terms | Match memory + PLAN row 11 spec |
| FE README direction | Replace toàn bộ, không patch | Cluster 1-era nội dung mismatch quá nhiều (MSW default, no real backend, 8 ComingSoon pages); patch sẽ confusing hơn rewrite |
| `script/run-prototype.sh` | KHÔNG touch | Script vẫn dùng được để chạy frozen prototype khi cần reference. Documented trong root README. |
| Endpoint examples | Login → run lifecycle → portfolio → share + PDF (full happy path) | Đủ cover 80% case tester muốn verify; còn 20% explore qua Swagger/FastAPI auto-docs |
| Docker section | Có trong mvp/README, KHÔNG trong root | Docker là backend operational concern, root README giữ quick-start tối giản |
| Troubleshooting | Top 5 thực sự encountered (DB locked, fixture pollution, vnstock fail, telegram empty, CORS) | Phase 10 đã thực sự hit fixture pollution → high-signal trouble entry |
| TAD §1 registry gap | KHÔNG tự update TAD spec trong Phase 11 | Out of scope; documented trong report/mvp-build/SUMMARY.md §4.C |

## 6. Issues / drift

- **`script/run-prototype.sh` trỏ frozen `prototype/`**: vẫn hữu ích để dev xem prototype cũ — KHÔNG remove. Đã document trong root README §2.
- **PLAN.md row 11 "poetry install" obsolete**: tại Phase 11, README accurately documents reality (uv) còn PLAN giữ lịch sử build-time. Ghi chú này đã được supersede ngày 2026-05-19 khi PLAN.md được cập nhật ledger Phase 0-15.
- **TAD §1 endpoint registry doc gap**: 3 endpoint thêm trong Phase 6+9 chưa update TAD §1. README accurately reflect implementation; defer doc patch post-MVP.
- **Author tagline trong root README**: user edit "BA: Claude AI" → "Business-Analyst: Claude AI" sau Write tool — keep user version.
- **No screenshot/diagram trong README**: text-only theo principle "ngắn — chỉ những gì tester/dev cần". Khi cần visual context, link tới docs/design.md + docs/tad/c01-c08.
- **vnstock real call chưa test**: trong README troubleshooting có note "test mode dùng synthetic, không gọi vnstock thật" — production deploy vẫn cần verify vnstock fetch lần đầu (smoke test ngoài scope Phase 11).

## 7. Test commands (reproducible)

```bash
# === Verify mvp/README §2 setup ===
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv sync                          # 86 packages
uv run alembic upgrade head      # idempotent
uv run python -m app.db.seed     # idempotent — re-run safe
uv run uvicorn app.main:app --port 8000 &   # background

sleep 3
curl -sS http://localhost:8000/api/health
curl -sS http://localhost:8000/api/version

# === Verify mvp/README §4.2 password change ===
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl -sS -X PUT http://localhost:8000/api/auth/password \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"current":"ChangeMe123!","new_password":"TempPwd!2026"}'
# Restore
NEWTOK=$(curl -sS -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"password":"TempPwd!2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS -X PUT http://localhost:8000/api/auth/password -H "Authorization: Bearer $NEWTOK" -H 'Content-Type: application/json' -d '{"current":"TempPwd!2026","new_password":"ChangeMe123!"}'

# === Verify frontend/README §2 setup ===
cd /Users/ngominhtu/Projects/stock-v2/frontend
npx tsc --noEmit                 # clean
npm run build                    # 14 routes (verified Phase 10)

# === Verify links work ===
grep -E "\[.*\]\(.*\.md\)" /Users/ngominhtu/Projects/stock-v2/README.md
grep -E "\[.*\]\(.*\.md\)" /Users/ngominhtu/Projects/stock-v2/mvp/README.md
grep -E "\[.*\]\(.*\.md\)" /Users/ngominhtu/Projects/stock-v2/frontend/README.md
```

## 8. Hand-off cho production / post-MVP

MVP build pack đã đóng — Phase 0-11 complete. Next steps (out-of-MVP):

1. **Production deploy guide** — Docker compose recipe + reverse proxy (nginx/Caddy) + Let's Encrypt + production env vars (real `JWT_SECRET`, Telegram creds)
2. **TAD §1 endpoint registry doc patch** — add `/runs/{id}/excluded`, `/stocks/{ticker}/runs`, `reason_text` field
3. **XGBoost / LSTM training pipeline** — swap `engines/scoring_xgboost.py` + `engines/price_lstm.py` stubs
4. **News RSS crawler real** — replace fixture loader trong `crawlers/news_crawler.py`
5. **Macro crawler real** (SBV/GSO) — replace constants trong `crawlers/macro_crawler.py`
6. **Backtest strict per PRD §4.5** — replace mock heuristic trong `services/backtest_service.py`
7. **FE Playwright smoke pack** — critical-path automation (login → run → dashboard → portfolio CRUD → backtest → share + PDF)
8. **Multi-user / RBAC** — extend `user_profiles` + add role checks ở `dependencies.get_current_user`

Đầy đủ post-MVP backlog: [report/mvp-build/SUMMARY.md §5](../../../report/mvp-build/SUMMARY.md).

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 11 sau khi phase đã đóng)*

### 2026-05-19 — Superseded PLAN.md historical-note

- Cập nhật `plan/PLAN.md` từ ledger MVP core Phase 0-11 thành ledger hiện hành Phase 0-15.
- Các ghi chú Phase 11 về việc “không update ngược PLAN.md” chỉ đúng tại thời điểm 2026-05-11; từ 2026-05-19 trở đi README/PLAN/report dùng Phase 0-15 làm trạng thái hiện hành.
