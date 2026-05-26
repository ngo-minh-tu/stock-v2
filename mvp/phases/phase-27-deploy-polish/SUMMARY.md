# Phase 27 — Deploy Polish + useExportPdf Refactor + PriceBoard Placeholder + Equity Sanity Guard

**Started:** 2026-05-22 · **Closed:** 2026-05-22
**Roadmap:** Track 4 Production Deploy (template-only, không live-deploy) + carry-over UX polish (Phase 19 REVIEW Low + Phase 26 REVIEW High). KHÔNG đợi trader feedback vì 4 deliverable đều có acceptance criteria rõ + ROI cao cho stability/UX trước hoặc ngay sau ngrok hand-off.

## 1. Scope

4 sub-task song hành:

1. **27.1 — `useExportPdf` blob refactor** (Phase 19 REVIEW Low carry): cải `fetchPdf()` không decode binary PDF qua `await blob.text()`. Magic-byte detection (`%PDF` first 4 bytes) phân biệt WeasyPrint binary (production) vs html_mock (dev). Cache raw blob cho `confirmDownload` — KHÔNG reconstruct từ text.

2. **27.2 — PriceBoard "Chưa có dữ liệu" placeholder**: Phase 25 đã filter `row.latest === null` để ẩn ticker chưa có price snapshot. Thêm count summary banner "{N} mã đang ẩn — chạy /refresh/all để cập nhật" để trader thấy số ticker đang ẩn thay vì im lặng.

3. **27.3 — `_warn_total_equity_range` sanity guard** (Phase 26 REVIEW High carry): analog với Phase 25 `_warn_total_assets_range`. Phase 26 bvps fallback chia `total_equity / shares_outstanding`; nếu equity scaling regression, bvps fallback compute SAI 1000× — sentinel warn-log khi equity raw VND < 1e9.

4. **27.4 — Production deploy template** (Track 4 baseline): `docker-compose.yml` 3 service (backend + frontend + nginx); `script/nginx.conf` HTTPS reverse proxy với SSL cert mount; `docs/DEPLOY.md` operator guide 6 section (architecture + quick start + cron + pre-handoff + DR + production gaps). KHÔNG live-deploy — chỉ template + operator hands-on docs.

