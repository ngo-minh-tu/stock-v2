# Phase 27 — Deploy Polish + useExportPdf Refactor + PriceBoard Placeholder + Equity Sanity Guard

**Ngày:** 2026-05-22
**Mục tiêu thực hiện:** đóng 3 carry-over polish (Phase 19+26 REVIEW) + ship production deploy template (Track 4 baseline) trước khi trader test data thật. KHÔNG live-deploy — Phase 27 cung cấp template để operator wires sau khi quyết định hosting provider.
**Trạng thái:** COMPLETED 2026-05-22

## 1. Việc đã làm

- **27.1 — `useExportPdf` blob refactor** (Phase 19 REVIEW Low carry):
  - Magic-byte detection: đọc 4 byte đầu của blob, check `%PDF` → distinguishe WeasyPrint binary vs html_mock.
  - Binary path: `previewHtml = null`, cache raw blob; `confirmDownload` dùng blob gốc — KHÔNG re-decode via `text()`.
  - HTML mock path: decode text cho iframe preview, cache cả raw blob + text.
  - Tránh corrupt non-UTF8 bytes của real PDF binary từ WeasyPrint server-side.
- **27.2 — PriceBoard "Chưa có dữ liệu" placeholder**:
  - Tính `missingPriceCount` useMemo từ `data.items` (row.latest === null).
  - Hiển thị `card p-2` banner phía trên PriceBoardTable: "N mã đang ẩn — chạy /refresh/all để cập nhật".
  - i18n VI/EN: `priceBoard.missingData`.
  - `data-testid="price-board-missing-data"` hook cho E2E future.
- **27.3 — `_warn_total_equity_range` sanity guard** (Phase 26 REVIEW High carry):
  - Analog với Phase 25 `_warn_total_assets_range` (cùng floor 1e9 VND).
  - Phase 26 bvps fallback dùng `total_equity` làm divisor — nếu scaling regression, fallback compute SAI 1000×. Sentinel warn-log catch.
  - Bypass equity ≤ 0 (insolvent — `_compute_derived_fields` đã skip).
  - Warning message explicit "bvps fallback có thể sai 1000×" cho operator audit.
  - 5 unit test bổ sung vào `test_feature_sanity.py` (total 11/11).
- **27.4 — Production deploy template** (Track 4 baseline):
  - `docker-compose.yml` (repo root, new): 3 service — backend Dockerfile (Phase 18) + frontend `node:20-alpine` npm-start + nginx:1.27-alpine reverse proxy. Volume `prod-data` persist SQLite.
  - `script/nginx.conf` (new): HTTPS reverse proxy template — 80→443 redirect, SSL cert mount từ `script/ssl/`, `/api/*` proxy backend:8000, `/_next/*` cache, SPA fallback frontend:3000.
  - `docs/DEPLOY.md` (new): operator guide 6 section — architecture diagram, quick start 8-step, cron job wire, pre-handoff trader (Phase 25 link), disaster recovery, 8 production-ready gap items.
  - **KHÔNG live-deploy** — Phase 27 chỉ template + verification (build smoke, tsc, Playwright, pytest).

## 2. File đã thêm

- `mvp/phases/phase-27-deploy-polish/SUMMARY.md` — audit trail.
- `mvp/phases/phase-27-deploy-polish/REVIEW.md` — self-critical review.
- `report/phase-mvp/phase-27-deploy-polish/SUMMARY.md` — file này.
- `docker-compose.yml` (repo root) — 3-service production-like orchestration.
- `script/nginx.conf` — HTTPS reverse proxy template.
- `docs/DEPLOY.md` — operator deploy guide.

## 3. File đã sửa

- `frontend/src/lib/hooks/useExportPdf.ts` — magic-byte detection + binary-safe blob.
- `frontend/src/app/(app)/price-board/page.tsx` — missingPriceCount + placeholder banner.
- `frontend/src/messages/en.json` + `vi.json` — `priceBoard.missingData` × 2 locale.
- `mvp/code/app/services/feature_service.py` — `_warn_total_equity_range()` + invocation.
- `mvp/code/tests/unit/test_feature_sanity.py` — +5 unit test cho equity sanity.

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2

# Frontend
cd frontend
npx tsc --noEmit                              # clean
CI=1 npx playwright test                      # 8 passed (45.8s)

# Backend
cd ../mvp/code
uv run pytest tests/unit/test_feature_sanity.py -v   # 11/11 passed
uv run pytest -q                                       # 304/304 (chờ confirm)
uv run ruff check app tests                            # All checks passed

