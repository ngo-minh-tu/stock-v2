# Phase 11 — README

**Ngày:** 2026-05-11
**Mục tiêu thực hiện:** documentation cuối cùng để dev/tester clone repo có thể start dev + run trong < 15 phút. Scope expand từ PLAN spec (1 file `mvp/README.md`) → 3 files (root + mvp + frontend).
**Trạng thái:** COMPLETED 2026-05-11

## 1. Việc đã làm

- Pre-code drift audit 5 mục:
  - PLAN row 11 ghi "poetry install" — reality Phase 0 chốt `uv sync`. README dùng `uv` xuyên suốt; PLAN giữ historical (đã supersede 2026-05-19 khi PLAN cập nhật Phase 0-15).
  - PLAN spec 1 file → user chốt expand 3 files (option B) cho monorepo 4-surface.
  - `frontend/README.md` cluster-1-era ~80% mismatch sau cluster 2-6 + Phase 9 swap → replace toàn bộ, không patch.
  - `script/run-prototype.sh` trỏ `prototype/` frozen — KHÔNG touch (vẫn dùng để xem prototype cũ). Documented root README §2.
  - TAD §1 endpoint registry gap (`/runs/{id}/excluded`, `/stocks/{ticker}/runs`, `reason_text`) — KHÔNG self-patch, ghi vào `report/mvp-build/SUMMARY.md §4.C`.
- Viết root `README.md` (~110 LOC) — monorepo intro + pointers + stack tóm tắt + phase ledger + author/license.
- Viết `mvp/README.md` (~270 LOC) — backend setup 5-phút + env vars table + curl examples (login → run lifecycle → portfolio → share + PDF) + Docker + troubleshooting top 5 (DB locked, fixture pollution, vnstock fail, telegram empty, port conflict) + layout + giới hạn MVP.
- Replace `frontend/README.md` (~190 LOC) — post-Phase 9 reality (2 modes real/MSW opt-in, 14 routes, schema reconcile note, 17 component dirs).
- Smoke verify README commands trước commit:
  - `uv sync` → 86 packages.
  - `alembic upgrade head` + `seed.py` idempotent.
  - `uvicorn` + `curl health/version/login/pwd-change` (new schema).
  - `npx tsc --noEmit` + `npm run build`.
  - Markdown link relative paths verified manually (depth differs giữa root/mvp/frontend).

## 2. File đã thêm

- `README.md` (root).
- `mvp/README.md`.
- `mvp/phases/phase-11-readme/SUMMARY.md`.

## 3. File đã sửa (replace toàn bộ)

- `frontend/README.md` — cluster-1-era → post-Phase 9 reality.

## 4. Lệnh đã chạy

```bash
# === Verify mvp/README setup ===
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv sync                          # 86 packages
uv run alembic upgrade head      # idempotent
uv run python -m app.db.seed     # idempotent re-run safe
uv run uvicorn app.main:app --port 8000 &
sleep 3
curl -sS http://localhost:8000/api/health
curl -sS http://localhost:8000/api/version

# === Verify password change new schema (Phase 10 fix) ===
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
curl -sS -X PUT http://localhost:8000/api/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"current":"ChangeMe123!","new_password":"TempPwd!2026"}'
# Restore back ChangeMe123!

# === Verify frontend setup ===
cd /Users/ngominhtu/Projects/stock-v2/frontend
npx tsc --noEmit                 # clean
npm run build                    # 14 routes

# === Verify markdown links ===
grep -E "\[.*\]\(.*\.md\)" /Users/ngominhtu/Projects/stock-v2/README.md
grep -E "\[.*\]\(.*\.md\)" /Users/ngominhtu/Projects/stock-v2/mvp/README.md
grep -E "\[.*\]\(.*\.md\)" /Users/ngominhtu/Projects/stock-v2/frontend/README.md
```

## 5. Kết quả

- All 3 README files created/replaced (~570 LOC total).
- Smoke verify all README commands accurate:
  - `uv sync` → Resolved 86 packages ✓
  - `alembic upgrade head` clean (idempotent re-run sau Phase 0-10) ✓
  - `seed.py` idempotent — all skip "already seeded" ✓
  - `uvicorn` serves; `/api/health` + `/api/version` envelope OK ✓
  - PUT /auth/password new schema → 200 fresh token ✓
  - `npx tsc --noEmit` clean ✓
  - Markdown link relative paths all working ✓
- Root → mvp + frontend link working; mvp → ../report/ + ../frontend/ working; frontend → ../mvp/ + ../report/ + ../prototype/ working.

## 6. Tồn đọng

- **`script/run-prototype.sh` trỏ frozen `prototype/`** — vẫn hữu ích để xem prototype cũ; documented root README §2.
- **PLAN.md row 11 "poetry install" obsolete** — at Phase 11 README dùng `uv`, PLAN giữ historical; supersede 2026-05-19 khi PLAN cập nhật ledger Phase 0-15.
- **TAD §1 endpoint registry doc gap** — 3 endpoint Phase 6+9 chưa update TAD spec. README accurately reflect implementation; defer doc patch post-MVP.
- **No screenshot/diagram trong README** — text-only theo principle "ngắn". Visual context link tới `docs/design.md` + `docs/tad/c01-c08`.
- **vnstock real call chưa test** — README troubleshooting note "test mode dùng synthetic"; production deploy vẫn cần verify vnstock fetch lần đầu (ngoài scope Phase 11).
- **Production deploy guide** — README chỉ cover local + Docker single-instance. Production cần reverse proxy + Let's Encrypt + secrets management + backup SQLite WAL + monitoring. Post-MVP `docs/deploy.md`.
- **Telegram real-send setup guide** — chỉ note env vars; cần guide @BotFather flow. Post-MVP add troubleshooting dedicated.
- **Backup/restore SQLite + multi-env vars + CHANGELOG + README i18n** — post-MVP demand-driven.

### Post-phase fix 2026-05-19 — Superseded PLAN.md historical-note

- Cập nhật `plan/PLAN.md` từ ledger MVP core Phase 0-11 thành ledger hiện hành Phase 0-15.
- Các ghi chú Phase 11 về việc "không update ngược PLAN.md" chỉ đúng tại thời điểm 2026-05-11; từ 2026-05-19 trở đi README/PLAN/report dùng Phase 0-15 làm trạng thái hiện hành.