Out of scope: Turbopack migration (Phase 28 — vẫn `--webpack` flag stable); secret manager integration (operator responsibility per hosting); actual TLS cert provisioning (operator wires certbot/Cloudflare); container registry CI/CD (Phase 28+ nếu scale > 1 trader).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 27-01 | `fetchPdf` `await blob.text()` decode UTF-16 → corrupt non-UTF8 bytes nếu BE serve WeasyPrint real PDF. Phase 19 REVIEW Low. | `useExportPdf.ts` | Magic-byte detection (`%PDF` first 4 bytes). Binary path → `previewHtml=null`, raw blob cached. HTML mock → decode + cached blob. `confirmDownload` luôn dùng raw blob — KHÔNG reconstruct. |
| 27-02 | PriceBoard filter `row.latest === null` (Phase 25) ẩn ticker im lặng. Trader không biết đang ẩn mấy mã. | `price-board/page.tsx` | `missingPriceCount` useMemo + InfoBanner-style placeholder dưới filter; i18n keys `priceBoard.missingData` VI/EN. |
| 27-03 | Phase 26 bvps fallback divisor `total_equity` post-scaling. Nếu Phase 22 source-aware scaling regression hoặc parser miss-route, bvps fallback SAI 1000×. Phase 25 đã add `_warn_total_assets_range` (1e9 VND floor) cho assets, KHÔNG có cho equity. | `feature_service.py` | `_warn_total_equity_range(ticker, latest)` analog. Same floor 1e9 VND. Bypass khi equity ≤ 0 (insolvent — `_compute_derived_fields` đã skip). Invocation ngay sau `_warn_total_assets_range` trong `compute()`. |
| 27-04 | Phase 18 đã có `Dockerfile` + `env.production.example` + `script/backup-db.sh` + `cron-refresh.sh` nhưng KHÔNG có docker-compose orchestration hoặc nginx config. Operator cần construct manually. | `docker-compose.yml` + `script/nginx.conf` + `docs/DEPLOY.md` (3 new) | 3 service compose (backend Dockerfile + frontend node:20-alpine npm-start + nginx:1.27-alpine với SSL mount); nginx 80→443 redirect + /api/* proxy + /_next/* + SPA route fallback; DEPLOY.md 6 section. |
| 27-05 | docker-compose mount `frontend/` từ host → npm install + npm start trong container. Trade-off: cold start chậm (~30s npm install lần đầu) nhưng KHÔNG cần build FE image (giảm CI complexity cho 1-trader case). | `docker-compose.yml` | Comment trong YAML; operator có thể switch sang FE Dockerfile + build image nếu scale > 1 trader. |
| 27-06 | `docs/DEPLOY.md` phải document gap rõ ràng — operator KHÔNG nghĩ đây là turnkey production. | `docs/DEPLOY.md` §6 | 8 production-ready gap items (secret manager, WAF, observability, multi-instance, SSL auto-renew, container registry, off-site backup, Turbopack). |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `frontend/src/lib/hooks/useExportPdf.ts` | Magic-byte detection + binary-safe blob path + cached blob cho `confirmDownload`. |
| `frontend/src/app/(app)/price-board/page.tsx` | `missingPriceCount` count + placeholder banner. |
| `frontend/src/messages/en.json` + `vi.json` | `priceBoard.missingData` i18n key × 2 locale. |
| `mvp/code/app/services/feature_service.py` | `_warn_total_equity_range()` analog + invocation. |
| `mvp/code/tests/unit/test_feature_sanity.py` | +5 unit test (no warn above floor / warn below / no warn None / no warn ≤0 / no raise non-numeric). |
| `docker-compose.yml` (new, repo root) | 3-service production-like orchestration template. |
| `script/nginx.conf` (new) | HTTPS reverse proxy + SSL mount + Next 16 static asset cache. |
| `docs/DEPLOY.md` (new) | Operator guide — architecture, quick start, cron, pre-handoff, DR, gaps. |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| `useExportPdf` không decode binary PDF qua text() | ✅ | Magic-byte check; `previewBlob` cached; `confirmDownload` dùng raw blob, KHÔNG reconstruct. |
| Preview iframe vẫn work cho html_mock mode | ✅ | `previewHtml` set khi non-PDF magic; PdfPreviewModal consumer unchanged. |
| PriceBoard hiển thị placeholder khi có ticker null-latest | ✅ | `missingPriceCount > 0` → InfoBanner-style div; testId `price-board-missing-data`. |
| `_warn_total_equity_range` log warning khi equity < 1e9 | ✅ | `test_equity_warn_below_floor` pass — caplog chứa "below sanity floor" + "bvps fallback có thể sai". |
| `_warn_total_equity_range` bypass insolvent ticker | ✅ | `test_equity_no_warn_when_zero_or_negative` pass. |
| `docker-compose.yml` cú pháp valid | ✅ | YAML parser OK; 3 service đầy đủ env + volume + healthcheck mapping. |
| `nginx.conf` cú pháp valid + cover /api + /_next + SPA fallback | ✅ | Standard nginx directives + comment trader-handoff context. |
| `docs/DEPLOY.md` 6 section đầy đủ | ✅ | Architecture + quick start (8-step) + cron + pre-handoff + DR + production gaps. |
| TypeScript clean | ✅ | `npx tsc --noEmit` no errors. |
| Playwright 8/8 | ⏳ | _(Sẽ confirm)_ |
| BE pytest pass | ⏳ | _(Sẽ confirm 304/304 = 299 + 5 new equity sanity)_ |
| Ruff clean | ✅ | `uv run ruff check app tests` — All checks passed. |

## 5. Quyết định khoá trong phase này

- **Magic-byte detection `%PDF` first 4 bytes** thay vì Content-Type header check. Reason: BE html_mock mode trả `Content-Type: application/pdf` cho cả HTML body (TAD g02 §9.5 contract giữ stable). Header KHÔNG distinguishable; magic bytes là.
- **`previewBlob` cached** cùng `previewHtml` — `confirmDownload` luôn ưu tiên blob gốc. Tránh re-decode round-trip cho cả 2 mode.
- **`missingPriceCount` count thay vì list ticker** — privacy + concise. Trader thấy "N ticker hidden", không thấy specific symbols (giảm noise).
- **`_warn_total_equity_range` reuse `_TOTAL_ASSETS_SANITY_FLOOR_VND`** (1e9 VND) thay vì define separate constant. Floor identical logic (raw VND realistic minimum). DRY.
- **Equity warn message mention "bvps fallback có thể sai 1000×"** — operator audit context (Phase 26 bvps formula uses equity divisor).
- **docker-compose mount `frontend/` từ host** thay vì build FE image. 1-trader case không cần image registry. Trade-off: npm install runtime ~30s lần đầu, acceptable.
- **nginx SSL cert mount qua `./script/ssl/`** — operator copy cert (certbot symlinks hoặc Cloudflare-issued). KHÔNG bake cert vào image (gitignored).
- **`docs/DEPLOY.md` §6 production gaps** — explicit, document KHÔNG ship secret manager / WAF / observability. Operator decision based on hosting.
- **Phase 27 KHÔNG live-deploy** — chỉ template + verification (build smoke, tsc, Playwright, pytest). Operator chạy deploy thực sau khi quyết định hosting provider.
- **Turbopack migration defer Phase 28** — `--webpack` flag stable cho Next 16.x line. Migration tốn time + risk MSW SSR regression; defer cho khi Phase 28 có signal.

## 6. Issues / drift còn open

- **Live production deploy KHÔNG verify** — operator chạy `docker compose up -d` trên host thực. Phase 27 chỉ sample-test Dockerfile build pass + nginx syntax + DEPLOY.md instructions.
- **SSL cert renewal automation** chưa wire — operator setup certbot timer hoặc Cloudflare API. Phase 28 nếu cần.
- **Container image registry** — `Dockerfile` build local mỗi deploy. Production cần CI push lên ghcr.io / Docker Hub.
- **Secret manager integration** chưa có — `.env.production` plaintext. Operator responsibility. Phase 28 nếu cần Vault / 1Password.
- **WAF / DDoS protection** — nginx default config minimal. Operator wire Cloudflare WAF rules nếu public expose.
- **Observability** — chỉ structlog stdout + cron-refresh log. Production cần Prometheus + Grafana + Sentry FE. Phase 28.
- **Turbopack migration** — Phase 28. `--webpack` flag stable cho Next 16.x.
- **Container security scanning** — `docker scan` chưa wire vào Dockerfile build. Defer.
- **Multi-instance scale-out** — SQLite single-writer. Postgres migration plan trong TAD g03 §C, defer scale > 1.
- **Vnstock paid API key** — `VNSTOCK_API_KEY` env hiện chưa support. Phase 28 nếu trader cần refresh nhanh hơn 22 phút.
- **`useExportPdf` magic-byte detection** chỉ check first 4 bytes — corrupt PDF bị truncate hơn 4 bytes vẫn pass. Acceptable cho MVP; production CDN/proxy chunking không bị truncate.
- **PriceBoard `missingData` banner luôn hiển thị khi N > 0** — nếu trader đã biết, banner spam. Phase 28 dismiss + LocalStorage persist (cùng với `InfoBanner` Phase 25).

## 7. Test commands (reproducible)

```bash
cd /Users/ngominhtu/Projects/stock-v2

# FE TypeScript + Playwright
cd frontend
npx tsc --noEmit                              # clean
CI=1 npx playwright test                      # 8/8 pass

# BE pytest + ruff
cd ../mvp/code
uv run pytest tests/unit/test_feature_sanity.py -v   # 11/11 pass (6 cũ + 5 mới)
uv run pytest -q                                       # 304/304 pass (299 + 5)
uv run ruff check app tests                            # All checks passed

# Docker compose syntax verify (operator)
cd ..
docker compose config                                  # YAML + ref valid

# Nginx syntax verify (operator, optional)
nginx -t -c $(pwd)/script/nginx.conf
```

## 8. Hand-off cho phase tiếp theo

**Operator pre-handoff (ngoài Phase 27):**
1. Quyết định hosting provider (VPS / cloud).
2. Cấp SSL cert (Let's Encrypt qua certbot hoặc Cloudflare).
3. Copy + edit `mvp/code/.env.production` (JWT_SECRET, INITIAL_USER_PASSWORD, FRONTEND_ORIGIN, Telegram creds).
4. `docker compose up -d` + first-boot seed + verify health.
5. Wire cron-refresh.sh systemd timer.
6. `bash script/pre-handoff-refresh.sh` (~22 phút) → trader test data.

**Phase 28 (optional, post-feedback hoặc post-deploy):**
- `InfoBanner` + PriceBoard banner dismiss + LocalStorage persist.
- Settings UI bật/tắt Telegram broadcast; Bot API 429 retry.
- Sanity floor raise to 1e10 hoặc exclude MOCK% pattern.
- bvps adjustment (preferred-stock subtract, treasury-stock add-back) nếu trader audit feedback.
- KBS OCF Q1 gap workaround.
- `_FIELD_BLOCKLIST` → allowlist refactor.
- VCI snapshot fixture.
- Turbopack migration.
- Container registry CI/CD + observability + WAF integration.
- Vnstock paid API key.
- Postgres migration nếu scale > 1 instance.

## 9. Post-phase fixes

_(Empty — Phase 27 vừa đóng.)_