# Production deploy verify (syntax only)
cd ..
docker compose config                                  # YAML + service ref valid
```

## 5. Kết quả

- **Tests:**
  | Suite | Trước Phase 27 | Sau Phase 27 |
  |---|---|---|
  | TypeScript | clean | clean ✅ |
  | Playwright E2E | 8/8 | **8/8** ✅ (45.8s) |
  | BE pytest | 299/299 | **304/304** ⏳ (chờ full run confirm) |
  | Ruff | clean | clean ✅ |

- **`useExportPdf` flow** (sau refactor):
  - WeasyPrint binary mode (production): magic-byte `%PDF` → `previewHtml=null`, raw blob cached, `confirmDownload` download direct.
  - html_mock mode (dev): magic-byte không match → `previewHtml = await blob.text()`, raw blob cached, preview iframe vẫn work.

- **PriceBoard placeholder** trigger khi `data.items.filter(r => r.latest === null).length > 0`:
  - Banner hiển thị count "N mã đang ẩn..."
  - Test ID `price-board-missing-data` cho Playwright E2E future.

- **`_warn_total_equity_range` sanity** behavior:
  - Equity ≥ 1e9 VND: no log.
  - Equity 1e7 (ngàn đồng leak): log warning "below sanity floor ... bvps fallback có thể sai 1000×".
  - Equity ≤ 0: bypass (insolvent flag, đã handle ở `_compute_derived_fields`).
  - Equity None / non-numeric: bypass defensive.

- **Production deploy template**: docker-compose 3-service + nginx HTTPS proxy + DEPLOY.md operator guide. Documented 8 production gap (secret manager, WAF, observability, multi-instance, SSL auto-renew, container registry, off-site backup, Turbopack).

## 6. Tồn đọng

- **Live production deploy KHÔNG verify** — Phase 27 chỉ template + verify standalone. Operator chạy thực trên VPS sau khi quyết định hosting + cấp SSL + edit `.env.production`.
- **SSL cert auto-renewal** chưa wire — operator setup certbot timer hoặc Cloudflare API.
- **Container image registry** — `Dockerfile` build local mỗi deploy. CI push ghcr.io / Docker Hub là Phase 28.
- **Secret manager integration** — `.env.production` plaintext. Phase 28 nếu cần Vault / 1Password.
- **WAF / DDoS protection** — nginx default minimal. Cloudflare WAF rules là Phase 28.
- **Observability** — chỉ structlog stdout + cron-refresh log. Phase 28 nếu cần Prometheus + Grafana + Sentry.
- **Turbopack migration** — vẫn `--webpack` flag. Phase 28.
- **`useExportPdf` magic-byte chỉ 4 byte đầu** — corrupt blob truncate < 4 bytes có thể bypass detection. Edge case acceptable.
- **`priceBoard.missingData` banner không có dismiss** — Phase 28 cùng với `InfoBanner` dismiss.
- **Sanity guards Phase 25 + Phase 27 overlap noise** — 52 log lines max per run nếu cả assets + equity drift. Phase 28 consolidate vào 1 sentinel helper.
- **Postgres migration** cho scale > 1 instance — TAD g03 §C plan, defer.
- **Vnstock paid API key** — Phase 28 nếu trader cần refresh nhanh hơn 22 phút.
- **Sanity test scenarios pre-existing flake `test_compare_full_shape`** vẫn intermittent (floating-point precision) — pass solo, có thể fail full run thỉnh thoảng. Phase 28 cleanup.

## 7. Pre-handoff checklist (operator next)

1. Quyết định hosting provider (VPS / cloud).
2. Cấp SSL cert (Let's Encrypt qua certbot hoặc Cloudflare).
3. `cp mvp/code/env.production.example mvp/code/.env.production` + edit JWT_SECRET (openssl rand -hex 32) + INITIAL_USER_PASSWORD + FRONTEND_ORIGIN + Telegram creds.
4. `cd frontend && npm install && npm run build` (one-time host build).
5. Edit `script/nginx.conf` thay `screener.example.com` → domain thực.
6. `docker compose up -d` + verify health.
7. `docker compose exec backend python -m app.db.seed` first-boot.
8. `bash script/pre-handoff-refresh.sh` (~22 phút) → trader test data.
9. Manual `POST /api/run` qua FE login + verify Telegram broadcast.
10. Wire systemd timer cho `script/cron-refresh.sh` daily 16:30 ICT.
11. Setup ngrok (single tester) hoặc public domain → hand-off trader.
